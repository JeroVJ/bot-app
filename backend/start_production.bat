@echo off
REM Script para iniciar el backend en modo producción
echo ========================================
echo   Quiz App - Backend (Production)
echo ========================================
echo.

cd /d %~dp0

REM Verificar entorno virtual
if not exist "venv\" (
    echo [ERROR] No existe entorno virtual
    echo Ejecuta setup_backend.bat primero
    pause
    exit /b 1
)

REM Activar entorno virtual
call venv\Scripts\activate.bat

REM Verificar .env
if not exist ".env" (
    echo [ERROR] No existe archivo .env
    echo Copia .env.example a .env y configúralo
    pause
    exit /b 1
)

REM Verificar Preguntas.tex
if not exist "Preguntas.tex" (
    echo [ERROR] No se encuentra Preguntas.tex
    pause
    exit /b 1
)

REM Configurar para producción
set FLASK_ENV=production
set FLASK_DEBUG=0

REM Iniciar servidor
echo [INFO] Iniciando servidor backend (PRODUCCION)...
echo [INFO] Backend escuchando en: http://localhost:5000
echo [INFO] Presiona Ctrl+C para detener
echo.
python app.py

pause
