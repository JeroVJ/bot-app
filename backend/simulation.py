"""
Simulation engine for seeding the quiz database with synthetic student sessions.
"""
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

N_SESSIONS_DEFAULT = 3000
LAMBDA_PREG = 10
MIN_PREG = 5
MAX_PREG = 10
EPSILON = 0.3
ALPHA = 1.5
DELTA_MAP = {1: -0.7, 2: 0.0, 3: 0.7}

SIM_USER_NUMBER = 'sim_data'
SIM_USER_NAME = 'Datos Simulados'
SIM_USER_EMAIL = 'simulacion@quiz.app'


def get_or_create_sim_user(db, User):
    user = User.query.filter_by(student_number=SIM_USER_NUMBER).first()
    if not user:
        user = User(
            student_number=SIM_USER_NUMBER,
            role='simulacion',
            name=SIM_USER_NAME,
            email=SIM_USER_EMAIL
        )
        user.set_password('sim_not_for_login_xk39f')
        db.session.add(user)
        db.session.commit()
        print(f"Created simulation user (id={user.id})")
    return user


def run_simulation(db, User, Question, QuizSession, Answer, n_sessions=N_SESSIONS_DEFAULT, seed=42):
    """
    Simulate n_sessions quiz sessions and save them to the DB.
    Returns (sessions_created, answers_created).
    """
    rng = np.random.default_rng(seed)

    questions = Question.query.all()
    if not questions:
        print("No questions found in DB. Run init_db.py first.")
        return 0, 0

    df_q = {
        q.question_id: {'question_id': q.question_id, 'tema': q.theme,
                         'dificultad': q.difficulty, 'week': q.week,
                         'correct_answer': q.correct_answer}
        for q in questions
    }
    q_ids = list(df_q.keys())
    easy_ids = [qid for qid, data in df_q.items() if data['dificultad'] == 1]
    if not easy_ids:
        easy_ids = q_ids

    sim_user = get_or_create_sim_user(db, User)

    existing = QuizSession.query.filter_by(user_id=sim_user.id).count()
    if existing > 0:
        print(f"Simulation already ran ({existing} sessions exist). Skipping.")
        return existing, 0

    n_q_total = len(q_ids)
    base_time = datetime.utcnow() - timedelta(days=90)

    sessions_created = 0
    answers_created = 0

    print(f"Running simulation: {n_sessions} sessions with {n_q_total} questions...")

    for i in range(n_sessions):
        theta = float(rng.normal(0, 1))
        L = int(np.clip(rng.poisson(LAMBDA_PREG), MIN_PREG, MAX_PREG))
        L = min(L, n_q_total)

        first_qid = int(rng.choice(easy_ids))
        session_week = df_q[first_qid]['week']
        session_theme = df_q[first_qid]['tema']

        offset_hours = float(rng.uniform(0, 90 * 24))
        started_at = base_time + timedelta(hours=offset_hours)

        session_obj = QuizSession(
            user_id=sim_user.id,
            week=session_week,
            theme=session_theme,
            difficulty=1,
            started_at=started_at,
            completed_at=started_at + timedelta(minutes=int(L * 2)),
            status='completed'
        )
        db.session.add(session_obj)
        db.session.flush()

        asked = set()
        current_qid = None
        session_diffs = []
        answered_at = started_at

        for order in range(L):
            if order == 0:
                avail = [q for q in easy_ids if q not in asked] or [q for q in q_ids if q not in asked]
                if not avail:
                    break
                qid = int(rng.choice(avail))
            else:
                remaining = [q for q in q_ids if q not in asked]
                if not remaining:
                    break
                if rng.random() < EPSILON:
                    tema_cur = df_q[current_qid]['tema']
                    if rng.random() < 0.5:
                        other = [q for q in remaining if df_q[q]['tema'] != tema_cur]
                        qid = int(rng.choice(other)) if other else int(rng.choice(remaining))
                    else:
                        same = [q for q in remaining if df_q[q]['tema'] == tema_cur]
                        qid = int(rng.choice(same)) if same else int(rng.choice(remaining))
                else:
                    tema_cur = df_q[current_qid]['tema']
                    diff_cur = df_q[current_qid]['dificultad']
                    cand = [q for q in remaining if df_q[q]['tema'] == tema_cur and df_q[q]['dificultad'] >= diff_cur]
                    if not cand:
                        cand = [q for q in remaining if df_q[q]['tema'] == tema_cur]
                    if not cand:
                        cand = [q for q in remaining if df_q[q]['dificultad'] >= diff_cur]
                    if not cand:
                        cand = remaining
                    qid = int(rng.choice(cand))

            asked.add(qid)
            current_qid = qid

            d = df_q[qid]['dificultad']
            delta = DELTA_MAP.get(d, 0.0)
            p_correct = 1.0 / (1.0 + np.exp(-ALPHA * (theta - delta)))
            is_correct = bool(rng.random() < p_correct)

            correct_ans = df_q[qid]['correct_answer']
            if is_correct:
                user_answer = correct_ans
            else:
                wrong = [x for x in ['a', 'b', 'c', 'd'] if x != correct_ans]
                user_answer = str(rng.choice(wrong))

            answered_at = answered_at + timedelta(seconds=int(rng.uniform(15, 120)))

            answer_obj = Answer(
                session_id=session_obj.id,
                question_id=qid,
                user_answer=user_answer,
                is_correct=is_correct,
                answered_at=answered_at
            )
            db.session.add(answer_obj)
            answers_created += 1
            session_diffs.append(d)

        if session_diffs:
            mode_diff = max(set(session_diffs), key=session_diffs.count)
            session_obj.difficulty = mode_diff

        sessions_created += 1

        if sessions_created % 200 == 0:
            db.session.commit()
            print(f"  Simulated {sessions_created}/{n_sessions} sessions...")

    db.session.commit()
    print(f"Simulation complete: {sessions_created} sessions, {answers_created} answers")
    return sessions_created, answers_created
