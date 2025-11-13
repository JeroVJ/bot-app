from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, QuizSession, Answer
from sqlalchemy import func, desc
from datetime import datetime, timedelta

teacher_bp = Blueprint('teacher', __name__, url_prefix='/api/teacher')

def check_teacher_role():
    """Check if current user is a teacher"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    return user and user.role == 'teacher'

@teacher_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """Get overall statistics for teacher dashboard"""
    try:
        if not check_teacher_role():
            return jsonify({'error': 'Unauthorized - Teacher access only'}), 403
        
        # Total students
        total_students = User.query.filter_by(role='student').count()
        
        # Total sessions
        total_sessions = QuizSession.query.count()
        
        # Completed sessions
        completed_sessions = QuizSession.query.filter_by(status='completed').count()
        
        # Total answers
        total_answers = Answer.query.count()
        
        # Correct answers
        correct_answers = Answer.query.filter_by(is_correct=True).count()
        
        # Average accuracy
        accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0
        
        # Active students (students with sessions in last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_students = db.session.query(QuizSession.user_id).filter(
            QuizSession.started_at >= week_ago
        ).distinct().count()
        
        return jsonify({
            'stats': {
                'total_students': total_students,
                'active_students': active_students,
                'total_sessions': total_sessions,
                'completed_sessions': completed_sessions,
                'total_questions_answered': total_answers,
                'correct_answers': correct_answers,
                'average_accuracy': round(accuracy, 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teacher_bp.route('/students', methods=['GET'])
@jwt_required()
def get_all_students():
    """Get list of all students with their statistics"""
    try:
        if not check_teacher_role():
            return jsonify({'error': 'Unauthorized - Teacher access only'}), 403
        
        students = User.query.filter_by(role='student').all()
        
        students_data = []
        for student in students:
            # Get student statistics
            total_sessions = QuizSession.query.filter_by(user_id=student.id).count()
            completed_sessions = QuizSession.query.filter_by(
                user_id=student.id,
                status='completed'
            ).count()
            
            # Get answers statistics
            total_answers = db.session.query(Answer).join(QuizSession).filter(
                QuizSession.user_id == student.id
            ).count()
            
            correct_answers = db.session.query(Answer).join(QuizSession).filter(
                QuizSession.user_id == student.id,
                Answer.is_correct == True
            ).count()
            
            accuracy = (correct_answers / total_answers * 100) if total_answers > 0 else 0
            
            # Last activity
            last_session = QuizSession.query.filter_by(
                user_id=student.id
            ).order_by(desc(QuizSession.started_at)).first()
            
            students_data.append({
                'id': student.id,
                'student_number': student.student_number,
                'name': student.name,
                'email': student.email,
                'created_at': student.created_at.isoformat() if student.created_at else None,
                'stats': {
                    'total_sessions': total_sessions,
                    'completed_sessions': completed_sessions,
                    'total_answers': total_answers,
                    'correct_answers': correct_answers,
                    'accuracy': round(accuracy, 2)
                },
                'last_activity': last_session.started_at.isoformat() if last_session else None
            })
        
        return jsonify({'students': students_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teacher_bp.route('/student/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_details(student_id):
    """Get detailed information about a specific student"""
    try:
        if not check_teacher_role():
            return jsonify({'error': 'Unauthorized - Teacher access only'}), 403
        
        student = User.query.filter_by(id=student_id, role='student').first()
        
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        
        # Get all sessions
        sessions = QuizSession.query.filter_by(user_id=student_id).order_by(
            desc(QuizSession.started_at)
        ).all()
        
        sessions_data = []
        for session in sessions:
            session_dict = session.to_dict()
            session_dict['answers'] = [a.to_dict() for a in session.answers]
            sessions_data.append(session_dict)
        
        # Get performance by theme
        theme_performance = db.session.query(
            QuizSession.theme,
            func.count(Answer.id).label('total'),
            func.sum(func.cast(Answer.is_correct, db.Integer)).label('correct')
        ).join(Answer).filter(
            QuizSession.user_id == student_id,
            QuizSession.theme.isnot(None)
        ).group_by(QuizSession.theme).all()
        
        theme_stats = []
        for theme, total, correct in theme_performance:
            accuracy = (correct / total * 100) if total > 0 else 0
            theme_stats.append({
                'theme': theme,
                'total_questions': total,
                'correct_answers': correct or 0,
                'accuracy': round(accuracy, 2)
            })
        
        # Get performance by difficulty
        difficulty_performance = db.session.query(
            QuizSession.difficulty,
            func.count(Answer.id).label('total'),
            func.sum(func.cast(Answer.is_correct, db.Integer)).label('correct')
        ).join(Answer).filter(
            QuizSession.user_id == student_id,
            QuizSession.difficulty.isnot(None)
        ).group_by(QuizSession.difficulty).all()
        
        difficulty_stats = []
        for difficulty, total, correct in difficulty_performance:
            accuracy = (correct / total * 100) if total > 0 else 0
            difficulty_stats.append({
                'difficulty': difficulty,
                'total_questions': total,
                'correct_answers': correct or 0,
                'accuracy': round(accuracy, 2)
            })
        
        return jsonify({
            'student': student.to_dict(),
            'sessions': sessions_data,
            'performance': {
                'by_theme': theme_stats,
                'by_difficulty': difficulty_stats
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teacher_bp.route('/dashboard/theme-stats', methods=['GET'])
@jwt_required()
def get_theme_statistics():
    """Get statistics by theme across all students"""
    try:
        if not check_teacher_role():
            return jsonify({'error': 'Unauthorized - Teacher access only'}), 403
        
        theme_stats = db.session.query(
            QuizSession.theme,
            func.count(Answer.id).label('total'),
            func.sum(func.cast(Answer.is_correct, db.Integer)).label('correct'),
            func.count(func.distinct(QuizSession.user_id)).label('students')
        ).join(Answer).filter(
            QuizSession.theme.isnot(None)
        ).group_by(QuizSession.theme).all()
        
        stats_data = []
        for theme, total, correct, students in theme_stats:
            accuracy = (correct / total * 100) if total > 0 else 0
            stats_data.append({
                'theme': theme,
                'total_questions': total,
                'correct_answers': correct or 0,
                'accuracy': round(accuracy, 2),
                'students_attempted': students
            })
        
        # Sort by total questions descending
        stats_data.sort(key=lambda x: x['total_questions'], reverse=True)
        
        return jsonify({'theme_stats': stats_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teacher_bp.route('/dashboard/difficulty-stats', methods=['GET'])
@jwt_required()
def get_difficulty_statistics():
    """Get statistics by difficulty across all students"""
    try:
        if not check_teacher_role():
            return jsonify({'error': 'Unauthorized - Teacher access only'}), 403
        
        difficulty_stats = db.session.query(
            QuizSession.difficulty,
            func.count(Answer.id).label('total'),
            func.sum(func.cast(Answer.is_correct, db.Integer)).label('correct')
        ).join(Answer).filter(
            QuizSession.difficulty.isnot(None)
        ).group_by(QuizSession.difficulty).all()
        
        stats_data = []
        for difficulty, total, correct in difficulty_stats:
            accuracy = (correct / total * 100) if total > 0 else 0
            stats_data.append({
                'difficulty': difficulty,
                'total_questions': total,
                'correct_answers': correct or 0,
                'accuracy': round(accuracy, 2)
            })
        
        # Sort by difficulty
        stats_data.sort(key=lambda x: x['difficulty'])
        
        return jsonify({'difficulty_stats': stats_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@teacher_bp.route('/dashboard/recent-activity', methods=['GET'])
@jwt_required()
def get_recent_activity():
    """Get recent quiz activity"""
    try:
        if not check_teacher_role():
            return jsonify({'error': 'Unauthorized - Teacher access only'}), 403
        
        # Get recent sessions with user info
        recent_sessions = db.session.query(QuizSession, User).join(
            User, QuizSession.user_id == User.id
        ).order_by(desc(QuizSession.started_at)).limit(20).all()
        
        activity_data = []
        for session, user in recent_sessions:
            session_dict = session.to_dict()
            session_dict['student'] = {
                'student_number': user.student_number,
                'name': user.name
            }
            activity_data.append(session_dict)
        
        return jsonify({'recent_activity': activity_data}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
