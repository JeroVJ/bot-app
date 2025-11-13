import os
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

from config import config
from models import db
from auth_routes import auth_bp
from quiz_routes import quiz_bp, load_questions
from teacher_routes import teacher_bp
from preguntas_loader_simple import Preguntas, get_question_html

def create_app(config_name='development'):
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)

    # Configure CORS - allow multiple origins
    frontend_url = app.config.get('FRONTEND_URL', 'http://localhost:3000')
    allowed_origins = []

    # Split by comma if multiple URLs
    if ',' in frontend_url:
        allowed_origins = [url.strip() for url in frontend_url.split(',')]
    else:
        allowed_origins = [frontend_url]

    # Add both www and non-www versions
    expanded_origins = []
    for origin in allowed_origins:
        expanded_origins.append(origin)
        # Add www variant if not present
        if '://www.' not in origin and '://' in origin:
            expanded_origins.append(origin.replace('://', '://www.'))
        # Add non-www variant if www is present
        elif '://www.' in origin:
            expanded_origins.append(origin.replace('://www.', '://'))

    print(f"Allowed CORS origins: {expanded_origins}")

    CORS(app,
         resources={r"/api/*": {"origins": expanded_origins}},
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         allow_headers=["Content-Type", "Authorization"],
         supports_credentials=True,
         max_age=3600)

    jwt = JWTManager(app)
    Migrate(app, db)

    # JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {'error': 'Token has expired'}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {'error': 'Invalid token'}, 422

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {'error': 'Authorization token is missing'}, 401

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(teacher_bp)

    # Load questions from Preguntas.tex using simple loader
    with app.app_context():
        questions_list = []
        for qid, data in Preguntas.items():
            questions_list.append({
                'question_id': qid,
                'theme': data['tema'],
                'difficulty': data['dif'],
                'correct_answer': data['res'][0] if data['res'] else 'a',
                'week': data['week'],
                'content': data  # Guardamos la data completa para conversión lazy
            })
        load_questions(questions_list)
        print(f"✓ Loaded {len(questions_list)} questions from Preguntas.tex")

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return {'status': 'ok', 'message': 'Quiz App API is running'}, 200

    return app

if __name__ == '__main__':
    # Create app
    app = create_app(os.getenv('FLASK_ENV', 'development'))

    # Create tables
    with app.app_context():
        db.create_all()
        print("Database tables created")

        # Create a default teacher user if none exists
        from models import User
        if not User.query.filter_by(role='teacher').first():
            teacher = User(
                student_number='admin',
                role='teacher',
                name='Administrator',
                email='admin@quiz.app'
            )
            teacher.set_password('admin123')  # Change this in production!
            db.session.add(teacher)
            db.session.commit()
            print("Default teacher account created (admin/admin123)")

    # Run app
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

# For gunicorn
app = create_app(os.getenv('FLASK_ENV', 'production'))
