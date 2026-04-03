from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, Question, QuizSession, Answer

graph_bp = Blueprint('graph', __name__, url_prefix='/api/graph')


def check_teacher_role():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    return user and user.role == 'teacher'


@graph_bp.route('/status', methods=['GET'])
@jwt_required()
def graph_status():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    return jsonify(quiz_graph.get_status()), 200


@graph_bp.route('/rebuild', methods=['POST'])
@jwt_required()
def rebuild_graph():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    success = quiz_graph.build(db, Question, QuizSession, Answer)
    return jsonify({'success': success, 'status': quiz_graph.get_status()}), 200


@graph_bp.route('/seed-simulation', methods=['POST'])
@jwt_required()
def seed_simulation():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    data = request.get_json(force=True, silent=True) or {}
    n_sessions = min(int(data.get('n_sessions', 3000)), 10000)
    try:
        from simulation import run_simulation
        sessions, answers = run_simulation(db, User, Question, QuizSession, Answer, n_sessions=n_sessions)
        from graph_engine import quiz_graph
        quiz_graph.build(db, Question, QuizSession, Answer)
        return jsonify({
            'message': f'Created {sessions} sessions, {answers} answers',
            'sessions_created': sessions,
            'answers_created': answers,
            'graph_status': quiz_graph.get_status()
        }), 200
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@graph_bp.route('/viz-data', methods=['GET'])
@jwt_required()
def get_viz_data():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    return jsonify(quiz_graph.get_viz_data()), 200


@graph_bp.route('/topic-graph', methods=['GET'])
@jwt_required()
def get_topic_graph():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    return jsonify(quiz_graph.get_topic_graph()), 200


@graph_bp.route('/transition-matrix', methods=['GET'])
@jwt_required()
def get_transition_matrix():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    return jsonify(quiz_graph.get_transition_matrix()), 200


@graph_bp.route('/topic-stats', methods=['GET'])
@jwt_required()
def get_topic_stats():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    from graph_engine import quiz_graph
    return jsonify({'topic_stats': quiz_graph.get_topic_stats()}), 200


@graph_bp.route('/node-neighborhood', methods=['GET'])
@jwt_required()
def get_node_neighborhood():
    if not check_teacher_role():
        return jsonify({'error': 'Unauthorized'}), 403
    question_id = request.args.get('question_id', type=int)
    top_k = request.args.get('top_k', default=10, type=int)
    if question_id is None:
        return jsonify({'error': 'question_id required'}), 400
    from graph_engine import quiz_graph
    return jsonify({'neighbors': quiz_graph.get_node_neighborhood(question_id, top_k)}), 200
