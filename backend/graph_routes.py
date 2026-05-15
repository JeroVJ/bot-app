from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Question, QuizSession, Answer

graph_bp = Blueprint('graph', __name__, url_prefix='/api/graph')


def check_teacher_role():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    return user and user.role == 'teacher'


def get_graph():
    """
    Return the quiz_graph singleton, auto-building it from QuestionTransition
    if it hasn't been built in this worker process yet.

    Gunicorn spawns multiple worker processes; each has its own in-memory
    quiz_graph. This ensures every worker can serve graph data without
    requiring a manual /rebuild call after simulation.
    """
    from graph_engine import quiz_graph
    if not quiz_graph.G:
        quiz_graph.build(db, Question)
    return quiz_graph


@graph_bp.route('/status', methods=['GET'])
@jwt_required()
def graph_status():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(get_graph().get_status()), 200


@graph_bp.route('/health', methods=['GET'])
@jwt_required()
def graph_health():
    """
    Diagnóstico del grafo: nodos aislados, distribución de grado,
    rango de pesos, y una prueba de Dijkstra entre dos nodos conectados
    aleatorios para verificar que el shortest-path funciona.

    Útil después de un rebuild o seed-simulation para confirmar que el
    grafo quedó utilizable.
    """
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(get_graph().get_health()), 200


@graph_bp.route('/rebuild', methods=['POST'])
@jwt_required()
def rebuild_graph():
    """Rebuild the in-memory graph from the QuestionTransition table."""
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    success = quiz_graph.build(db, Question)
    return jsonify({'success': success, 'status': get_graph().get_status()}), 200


@graph_bp.route('/seed-simulation', methods=['POST'])
@jwt_required()
def seed_simulation():
    """
    Generate synthetic quiz sessions and rebuild the question transition graph.

    Body (JSON, all optional):
      n_sessions : int   – number of sessions to simulate (default 3000, max 10000)
      force      : bool  – if true, delete previous simulation data and re-run
                           (only affects users with role='simulacion'; real
                           student data is preserved)
    """
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403

    data       = request.get_json(force=True, silent=True) or {}
    n_sessions = min(int(data.get('n_sessions', 3000)), 10000)
    force      = bool(data.get('force', False))

    try:
        from simulation import run_simulation
        sessions, answers, transitions = run_simulation(
            db, User, Question, QuizSession, Answer,
            n_sessions=n_sessions,
            force=force,
        )

        from graph_engine import quiz_graph
        quiz_graph.build(db, Question)

        return jsonify({
            'message':              f'Created {sessions} sessions, {answers} answers, '
                                    f'{transitions} unique transitions.',
            'sessions_created':     sessions,
            'answers_created':      answers,
            'transitions_created':  transitions,
            'graph_status':         get_graph().get_status(),
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@graph_bp.route('/rebuild-pipeline', methods=['POST'])
@jwt_required()
def rebuild_pipeline():
    """
    Reconstruir TABLA 1 (RawTransition) + TABLA 2 (QuestionTransition con peso)
    desde cero leyendo todos los Answer de sesiones 'completed' (simulación +
    estudiantes reales). Aplica el filtro de primer intento por
    (user_id, question_to_id) y guarda peso = -ln((c+1)/(n+2)) Laplace.

    Es la operación canónica para refrescar el grafo. NO destruye Answer ni
    QuizSession; solo regenera las tablas derivadas.
    """
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403

    try:
        from graph_pipeline import rebuild_full
        stats = rebuild_full(db)

        from graph_engine import quiz_graph
        quiz_graph.build(db, Question)

        return jsonify({
            'message':       'TABLA 1 y TABLA 2 reconstruidas desde Answers.',
            **stats,
            'graph_status':  get_graph().get_status(),
        }), 200

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@graph_bp.route('/reset-transitions', methods=['POST'])
@jwt_required()
def reset_transitions():
    """Alias delgado de /rebuild-pipeline (mantenido por compatibilidad)."""
    return rebuild_pipeline()


@graph_bp.route('/transitions', methods=['GET'])
@jwt_required()
def get_raw_transitions():
    """
    Return raw rows from QuestionTransition for inspection.

    Query params:
      from_id : int  – filter by question_from_id
      to_id   : int  – filter by question_to_id
      limit   : int  – max rows (default 100)
    """
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403

    from models import QuestionTransition, QuestionOutStats

    from_id = request.args.get('from_id', type=int)
    to_id   = request.args.get('to_id',   type=int)
    limit   = min(request.args.get('limit', default=100, type=int), 1000)

    q = QuestionTransition.query
    if from_id is not None:
        q = q.filter_by(question_from_id=from_id)
    if to_id is not None:
        q = q.filter_by(question_to_id=to_id)
    q = q.order_by(QuestionTransition.total_transiciones.desc()).limit(limit)

    rows = q.all()
    # Attach total_salidas for each unique from_id in the result
    from_ids = list({r.question_from_id for r in rows})
    out_map  = {
        s.question_id: s.total_salidas
        for s in QuestionOutStats.query.filter(
            QuestionOutStats.question_id.in_(from_ids)
        ).all()
    }

    data = []
    for r in rows:
        sal    = out_map.get(r.question_from_id, 0)
        p_tr   = round(r.total_transiciones / sal, 4) if sal > 0 else 0
        p_corr = round(r.total_correctas / r.total_transiciones, 4) if r.total_transiciones > 0 else 0
        data.append({
            **r.to_dict(),
            'total_salidas':  sal,
            'p_transition':   p_tr,
            'p_correct':      p_corr,
        })

    return jsonify({'transitions': data, 'count': len(data)}), 200


# ---------------------------------------------------------------------------
# Existing visualization endpoints (unchanged API)
# ---------------------------------------------------------------------------

@graph_bp.route('/viz-data', methods=['GET'])
@jwt_required()
def get_viz_data():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(get_graph().get_viz_data()), 200


@graph_bp.route('/topic-graph', methods=['GET'])
@jwt_required()
def get_topic_graph():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(get_graph().get_topic_graph()), 200


@graph_bp.route('/transition-matrix', methods=['GET'])
@jwt_required()
def get_transition_matrix():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(get_graph().get_transition_matrix()), 200


@graph_bp.route('/topic-stats', methods=['GET'])
@jwt_required()
def get_topic_stats():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify({'topic_stats': get_graph().get_topic_stats()}), 200


@graph_bp.route('/node-neighborhood', methods=['GET'])
@jwt_required()
def get_node_neighborhood():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    question_id = request.args.get('question_id', type=int)
    top_k       = request.args.get('top_k', default=10, type=int)
    if question_id is None:
        return jsonify({'error': 'question_id required'}), 400
    return jsonify({'neighbors': get_graph().get_node_neighborhood(question_id, top_k)}), 200


@graph_bp.route('/question-network', methods=['GET'])
@jwt_required()
def get_question_network():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    week       = request.args.get('week',       type=int)
    tema       = request.args.get('tema',       type=str)
    difficulty = request.args.get('difficulty', type=int)
    max_edges  = request.args.get('max_edges',  default=100000, type=int)
    return jsonify(get_graph().get_question_network(
        week=week, tema=tema, difficulty=difficulty, max_edges=max_edges
    )), 200
