#!/bin/bash

echo "======================================"
echo "  Quiz App - Solución de Problemas"
echo "======================================"
echo ""

# Backend
echo "🔧 Arreglando Backend..."
cd backend

# Activar entorno virtual
source venv/bin/activate

# Instalar dependencias una por una (sin psycopg2 primero)
echo "📦 Instalando dependencias del backend..."
pip install --upgrade pip
pip install Flask Flask-CORS Flask-SQLAlchemy Flask-JWT-Extended Flask-Migrate python-dotenv bcrypt pypandoc gunicorn

# Intentar instalar psycopg2-binary con diferentes métodos
echo "🐘 Instalando psycopg2..."
pip install psycopg2-binary --no-build-isolation || \
pip install psycopg2-binary==2.9.10 || \
pip install psycopg2-binary==2.9.7 || \
echo "⚠️  No se pudo instalar psycopg2, pero puedes usar SQLite"

# Copiar .env si no existe
if [ ! -f ".env" ]; then
    cp .env.docker .env
fi

echo "✅ Backend configurado"
cd ..

# Frontend
echo ""
echo "🔧 Arreglando Frontend..."
cd frontend

# Actualizar .env con la variable correcta
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Reinstalar node_modules si hay problemas
if [ -d "node_modules" ]; then
    echo "🗑️  Limpiando node_modules antiguos..."
    rm -rf node_modules package-lock.json
fi

echo "📦 Instalando dependencias del frontend..."
npm install

echo "✅ Frontend configurado"
cd ..

echo ""
echo "======================================"
echo "  ✅ ¡Todo listo!"
echo "======================================"
echo ""
echo "Ahora ejecuta:"
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
