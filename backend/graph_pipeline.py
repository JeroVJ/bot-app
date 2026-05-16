"""
Pipeline de construcción del grafo de transiciones.

Flujo:
    Answer (con order_in_session)
        │  iterar pares consecutivos (Y, X)
        │  filtrar primer intento por (user_id, X)
        ▼
    RawTransition  (TABLA 1, fuente de verdad)
        │  GROUP BY (Y, X) + Laplace
        ▼
    QuestionTransition  (TABLA 2, agregada, con peso)
        │
        ▼
    QuestionOutStats   (legacy, solo viz)

Hay dos modos de uso:

  - rebuild_full(db): borra TABLA 1 y TABLA 2 y reconstruye desde todos
    los Answer en estado 'completed'. Idempotente. Llamado por el endpoint
    /api/graph/rebuild-pipeline y por init_db.py si TABLA 1 está vacía.

  - ingest_session(db, session_id): incremental. Lee los Answer de UNA
    sesión, agrega a TABLA 1 (respetando el filtro de primer intento) y
    actualiza solo las filas afectadas de TABLA 2. Llamado al completar
    cada quiz por estudiantes reales o por la simulación.
"""
import math
from collections import defaultdict


# Laplace smoothing: evita peso = -log(0) = +inf cuando total_aciertos = 0.
LAPLACE_NUM = 1.0   # +1 al numerador
LAPLACE_DEN = 2.0   # +2 al denominador


def edge_weight(total_correctas, total_transiciones):
    """
    Peso de arista con suavizado de Laplace.

    peso = -ln((c + 1) / (n + 2))

    Propiedades:
      - Para c=0, n=1:  peso = -ln(1/3) ≈ 1.0986 (no infinito)
      - Para c=n=10:    peso = -ln(11/12) ≈ 0.0870 (transición fácil → casi 0)
      - Siempre >= 0 y finito.
    """
    p = (total_correctas + LAPLACE_NUM) / (total_transiciones + LAPLACE_DEN)
    return -math.log(p)


def _seen_destinations_for_user(db, RawTransition, user_id):
    """Conjunto de question_to_id que un usuario ya tiene registrados como destino."""
    rows = db.session.query(RawTransition.question_to_id) \
                     .filter(RawTransition.user_id == user_id).all()
    return {r[0] for r in rows}


def _upsert_question_transition(db, QuestionTransition, y, x, n, c):
    """Inserta o actualiza la fila agregada (y, x) con sus contadores y peso."""
    row = QuestionTransition.query.filter_by(
        question_from_id=y, question_to_id=x
    ).first()
    peso = edge_weight(c, n)
    if row is None:
        row = QuestionTransition(
            question_from_id=y,
            question_to_id=x,
            total_transiciones=n,
            total_correctas=c,
            peso=peso,
        )
        db.session.add(row)
    else:
        row.total_transiciones = n
        row.total_correctas = c
        row.peso = peso
    return row


def _recount_pair(db, RawTransition, y, x):
    """Cuenta (n, c) de RawTransition para el par (y, x)."""
    from sqlalchemy import func
    res = db.session.query(
        func.count(RawTransition.id),
        func.sum(db.case((RawTransition.is_correct_to == True, 1), else_=0)),
    ).filter(
        RawTransition.question_from_id == y,
        RawTransition.question_to_id == x,
    ).first()
    n = int(res[0] or 0)
    c = int(res[1] or 0)
    return n, c


# ---------------------------------------------------------------------------
# Modo incremental: una sesión a la vez
# ---------------------------------------------------------------------------

def ingest_session(db, session_id):
    """
    Procesa los Answer de UNA sesión completada y actualiza TABLA 1 + TABLA 2.

    Aplica el filtro "primer intento por (user_id, question_to_id)":
    si el usuario ya tiene una RawTransition con esa misma pregunta destino,
    la transición no se cuenta (es un reintento, no aporta información nueva).

    Retorna: número de RawTransition insertadas.
    """
    from models import Answer, QuizSession, QuestionTransition, RawTransition

    session = QuizSession.query.get(session_id)
    if session is None or session.status != 'completed':
        return 0

    answers = Answer.query.filter_by(session_id=session_id).order_by(
        Answer.order_in_session, Answer.answered_at, Answer.id
    ).all()
    if len(answers) < 2:
        return 0

    seen_dst = _seen_destinations_for_user(db, RawTransition, session.user_id)

    pairs_touched = set()
    inserted = 0
    for i in range(len(answers) - 1):
        y_ans = answers[i]
        x_ans = answers[i + 1]

        # Filtro de primer intento: si el usuario ya vio X como destino, saltar.
        if x_ans.question_id in seen_dst:
            continue
        seen_dst.add(x_ans.question_id)

        # order_in_session de X. Si la columna no estaba, usamos i+1 como fallback.
        order_x = x_ans.order_in_session if x_ans.order_in_session is not None else (i + 1)

        db.session.add(RawTransition(
            user_id=session.user_id,
            session_id=session_id,
            order_in_session=order_x,
            question_from_id=y_ans.question_id,
            question_to_id=x_ans.question_id,
            is_correct_to=bool(x_ans.is_correct),
        ))
        inserted += 1
        pairs_touched.add((y_ans.question_id, x_ans.question_id))

    if inserted == 0:
        return 0

    db.session.flush()

    # Recalcular solo las aristas afectadas
    for (y, x) in pairs_touched:
        n, c = _recount_pair(db, RawTransition, y, x)
        _upsert_question_transition(db, QuestionTransition, y, x, n, c)

    # Recalcular QuestionOutStats de los nodos Y afectados (legacy / viz)
    _refresh_out_stats(db, [y for (y, _) in pairs_touched])

    db.session.commit()

    # Invalida grafo en memoria del worker actual: se reconstruye lazy al
    # próximo request a un endpoint que use get_graph().
    try:
        from graph_engine import quiz_graph
        quiz_graph.G = None
    except Exception:
        pass

    return inserted


def _refresh_out_stats(db, from_ids):
    """Recalcula QuestionOutStats para una lista de question_from_id."""
    from models import QuestionTransition, QuestionOutStats
    from sqlalchemy import func

    for y in set(from_ids):
        total = db.session.query(func.sum(QuestionTransition.total_transiciones)) \
                          .filter(QuestionTransition.question_from_id == y).scalar() or 0
        row = QuestionOutStats.query.filter_by(question_id=y).first()
        if row is None:
            db.session.add(QuestionOutStats(question_id=y, total_salidas=int(total)))
        else:
            row.total_salidas = int(total)


# ---------------------------------------------------------------------------
# Modo completo: reconstruir todo desde cero
# ---------------------------------------------------------------------------

def rebuild_full(db):
    """
    Reconstruye TABLA 1 + TABLA 2 + QuestionOutStats desde todos los Answer
    en sesiones 'completed'. Idempotente.

    Retorna dict con conteos.
    """
    from models import (Answer, QuizSession, QuestionTransition,
                        QuestionOutStats, RawTransition)

    # Limpiar
    RawTransition.query.delete(synchronize_session=False)
    QuestionTransition.query.delete(synchronize_session=False)
    QuestionOutStats.query.delete(synchronize_session=False)
    db.session.commit()

    # Cargar Answers de sesiones completadas, agrupar por sesión y ordenar
    # cronológicamente. Ordenamos también globalmente por (user_id, ts) para
    # que el filtro de primer intento sea reproducible (la sesión más antigua
    # del usuario es la que "gana" la primera ocurrencia de cada destino).
    rows = (db.session.query(Answer, QuizSession.user_id)
            .join(QuizSession, Answer.session_id == QuizSession.id)
            .filter(QuizSession.status == 'completed')
            .order_by(QuizSession.user_id,
                      Answer.answered_at,
                      Answer.session_id,
                      Answer.order_in_session,
                      Answer.id)
            .all())

    # Agrupar por sesión preservando el orden
    by_session = defaultdict(list)
    user_of_session = {}
    for ans, uid in rows:
        by_session[ans.session_id].append(ans)
        user_of_session[ans.session_id] = uid

    # Para el filtro de primer intento: por usuario, qué question_id ya fue destino
    seen_dst_per_user = defaultdict(set)

    # Bucket por par (y, x) → (n, c)
    pair_buf = defaultdict(lambda: {'n': 0, 'c': 0})

    # Buffer en memoria de RawTransition; se vuelca con bulk_save_objects.
    raw_buf = []
    # Iteramos sesiones en orden cronológico por usuario (ya ordenado por
    # user_id, answered_at). Eso garantiza que la primera vez que aparezca
    # X como destino para ese usuario sea la primera cronológicamente.
    session_ids_sorted = sorted(by_session.keys(),
                                key=lambda sid: (user_of_session[sid],
                                                 by_session[sid][0].answered_at or 0))
    for sid in session_ids_sorted:
        answers = by_session[sid]
        if len(answers) < 2:
            continue
        uid = user_of_session[sid]
        seen_dst = seen_dst_per_user[uid]

        for i in range(len(answers) - 1):
            y_ans = answers[i]
            x_ans = answers[i + 1]

            if x_ans.question_id in seen_dst:
                continue
            seen_dst.add(x_ans.question_id)

            order_x = x_ans.order_in_session if x_ans.order_in_session is not None else (i + 1)
            raw_buf.append(RawTransition(
                user_id=uid,
                session_id=sid,
                order_in_session=order_x,
                question_from_id=y_ans.question_id,
                question_to_id=x_ans.question_id,
                is_correct_to=bool(x_ans.is_correct),
            ))

            pair_buf[(y_ans.question_id, x_ans.question_id)]['n'] += 1
            if x_ans.is_correct:
                pair_buf[(y_ans.question_id, x_ans.question_id)]['c'] += 1

        # Flush periódico para no inflar la sesión de SQLAlchemy
        if len(raw_buf) >= 5000:
            db.session.bulk_save_objects(raw_buf)
            raw_buf.clear()

    if raw_buf:
        db.session.bulk_save_objects(raw_buf)
    raw_rows_inserted = sum(d['n'] for d in pair_buf.values())

    # Volcar TABLA 2 en bulk
    qt_buf = []
    out_buf = defaultdict(int)
    for (y, x), d in pair_buf.items():
        n, c = d['n'], d['c']
        peso = edge_weight(c, n)
        assert peso >= 0, f"peso negativo para ({y},{x}): {peso}"
        assert math.isfinite(peso), f"peso no finito para ({y},{x}): {peso}"
        qt_buf.append(QuestionTransition(
            question_from_id=y,
            question_to_id=x,
            total_transiciones=n,
            total_correctas=c,
            peso=peso,
        ))
        out_buf[y] += n
    if qt_buf:
        db.session.bulk_save_objects(qt_buf)

    # QuestionOutStats legacy
    if out_buf:
        db.session.bulk_save_objects([
            QuestionOutStats(question_id=qid, total_salidas=total)
            for qid, total in out_buf.items()
        ])

    db.session.commit()

    # Invalida cache en memoria
    try:
        from graph_engine import quiz_graph
        quiz_graph.G = None
    except Exception:
        pass

    return {
        'answers_processed': len(rows),
        'sessions_processed': len(by_session),
        'raw_transitions': raw_rows_inserted,
        'unique_pairs': len(pair_buf),
    }
