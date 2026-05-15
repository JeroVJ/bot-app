"""
Tests del pipeline TABLA 1 → TABLA 2 → grafo, sobre un dataset de juguete
con valores calculados a mano (ver fixtures/toy_dataset.py).
"""
import json
import math
from datetime import datetime, timedelta

import pytest

from tests.fixtures.toy_dataset import (
    SESSIONS, EXPECTED_AGG, EXPECTED_RAW_COUNT, EXPECTED_UNIQUE_PAIRS,
)


def _seed_toy_data(db):
    """Inserta usuarios, preguntas y sesiones del fixture en la BD."""
    from models import User, Question, QuizSession, Answer

    # 5 preguntas con metadata trivial
    for qid in range(1, 6):
        db.session.add(Question(
            question_id=qid,
            theme="test",
            difficulty=1,
            correct_answer='a',
            week=1,
            content=json.dumps({}),
        ))

    # 4 usuarios sintéticos (uno por user_idx del fixture)
    users_by_idx = {}
    for uidx in {s[0] for s in SESSIONS}:
        u = User(
            student_number=f"sim_{uidx:04d}",
            role='simulacion',
            name=f"Sim {uidx}",
        )
        u.set_password('x')
        db.session.add(u)
        db.session.flush()
        users_by_idx[uidx] = u

    # Sesiones en orden cronológico estable
    base_time = datetime(2025, 1, 1)
    session_ids = []
    for s_idx, (uidx, answers) in enumerate(SESSIONS):
        user = users_by_idx[uidx]
        session = QuizSession(
            user_id=user.id,
            status='completed',
            started_at=base_time + timedelta(hours=s_idx),
            completed_at=base_time + timedelta(hours=s_idx, minutes=10),
        )
        db.session.add(session)
        db.session.flush()
        session_ids.append(session.id)

        for order, (qid, ok) in enumerate(answers):
            db.session.add(Answer(
                session_id=session.id,
                question_id=qid,
                user_answer='a' if ok else 'b',
                is_correct=ok,
                answered_at=base_time + timedelta(hours=s_idx, minutes=order),
                order_in_session=order,
            ))

    db.session.commit()
    return session_ids


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_rebuild_full_produces_expected_raw_count(app):
    from models import db, RawTransition
    from graph_pipeline import rebuild_full

    _seed_toy_data(db)
    stats = rebuild_full(db)

    assert stats['raw_transitions'] == EXPECTED_RAW_COUNT
    assert stats['unique_pairs'] == EXPECTED_UNIQUE_PAIRS
    assert RawTransition.query.count() == EXPECTED_RAW_COUNT


def test_first_attempt_filter_drops_repeats(app):
    """
    La sesión S2 de U1 contiene (2→3), pero U1 ya vio q3 como destino en S1.
    Esa transición no debe aparecer en RawTransition.
    """
    from models import db, RawTransition, User

    _seed_toy_data(db)
    from graph_pipeline import rebuild_full
    rebuild_full(db)

    u1 = User.query.filter_by(student_number='sim_0001').first()
    u1_rows = RawTransition.query.filter_by(user_id=u1.id).all()
    # U1 debería tener exactamente las 2 transiciones de S1: (1→2) y (2→3).
    # La (2→3) de S2 se descarta porque q3 ya fue destino.
    assert len(u1_rows) == 2
    pairs = sorted((r.question_from_id, r.question_to_id) for r in u1_rows)
    assert pairs == [(1, 2), (2, 3)]


def test_aggregate_counts_match_manual(app):
    from models import db, QuestionTransition
    from graph_pipeline import rebuild_full

    _seed_toy_data(db)
    rebuild_full(db)

    rows = {(t.question_from_id, t.question_to_id):
            {'n': t.total_transiciones, 'c': t.total_correctas}
            for t in QuestionTransition.query.all()}

    assert rows == EXPECTED_AGG


def test_weights_are_laplace_smoothed_and_nonneg(app):
    from models import db, QuestionTransition
    from graph_pipeline import rebuild_full

    _seed_toy_data(db)
    rebuild_full(db)

    for t in QuestionTransition.query.all():
        n, c, peso = t.total_transiciones, t.total_correctas, t.peso
        expected = -math.log((c + 1) / (n + 2))
        assert peso >= 0, f"peso negativo en ({t.question_from_id},{t.question_to_id})"
        assert math.isfinite(peso), "peso no finito"
        assert peso == pytest.approx(expected, abs=1e-9), \
            f"peso esperado {expected}, got {peso}"


def test_zero_correct_does_not_blow_up(app):
    """
    Casos con c=0 (p=0) son los que rompen Dijkstra sin Laplace.
    Verificamos que (4,5) y (3,4) — ambos con 0 aciertos — tienen peso finito.
    """
    from models import db, QuestionTransition
    from graph_pipeline import rebuild_full

    _seed_toy_data(db)
    rebuild_full(db)

    for pair in [(4, 5), (3, 4)]:
        t = QuestionTransition.query.filter_by(
            question_from_id=pair[0], question_to_id=pair[1]
        ).first()
        assert t.total_correctas == 0
        assert math.isfinite(t.peso)
        assert t.peso > 0


def test_dijkstra_smoke(app):
    """nx.shortest_path debe funcionar sobre el grafo del fixture."""
    from models import db, Question
    from graph_pipeline import rebuild_full
    from graph_engine import QuizGraph

    _seed_toy_data(db)
    rebuild_full(db)

    g = QuizGraph()
    g.build(db, Question)
    assert g.G is not None
    # Pares conectados según TABLA 2: 1→2→3→4→5→1, etc. Probamos 1→3.
    result = g.get_shortest_path(1, 3)
    assert result['found'] is True
    assert result['path'][0] == 1
    assert result['path'][-1] == 3
    assert result['total_weight'] is not None
    assert result['total_weight'] >= 0


def test_incremental_ingest_matches_rebuild(app):
    """
    Si poblamos las mismas sesiones con ingest_session una por una, el estado
    final de TABLA 1 y TABLA 2 debe ser idéntico al de rebuild_full.
    """
    from models import db, RawTransition, QuestionTransition
    from graph_pipeline import ingest_session

    session_ids = _seed_toy_data(db)
    for sid in session_ids:
        ingest_session(db, sid)

    assert RawTransition.query.count() == EXPECTED_RAW_COUNT

    rows = {(t.question_from_id, t.question_to_id):
            {'n': t.total_transiciones, 'c': t.total_correctas}
            for t in QuestionTransition.query.all()}
    assert rows == EXPECTED_AGG


def test_health_reports_no_negative_weights(app):
    from models import db, Question
    from graph_pipeline import rebuild_full
    from graph_engine import QuizGraph

    _seed_toy_data(db)
    rebuild_full(db)

    g = QuizGraph()
    g.build(db, Question)
    health = g.get_health(sample_dijkstra=False)

    assert health['built'] is True
    assert health['weight_stats']['any_negative'] is False
    assert health['weight_stats']['any_non_finite'] is False
