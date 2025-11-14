from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, QuizSession, Answer, User, Question
from datetime import datetime
import random
import json

quiz_bp = Blueprint('quiz', __name__, url_prefix='/api/quiz')

# REMOVED: In-memory storage - now using PostgreSQL
# QUESTIONS = []

def load_questions(questions_data):
    """Deprecated - questions now loaded from database"""
    pass  # Keep for backwards compatibility but doesn't do anything

@quiz_bp.route('/start', methods=['POST'])
@jwt_required()
def start_quiz():
    """Start a new quiz session"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        if not data.get('week'):
            return jsonify({'error': 'Week is required'}), 400
        
        # Create new session
        session = QuizSession(
            user_id=user_id,
            week=data['week'],
            theme=data.get('theme'),
            difficulty=data.get('difficulty'),
            status='in_progress'
        )
        
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Quiz session started',
            'session': session.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/question', methods=['POST'])
@jwt_required()
def get_question():
    """Get a quiz question based on filters"""
    try:
        from preguntas_loader_simple import get_question_html
        data = request.get_json()
        
        week = data.get('week')
        themes = data.get('themes', [])  # List of themes
        difficulty = data.get('difficulty')
        exclude_ids = data.get('exclude_ids', [])  # Already answered questions
        
        # Filter questions
        filtered_questions = []
        for q in QUESTIONS:
            # Check week
            if week and q['week'] > week:
                continue
            
            # Check if already answered
            if q['question_id'] in exclude_ids:
                continue
            
            # Check difficulty
            if difficulty and q['difficulty'] != difficulty:
                continue
            
            # Check themes
            if themes:
                question_themes = [t.strip().lower() for t in q['theme'].split(',')]
                if not any(t.lower() in question_themes for t in themes):
                    continue
            
            filtered_questions.append(q)
        
        if not filtered_questions:
            return jsonify({'message': 'No questions available', 'question': None}), 200
        
        # Select a random question
        question = random.choice(filtered_questions)
        
        # Convert to HTML only now (lazy conversion)
        html_content = get_question_html(question['content'])
        
        return jsonify({
            'question': {
                'id': question['question_id'],
                'content': html_content,
                'theme': question['theme'],
                'difficulty': question['difficulty'],
                'week': question['week']
            }
        }), 200
        
    except Exception as e:
        print(f"Error getting question: {str(e)}")
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/answer', methods=['POST'])
@jwt_required()
def submit_answer():
    """Submit an answer to a question"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['session_id', 'question_id', 'user_answer']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Verify session belongs to user
        session = QuizSession.query.filter_by(
            id=data['session_id'],
            user_id=user_id
        ).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        # Find the question to check correct answer
        question = next((q for q in QUESTIONS if q['question_id'] == data['question_id']), None)
        
        if not question:
            return jsonify({'error': 'Question not found'}), 404
        
        # Check if answer is correct
        user_answer = data['user_answer'].lower().strip()
        correct_answer = question['correct_answer'].lower().strip()
        is_correct = user_answer == correct_answer
        
        # Create answer record
        answer = Answer(
            session_id=data['session_id'],
            question_id=data['question_id'],
            user_answer=user_answer,
            is_correct=is_correct
        )
        
        db.session.add(answer)
        db.session.commit()
        
        return jsonify({
            'message': 'Answer submitted',
            'is_correct': is_correct,
            'correct_answer': correct_answer,
            'answer': answer.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/session/<int:session_id>/complete', methods=['POST'])
@jwt_required()
def complete_session(session_id):
    """Mark a quiz session as completed"""
    try:
        user_id = get_jwt_identity()
        
        # Verify session belongs to user
        session = QuizSession.query.filter_by(
            id=session_id,
            user_id=user_id
        ).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        session.status = 'completed'
        session.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Session completed',
            'session': session.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_user_sessions():
    """Get all quiz sessions for current user"""
    try:
        user_id = get_jwt_identity()
        
        sessions = QuizSession.query.filter_by(user_id=user_id).order_by(
            QuizSession.started_at.desc()
        ).all()
        
        return jsonify({
            'sessions': [s.to_dict() for s in sessions]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/session/<int:session_id>', methods=['GET'])
@jwt_required()
def get_session_details(session_id):
    """Get detailed information about a session"""
    try:
        user_id = get_jwt_identity()
        
        session = QuizSession.query.filter_by(
            id=session_id,
            user_id=user_id
        ).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        session_dict = session.to_dict()
        session_dict['answers'] = [a.to_dict() for a in session.answers]
        
        return jsonify({'session': session_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/count', methods=['POST'])
def count_questions():
    """Count available questions based on filters"""
    try:
        data = request.get_json()
        
        week = data.get('week')
        themes = data.get('themes', [])
        difficulty = data.get('difficulty')
        
        # Filter questions
        count = 0
        for q in QUESTIONS:
            if week and q['week'] > week:
                continue
            if difficulty and q['difficulty'] != difficulty:
                continue
            if themes:
                question_themes = [t.strip().lower() for t in q['theme'].split(',')]
                if not any(t.lower() in question_themes for t in themes):
                    continue
            count += 1
        
        return jsonify({'count': count}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/themes', methods=['GET'])
def get_available_themes():
    """Get all available themes from database"""
    try:
        week = request.args.get('week', type=int)
        
        # Query questions from database
        query = Question.query
        if week is not None:
            query = query.filter(Question.week <= week)
        
        questions = query.all()
        
        themes = set()
        for q in questions:
            question_themes = [t.strip() for t in q.theme.split(',')]
            themes.update(question_themes)
        
        return jsonify({
            'themes': sorted(list(themes))
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/difficulties', methods=['GET'])
def get_available_difficulties():
    """Get available difficulties for given themes and week from database"""
    try:
        week = request.args.get('week', type=int)
        theme = request.args.get('theme')  # Changed from themes to theme (singular)
        
        # Query questions from database
        query = Question.query
        if week is not None:
            query = query.filter(Question.week <= week)
        
        if theme:
            # Filter by theme (handle comma-separated themes in database)
            query = query.filter(Question.theme.contains(theme))
        
        questions = query.all()
        
        difficulties = set()
        for q in questions:
            difficulties.add(q.difficulty)
        
        return jsonify({
            'difficulties': sorted(list(difficulties))
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_quiz():
    """Generate a quiz with questions from database"""
    try:
        data = request.get_json()
        week = data.get('week')
        theme = data.get('theme')
        difficulty = data.get('difficulty')
        num_questions = data.get('num_questions', 10)
        
        # Query questions from database
        query = Question.query
        
        if week:
            query = query.filter(Question.week <= week)
        if theme:
            query = query.filter(Question.theme.contains(theme))
        if difficulty:
            query = query.filter(Question.difficulty == difficulty)
        
        # Get all matching questions
        all_questions = query.all()
        
        if len(all_questions) == 0:
            return jsonify({'error': 'No questions found with these criteria'}), 404
        
        # Randomly select questions
        selected = random.sample(all_questions, min(num_questions, len(all_questions)))
        
        # Convert to dict with content
        questions_response = []
        for q in selected:
            content_data = json.loads(q.content)
            from preguntas_loader_simple import get_question_html
            
            questions_response.append({
                'question_id': q.question_id,
                'question_text': get_question_html(content_data),
                'options': content_data.get('opciones', []),
                'correct_answer': q.correct_answer,
                'theme': q.theme,
                'difficulty': q.difficulty,
                'week': q.week
            })
        
        return jsonify({
            'questions': questions_response,
            'total': len(questions_response)
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@quiz_bp.route('/submit', methods=['POST'])
@jwt_required()
def submit_quiz():
    """Submit quiz answers and save session"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Create session
        session = QuizSession(
            user_id=user_id,
            week=data.get('week'),
            theme=data.get('theme'),
            difficulty=data.get('difficulty'),
            status='completed',
            completed_at=datetime.utcnow()
        )
        db.session.add(session)
        db.session.flush()  # Get session ID
        
        # Save answers
        answers = data.get('answers', [])
        for ans in answers:
            answer = Answer(
                session_id=session.id,
                question_id=ans.get('questionId'),
                user_answer=ans.get('answer'),
                is_correct=ans.get('isCorrect', False)
            )
            db.session.add(answer)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Quiz submitted successfully',
            'session': session.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
