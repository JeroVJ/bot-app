@echo off
REM Script para iniciar el backend en Windows
echo ========================================
echo   Quiz App - Backend Server
echo ========================================
echo.

cd /d %~dp0

REM Activar entorno virtual
call venv\Scripts\activate.bat

REM Verificar que las dependencias están instaladas
python -c "import flask" 2>nul
if errorlevel 1 (
    echo [ERROR] Dependencias no instaladas. Ejecuta setup_backend.bat primero
    pause
    exit /b 1
)

REM Verificar que existe Preguntas.tex
if not exist "Preguntas.tex" (
    echo [ERROR] No se encuentra Preguntas.tex
    pause
    exit /b 1
)

REM Iniciar servidor
echo [INFO] Iniciando servidor backend...
echo [INFO] Backend disponible en: http://localhost:5000
echo [INFO] Presiona Ctrl+C para detener
echo.
python app.py

pause
