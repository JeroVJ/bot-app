#!/usr/bin/env python3
"""
Initialize the database and create initial data
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, User

def init_db():
    """Initialize database with tables and default data"""
    app = create_app('development')
    
    with app.app_context():
        # Drop all tables (BE CAREFUL IN PRODUCTION!)
        print("Dropping all tables...")
        db.drop_all()
        
        # Create all tables
        print("Creating all tables...")
        db.create_all()
        
        # Create default teacher
        print("Creating default teacher account...")
        teacher = User(
            student_number='admin',
            role='teacher',
            name='Administrator',
            email='admin@quiz.app'
        )
        teacher.set_password('admin123')
        db.session.add(teacher)
        
        # Create some test students
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
        print("\n✓ Database initialized successfully!")
        print("\nDefault accounts:")
        print("  Teacher: admin / admin123")
        print("  Students: 202012341-3 / student123")

if __name__ == '__main__':
    init_db()
