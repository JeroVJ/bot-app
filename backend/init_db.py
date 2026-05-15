#!/usr/bin/env python3
"""
Initialize the database and create initial data
SAFE VERSION - Does not drop existing tables or data
"""
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, User, Question, QuestionTransition, QuestionOutStats, Answer, RawTransition
from preguntas_loader_simple import Preguntas
from sqlalchemy import inspect, text


def _column_exists(table, column):
    """True if the given column already exists on the table."""
    insp = inspect(db.engine)
    return any(c['name'] == column for c in insp.get_columns(table))


def _ensure_column(table, column, ddl_type):
    """Add the column with ALTER TABLE if missing. Idempotent."""
    if _column_exists(table, column):
        return False
    db.session.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl_type}'))
    db.session.commit()
    print(f"  ✓ Added {table}.{column} ({ddl_type})")
    return True


def _backfill_order_in_session():
    """
    Populate answers.order_in_session for legacy rows by ordering each
    session's answers chronologically (answered_at, id). Idempotent: skips
    rows that already have a value.
    """
    sessions_with_unordered = db.session.execute(text(
        "SELECT DISTINCT session_id FROM answers WHERE order_in_session IS NULL"
    )).fetchall()
    if not sessions_with_unordered:
        return 0

    total = 0
    for (sid,) in sessions_with_unordered:
        rows = db.session.execute(text(
            "SELECT id FROM answers WHERE session_id = :sid "
            "ORDER BY answered_at, id"
        ), {'sid': sid}).fetchall()
        for idx, (aid,) in enumerate(rows):
            db.session.execute(text(
                "UPDATE answers SET order_in_session = :idx WHERE id = :aid"
            ), {'idx': idx, 'aid': aid})
            total += 1
    db.session.commit()
    print(f"  ✓ Backfilled order_in_session for {total} answers "
          f"across {len(sessions_with_unordered)} sessions")
    return total


def init_db():
    """Initialize database with tables and default data"""
    app = create_app(os.getenv('FLASK_ENV', 'development'))

    with app.app_context():
        # Create tables if they don't exist (SAFE - doesn't drop)
        print("Checking database tables...")
        db.create_all()
        print("✓ Tables verified/created")

        # Defensive ALTER TABLE for columns added after a deploy.
        # db.create_all() only creates missing tables, not missing columns.
        print("Checking column migrations...")
        _ensure_column('answers', 'order_in_session', 'INTEGER')
        _ensure_column('question_transitions', 'peso',
                       'FLOAT NOT NULL DEFAULT 0')
        _backfill_order_in_session()
        
        # Check if admin already exists
        admin = User.query.filter_by(student_number='admin').first()
        
        if not admin:
            print("Creating default teacher account...")
            teacher = User(
                student_number='admin',
                role='teacher',
                name='Administrator',
                email='admin@quiz.app'
            )
            teacher.set_password('admin123')
            db.session.add(teacher)
            db.session.commit()
            print("✓ Admin account created")
        else:
            print("✓ Admin account already exists")
        
        # Check if test students exist
        test_student = User.query.filter_by(student_number='202012341').first()
        
        if not test_student:
            print("Creating test student accounts...")
            for i in range(1, 4):
                student = User(
                    student_number=f'20201234{i}',
                    role='student',
                    name=f'Student {i}',
                    email=f'student{i}@quiz.app'
                )
                student.set_password('student123')
                db.session.add(student)
            db.session.commit()
            print("✓ Test students created")
        else:
            print("✓ Test students already exist")
        
        # Load questions from Preguntas.tex into database
        question_count = Question.query.count()
        
        if question_count == 0:
            print("Loading questions from Preguntas.tex into database...")
            loaded = 0
            for qid, data in Preguntas.items():
                question = Question(
                    question_id=qid,
                    theme=data['tema'],
                    difficulty=data['dif'],
                    correct_answer=data['res'][0] if data['res'] else 'a',
                    week=data['week'],
                    content=json.dumps(data)  # Store complete data as JSON
                )
                db.session.add(question)
                loaded += 1
                
                # Commit in batches of 100
                if loaded % 100 == 0:
                    db.session.commit()
                    print(f"  Loaded {loaded} questions...")
            
            db.session.commit()
            print(f"✓ Loaded {loaded} questions into database")
        else:
            print(f"✓ Questions already in database ({question_count} questions)")
        
        print("\n✓ Database initialization complete!")
        print("Default accounts:")
        print("  Teacher: admin / admin123")
        print("  Students: 202012341-3 / student123")

if __name__ == '__main__':
    init_db()
