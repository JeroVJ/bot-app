"""
Pytest fixtures: app Flask en modo testing con SQLite in-memory aislado por test.
"""
import os
import sys
import pytest

# Asegurar que el directorio backend/ esté en sys.path para importar app/models
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Config mínima para que app no intente cargar Preguntas.tex pesado
os.environ.setdefault('FLASK_ENV', 'development')
os.environ.setdefault('DATABASE_URL', 'sqlite:///:memory:')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt')
os.environ.setdefault('SECRET_KEY', 'test-secret')


@pytest.fixture()
def app():
    from app import create_app
    from models import db

    app = create_app('development')
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def db_session(app):
    from models import db
    return db.session
