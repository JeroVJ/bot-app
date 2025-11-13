#!/bin/bash

echo "======================================"
echo "  Quiz App - Quick Start"
echo "======================================"
echo ""

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    cd backend
    python3 -m venv venv
    cd ..
fi

# Activate virtual environment and install backend dependencies
echo "📥 Installing backend dependencies..."
cd backend
source venv/bin/activate
pip install -q -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
fi

# Initialize database
if [ ! -f "quiz_app.db" ]; then
    echo "🗄️  Initializing database..."
    python init_db.py
fi

cd ..

# Install frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "📥 Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Create frontend .env if it doesn't exist
if [ ! -f "frontend/.env" ]; then
    echo "⚙️  Creating frontend .env..."
    echo "REACT_APP_API_URL=http://localhost:5000/api" > frontend/.env
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "======================================"
echo "  To start the application:"
echo "======================================"
echo ""
echo "Terminal 1 (Backend):"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  python app.py"
echo ""
echo "Terminal 2 (Frontend):"
echo "  cd frontend"
echo "  npm start"
echo ""
echo "======================================"
echo "  Default accounts:"
echo "======================================"
echo ""
echo "Teacher:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Students:"
echo "  Username: 202012341-3"
echo "  Password: student123"
echo ""
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
