"""
Simulation engine: generates synthetic quiz sessions with purely random data.
Populates QuestionTransition and QuestionOutStats tables so graph_engine
can build the question network.

Design:
- Each session is a random sequence of questions drawn from ALL questions,
  completely ignoring theme and difficulty.
- Each session gets a random correctness probability p ~ Uniform(0.3, 0.9).
- Each answer is correct with probability p (independent of everything else).
- Transitions Y → X are recorded for every consecutive pair in a session.
"""
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

N_SESSIONS_DEFAULT = 3000
MIN_PREG = 5
MAX_PREG = 10

SIM_USER_NUMBER = 'sim_data'
SIM_USER_NAME   = 'Datos Simulados'
SIM_USER_EMAIL  = 'simulacion@quiz.app'


def get_or_create_sim_user(db, User):
    user = User.query.filter_by(student_number=SIM_USER_NUMBER).first()
    if not user:
        user = User(
            student_number=SIM_USER_NUMBER,
            role='simulacion',
            name=SIM_USER_NAME,
            email=SIM_USER_EMAIL,
        )
        user.set_password('sim_not_for_login_xk39f')
        db.session.add(user)
        db.session.commit()
        print(f"Created simulation user (id={user.id})")
    return user


def _clear_sim_data(db, User, QuizSession, Answer, QuestionTransition, QuestionOutStats):
    """Delete all previously simulated sessions, answers and transition tables."""
    sim_user = User.query.filter_by(student_number=SIM_USER_NUMBER).first()
    if sim_user:
        session_ids = [s.id for s in QuizSession.query.filter_by(user_id=sim_user.id).all()]
        if session_ids:
            Answer.query.filter(Answer.session_id.in_(session_ids)).delete(synchronize_session=False)
            QuizSession.query.filter(QuizSession.id.in_(session_ids)).delete(synchronize_session=False)
        print(f"Deleted {len(session_ids)} old simulation sessions.")

    QuestionTransition.query.delete(synchronize_session=False)
    QuestionOutStats.query.delete(synchronize_session=False)
    db.session.commit()
    print("Cleared QuestionTransition and QuestionOutStats tables.")


def _flush_transitions(db, QuestionTransition, QuestionOutStats,
                       trans_buf, out_buf, batch_label):
    """Bulk-insert accumulated transitions into the DB tables."""
    for (y_id, x_id), data in trans_buf.items():
        t = QuestionTransition(
            question_from_id=y_id,
            question_to_id=x_id,
            total_transiciones=data['n'],
            total_correctas=data['n_correct'],
        )
        db.session.add(t)

    for qid, total in out_buf.items():
        s = QuestionOutStats(question_id=qid, total_salidas=total)
        db.session.add(s)

    db.session.commit()
    print(f"  [{batch_label}] Flushed {len(trans_buf)} transitions, "
          f"{len(out_buf)} out-stats to DB.")


def run_simulation(db, User, Question, QuizSession, Answer,
                   n_sessions=N_SESSIONS_DEFAULT, seed=42, force=False):
    """
    Simulate n_sessions quiz sessions and persist them plus transition statistics.

    Parameters
    ----------
    force : bool
        If True, delete existing simulation data and re-run from scratch.
        If False (default), skip if simulation was already run.

    Returns
    -------
    (sessions_created, answers_created, transitions_created)
    """
    from models import QuestionTransition, QuestionOutStats

    # --- Guard: skip if already ran and not forced ---
    sim_user = User.query.filter_by(student_number=SIM_USER_NUMBER).first()
    if sim_user and not force:
        existing = QuizSession.query.filter_by(user_id=sim_user.id).count()
        if existing > 0:
            print(f"Simulation already ran ({existing} sessions). Pass force=True to re-run.")
            return existing, 0, 0

    # --- Clear old data ---
    _clear_sim_data(db, User, QuizSession, Answer, QuestionTransition, QuestionOutStats)

    # --- Load questions ---
    questions = Question.query.all()
    if not questions:
        print("No questions found in DB. Run init_db.py first.")
        return 0, 0, 0

    # Only need the list of all question IDs — no theme/difficulty grouping
    q_ids = [q.question_id for q in questions]

    sim_user = get_or_create_sim_user(db, User)

    rng = np.random.default_rng(seed)
    base_time = datetime.utcnow() - timedelta(days=90)

    # Accumulators for transitions (in-memory, flushed at end)
    COMMIT_EVERY = 300
    trans_buf = defaultdict(lambda: {'n': 0, 'n_correct': 0})
    out_buf   = defaultdict(int)

    sessions_created  = 0
    answers_created   = 0

    print(f"Running simulation: {n_sessions} sessions, {len(q_ids)} questions (fully random)...")

    for i in range(n_sessions):
        # Random per-student correctness probability (no IRT / difficulty)
        p_correct_student = float(rng.uniform(0.30, 0.90))
        session_len = int(np.clip(int(rng.integers(MIN_PREG, MAX_PREG + 1)), 1, len(q_ids)))

        # Random session start time spread over last 90 days
        offset_hours = float(rng.uniform(0, 90 * 24))
        started_at   = base_time + timedelta(hours=offset_hours)

        # Pick first question at random from ALL questions
        first_qid = int(rng.choice(q_ids))

        session_obj = QuizSession(
            user_id=sim_user.id,
            week=None,
            theme=None,
            difficulty=None,
            started_at=started_at,
            completed_at=started_at + timedelta(minutes=session_len * 2),
            status='completed',
        )
        db.session.add(session_obj)
        db.session.flush()  # get session_obj.id

        asked       = set()
        seq         = []          # [(question_id, is_correct), ...]
        answered_at = started_at

        for order in range(session_len):
            if order == 0:
                qid = first_qid
            else:
                # Purely random selection from all remaining questions
                pool = [q for q in q_ids if q not in asked]
                if not pool:
                    break
                qid = int(rng.choice(pool))

            asked.add(qid)

            is_correct = bool(rng.random() < p_correct_student)
            correct_ans  = 'a'   # simulation doesn't need to match real answers
            user_answer  = correct_ans if is_correct else str(rng.choice(['b', 'c', 'd']))

            answered_at  = answered_at + timedelta(seconds=int(rng.uniform(15, 120)))

            answer_obj = Answer(
                session_id=session_obj.id,
                question_id=qid,
                user_answer=user_answer,
                is_correct=is_correct,
                answered_at=answered_at,
            )
            db.session.add(answer_obj)
            answers_created += 1
            seq.append((qid, is_correct))

        # Record transitions for this session into the in-memory buffer
        for j in range(len(seq) - 1):
            y_id = seq[j][0]
            x_id = seq[j + 1][0]
            is_correct_x = seq[j + 1][1]

            trans_buf[(y_id, x_id)]['n'] += 1
            if is_correct_x:
                trans_buf[(y_id, x_id)]['n_correct'] += 1
            out_buf[y_id] += 1

        sessions_created += 1

        # Periodic commit of Answer records (transition tables flushed at end)
        if sessions_created % COMMIT_EVERY == 0:
            db.session.commit()
            print(f"  Sessions committed: {sessions_created}/{n_sessions} ...")

    # Final commit of remaining Answer/Session records
    db.session.commit()

    # Flush all accumulated transitions to DB tables
    _flush_transitions(db, QuestionTransition, QuestionOutStats,
                       trans_buf, out_buf, 'final')

    unique_transitions = len(trans_buf)
    print(f"Simulation complete: {sessions_created} sessions, {answers_created} answers, "
          f"{unique_transitions} unique transitions.")
    return sessions_created, answers_created, unique_transitions
