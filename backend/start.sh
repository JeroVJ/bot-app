#!/bin/bash
# Railway startup script

echo "Initializing database..."
python init_db.py

echo "Starting gunicorn..."
exec gunicorn 'app:create_app()' --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 120
