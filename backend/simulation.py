"""
Simulación: genera sesiones de quiz sintéticas para bootstrappear el grafo
antes de tener suficientes datos de estudiantes reales.

Decisiones clave:
- Cada sesión se asocia a un USUARIO SINTÉTICO diferente (role='simulacion')
  para que el filtro de "primer intento por (user_id, question_id)" no
  descarte casi todas las transiciones (todas vendrían del mismo usuario).
- Cada sesión es una secuencia aleatoria de preguntas únicas dentro de la
  sesión, ignorando tema/dificultad.
- Cada sesión tiene un p_correct ~ U(0.30, 0.90) constante por usuario.
- Después de poblar Answers, se invoca graph_pipeline.rebuild_full() para
  reconstruir TABLA 1 y TABLA 2 incluyendo los datos reales que ya hubiera.
- _clear_sim_data borra SOLO sesiones/respuestas de usuarios con
  role='simulacion'; nunca toca datos de estudiantes reales.
"""
import numpy as np
from datetime import datetime, timedelta

N_SESSIONS_DEFAULT = 3000
MIN_PREG = 5
MAX_PREG = 10

SIM_ROLE = 'simulacion'
SIM_USER_PREFIX = 'sim_'   # student_number = sim_0000001, sim_0000002, ...

# Hash placeholder: los usuarios sim nunca hacen login. Saltar bcrypt aquí
# es lo que mantiene la simulación dentro del timeout de gunicorn (3000
# llamadas a bcrypt cost=12 = 10-20 minutos, vs 180s de timeout).
SIM_PASSWORD_HASH = '!sim-account-no-login!'


def _clear_sim_data(db, User, QuizSession, Answer):
    """
    Borra todas las QuizSessions y Answers de usuarios con role='simulacion'.
    NO toca QuestionTransition ni RawTransition: esas se reconstruyen al
    final desde Answers (sim + reales) por graph_pipeline.rebuild_full().
    NO borra a los usuarios sintéticos: se reusan si caben, se crean nuevos
    si faltan.
    """
    sim_user_ids = [u.id for u in User.query.filter_by(role=SIM_ROLE).all()]
    if not sim_user_ids:
        return 0

    session_ids = [s.id for s in QuizSession.query.filter(
        QuizSession.user_id.in_(sim_user_ids)
    ).all()]
    if not session_ids:
        return 0

    Answer.query.filter(Answer.session_id.in_(session_ids)).delete(synchronize_session=False)
    QuizSession.query.filter(QuizSession.id.in_(session_ids)).delete(synchronize_session=False)
    db.session.commit()
    print(f"Deleted {len(session_ids)} old simulation sessions from "
          f"{len(sim_user_ids)} simulation users.")
    return len(session_ids)


def _ensure_sim_users(db, User, n_needed, rng):
    """Asegura que existan al menos n_needed usuarios sintéticos. Reusa los existentes."""
    existing = User.query.filter_by(role=SIM_ROLE).order_by(User.id).all()
    if len(existing) >= n_needed:
        return existing[:n_needed]

    next_idx = len(existing) + 1
    to_create = n_needed - len(existing)
    new_objs = [
        User(
            student_number=f"{SIM_USER_PREFIX}{next_idx + i:07d}",
            role=SIM_ROLE,
            name=f"Sim {next_idx + i}",
            email=f"{SIM_USER_PREFIX}{next_idx + i:07d}@sim.quiz.app",
            password_hash=SIM_PASSWORD_HASH,
        )
        for i in range(to_create)
    ]
    db.session.bulk_save_objects(new_objs)
    db.session.commit()
    print(f"Ensured {n_needed} simulation users "
          f"({len(existing)} reused, {to_create} created).")

    # Re-query para obtener las filas persistidas con su id asignado por la BD.
    return User.query.filter_by(role=SIM_ROLE).order_by(User.id).limit(n_needed).all()


def run_simulation(db, User, Question, QuizSession, Answer,
                   n_sessions=N_SESSIONS_DEFAULT, seed=42, force=False):
    """
    Genera n_sessions sesiones sintéticas y reconstruye el grafo.

    force=True borra sesiones simuladas previas antes de empezar.
    force=False omite la corrida si ya hay sesiones simuladas (idempotente).
    """
    # Guard idempotente
    if not force:
        existing = (db.session.query(QuizSession)
                    .join(User, QuizSession.user_id == User.id)
                    .filter(User.role == SIM_ROLE)
                    .count())
        if existing > 0:
            print(f"Simulation already ran ({existing} sim sessions). "
                  f"Pass force=True to re-run.")
            return existing, 0, 0

    # Limpiar simulación previa (NO toca datos reales)
    _clear_sim_data(db, User, QuizSession, Answer)

    questions = Question.query.all()
    if not questions:
        print("No questions found in DB. Run init_db.py first.")
        return 0, 0, 0
    q_ids = [q.question_id for q in questions]

    rng = np.random.default_rng(seed)

    # Un usuario por sesión: garantiza que el filtro "primer intento" no
    # descarte el cruce cross-tema dentro de la simulación.
    sim_users = _ensure_sim_users(db, User, n_sessions, rng)

    base_time = datetime.utcnow() - timedelta(days=90)

    sessions_created = 0
    answers_created  = 0
    COMMIT_EVERY     = 300

    print(f"Running simulation: {n_sessions} sessions, "
          f"{len(q_ids)} questions, {len(sim_users)} sim users (one per session)...")

    answers_buf = []  # se vuelca con bulk_save_objects cada COMMIT_EVERY sesiones

    for i in range(n_sessions):
        p_correct_student = float(rng.uniform(0.30, 0.90))
        session_len = int(np.clip(int(rng.integers(MIN_PREG, MAX_PREG + 1)),
                                  1, len(q_ids)))
        offset_hours = float(rng.uniform(0, 90 * 24))
        started_at   = base_time + timedelta(hours=offset_hours)

        user = sim_users[i]
        session_obj = QuizSession(
            user_id=user.id,
            week=None,
            theme=None,
            difficulty=None,
            started_at=started_at,
            completed_at=started_at + timedelta(minutes=session_len * 2),
            status='completed',
        )
        db.session.add(session_obj)
        db.session.flush()  # necesario: necesitamos session_obj.id para los Answer

        # Secuencia aleatoria de preguntas únicas dentro de la sesión
        chosen = rng.choice(q_ids, size=session_len, replace=False)
        answered_at = started_at
        for order, qid in enumerate(chosen):
            is_correct  = bool(rng.random() < p_correct_student)
            user_answer = 'a' if is_correct else str(rng.choice(['b', 'c', 'd']))
            answered_at = answered_at + timedelta(seconds=int(rng.uniform(15, 120)))

            answers_buf.append(Answer(
                session_id=session_obj.id,
                question_id=int(qid),
                user_answer=user_answer,
                is_correct=is_correct,
                answered_at=answered_at,
                order_in_session=order,
            ))
            answers_created += 1

        sessions_created += 1

        if sessions_created % COMMIT_EVERY == 0:
            db.session.bulk_save_objects(answers_buf)
            answers_buf.clear()
            db.session.commit()
            print(f"  Committed {sessions_created}/{n_sessions} sessions...")

    if answers_buf:
        db.session.bulk_save_objects(answers_buf)
        answers_buf.clear()
    db.session.commit()

    # Reconstruir TABLA 1 + TABLA 2 incluyendo todos los Answer (sim + reales)
    from graph_pipeline import rebuild_full
    stats = rebuild_full(db)
    print(f"Simulation complete: {sessions_created} sessions, "
          f"{answers_created} answers, "
          f"{stats['raw_transitions']} raw transitions, "
          f"{stats['unique_pairs']} unique pairs.")
    return sessions_created, answers_created, stats['unique_pairs']
