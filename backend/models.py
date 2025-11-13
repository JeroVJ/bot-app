from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import bcrypt

db = SQLAlchemy()

class User(db.Model):
    """User model for authentication"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    student_number = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')  # 'student' or 'teacher'
    name = db.Column(db.String(100))
    email = db.Column(db.String(120), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    quiz_sessions = db.relationship('QuizSession', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'student_number': self.student_number,
            'role': self.role,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class QuizSession(db.Model):
    """Quiz session model to track student progress"""
    __tablename__ = 'quiz_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    week = db.Column(db.Integer)
    theme = db.Column(db.String(200))
    difficulty = db.Column(db.Integer)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='in_progress')  # 'in_progress', 'completed', 'abandoned'
    
    # Relationships
    answers = db.relationship('Answer', backref='session', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert session to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'week': self.week,
            'theme': self.theme,
            'difficulty': self.difficulty,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'status': self.status,
            'total_questions': len(self.answers),
            'correct_answers': sum(1 for a in self.answers if a.is_correct)
        }

class Answer(db.Model):
    """Answer model to store student responses"""
    __tablename__ = 'answers'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('quiz_sessions.id'), nullable=False)
    question_id = db.Column(db.Integer, nullable=False)
    user_answer = db.Column(db.String(10))
    is_correct = db.Column(db.Boolean, nullable=False)
    answered_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert answer to dictionary"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'question_id': self.question_id,
            'user_answer': self.user_answer,
            'is_correct': self.is_correct,
            'answered_at': self.answered_at.isoformat() if self.answered_at else None
        }

class Question(db.Model):
    """Question model to store quiz questions"""
    __tablename__ = 'questions'
    
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, unique=True, nullable=False)
    theme = db.Column(db.String(200), nullable=False)
    difficulty = db.Column(db.Integer, nullable=False)
    correct_answer = db.Column(db.String(10), nullable=False)
    week = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)  # LaTeX content
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Convert question to dictionary"""
        return {
            'id': self.id,
            'question_id': self.question_id,
            'theme': self.theme,
            'difficulty': self.difficulty,
            'correct_answer': self.correct_answer,
            'week': self.week,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
