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
from models import db, User, Question
from preguntas_loader_simple import Preguntas

def init_db():
    """Initialize database with tables and default data"""
    app = create_app('production')
    
    with app.app_context():
        # Create tables if they don't exist (SAFE - doesn't drop)
        print("Checking database tables...")
        db.create_all()
        print("✓ Tables verified/created")
        
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
