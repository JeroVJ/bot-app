#!/bin/bash

echo "======================================"
echo "  Quiz App - Docker Setup"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    echo "   Instala Docker desde: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose no está instalado"
    exit 1
fi

echo "✓ Docker está instalado"
echo ""

# Start PostgreSQL container
echo "🐘 Iniciando PostgreSQL en Docker..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

# Check if PostgreSQL is healthy
if docker-compose ps | grep -q "healthy"; then
    echo "✅ PostgreSQL está listo!"
else
    echo "⏳ PostgreSQL aún está iniciando..."
    sleep 5
fi

echo ""
echo "======================================"
echo "  Información de la Base de Datos"
echo "======================================"
echo ""
echo "Host: localhost"
echo "Port: 5432"
echo "Database: quiz_app"
echo "User: quiz_user"
echo "Password: quiz_password_2024"
echo ""
echo "Connection URL:"
echo "postgresql://quiz_user:quiz_password_2024@localhost:5432/quiz_app"
echo ""

# Setup backend
echo "======================================"
echo "  Configurando Backend"
echo "======================================"
echo ""

cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creando entorno virtual..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Instalando dependencias..."
pip install -q -r requirements.txt

# Copy .env file
if [ ! -f ".env" ]; then
    echo "⚙️  Creando archivo .env..."
    cp .env.docker .env
fi

# Initialize database
echo "🗄️  Inicializando base de datos..."
python init_db.py

cd ..

# Setup frontend
echo ""
echo "======================================"
echo "  Configurando Frontend"
echo "======================================"
echo ""

cd frontend

if [ ! -d "node_modules" ]; then
    echo "📥 Instalando dependencias de Node..."
    npm install
fi

if [ ! -f ".env" ]; then
    echo "⚙️  Creando archivo .env del frontend..."
    echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
fi

cd ..

echo ""
echo "✅ ¡Setup completo!"
echo ""
echo "======================================"
echo "  Servicios Disponibles"
echo "======================================"
echo ""
echo "PostgreSQL:  localhost:5432"
echo "Adminer:     http://localhost:8080"
echo "  (Interfaz web para administrar la BD)"
echo ""
echo "======================================"
echo "  Para iniciar la aplicación"
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
echo "  Comandos útiles de Docker"
echo "======================================"
echo ""
echo "Ver logs de PostgreSQL:"
echo "  docker-compose logs -f postgres"
echo ""
echo "Detener PostgreSQL:"
echo "  docker-compose stop"
echo ""
echo "Reiniciar PostgreSQL:"
echo "  docker-compose restart postgres"
echo ""
echo "Eliminar todo (incluyendo datos):"
echo "  docker-compose down -v"
echo ""
echo "Acceder a psql:"
echo "  docker-compose exec postgres psql -U quiz_user -d quiz_app"
echo ""
