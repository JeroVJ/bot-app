#!/bin/bash

echo "======================================"
echo "  PostgreSQL Setup for Quiz App"
echo "======================================"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    brew install postgresql@16
    brew services start postgresql@16
else
    echo "✓ PostgreSQL is already installed"
fi

# Database configuration
DB_NAME="quiz_app"
DB_USER="quiz_user"
DB_PASS="quiz_password_2024"

echo ""
echo "🗄️  Creating database and user..."

# Create database and user
psql postgres << EOF
-- Drop if exists (for clean setup)
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create user and database
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ PostgreSQL setup complete!"
    echo ""
    echo "======================================"
    echo "  Database Configuration"
    echo "======================================"
    echo "Database: $DB_NAME"
    echo "User: $DB_USER"
    echo "Password: $DB_PASS"
    echo "Host: localhost"
    echo "Port: 5432"
    echo ""
    echo "Connection URL:"
    echo "postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
    echo ""
    echo "======================================"
    echo "  Next Steps"
    echo "======================================"
    echo ""
    echo "1. Update backend/.env with:"
    echo "   DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
    echo ""
    echo "2. Install psycopg2:"
    echo "   cd backend"
    echo "   source venv/bin/activate"
    echo "   pip install psycopg2-binary"
    echo ""
    echo "3. Initialize database:"
    echo "   python init_db.py"
    echo ""
else
    echo "❌ Error creating database. Please check PostgreSQL installation."
fi
