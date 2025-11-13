# Quiz App Backend

Backend API para la aplicación de práctica de ejercicios con chatbot.

## Características

- 🔐 Autenticación con JWT
- 👥 Sistema de roles (Estudiantes y Profesores)
- 📊 Dashboard para profesores con estadísticas
- 💾 Base de datos SQLAlchemy (SQLite/PostgreSQL)
- 🎯 Sistema de quiz con preguntas de múltiple opción
- 📈 Seguimiento de progreso de estudiantes

## Estructura del Proyecto

```
backend/
├── app.py                 # Aplicación principal
├── config.py             # Configuración
├── models.py             # Modelos de base de datos
├── utils.py              # Utilidades
├── auth_routes.py        # Rutas de autenticación
├── quiz_routes.py        # Rutas del quiz
├── teacher_routes.py     # Rutas del dashboard de profesores
├── init_db.py           # Script de inicialización de BD
├── requirements.txt      # Dependencias
└── .env                 # Variables de entorno
```

## Instalación

### 1. Crear entorno virtual

```bash
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Instalar Pandoc

El backend requiere Pandoc para convertir LaTeX a HTML:

```bash
# Ubuntu/Debian
sudo apt-get install pandoc

# macOS
brew install pandoc

# Windows
# Descargar desde https://pandoc.org/installing.html
```

### 4. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores
```

### 5. Copiar archivo de preguntas

```bash
# Copiar Preguntas.tex al directorio backend
cp path/to/Preguntas.tex .
```

### 6. Inicializar base de datos

```bash
python init_db.py
```

Esto creará:
- Cuenta de profesor: `admin` / `admin123`
- Cuentas de estudiantes de prueba: `202012341-3` / `student123`

## Ejecutar el servidor

```bash
python app.py
```

El servidor estará disponible en `http://localhost:5000`

## API Endpoints

### Autenticación

#### POST /api/auth/register
Registrar nuevo usuario
```json
{
  "student_number": "202012345",
  "password": "securepassword",
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "role": "student"
}
```

#### POST /api/auth/login
Iniciar sesión
```json
{
  "student_number": "202012345",
  "password": "securepassword"
}
```

#### GET /api/auth/me
Obtener información del usuario actual (requiere token)

### Quiz (Estudiantes)

#### POST /api/quiz/start
Iniciar nueva sesión de quiz
```json
{
  "week": 3,
  "theme": "lógica, proposiciones",
  "difficulty": 1
}
```

#### POST /api/quiz/question
Obtener pregunta
```json
{
  "week": 3,
  "themes": ["lógica"],
  "difficulty": 1,
  "exclude_ids": [1, 2, 3]
}
```

#### POST /api/quiz/answer
Enviar respuesta
```json
{
  "session_id": 1,
  "question_id": 5,
  "user_answer": "a"
}
```

#### GET /api/quiz/sessions
Obtener sesiones del usuario

#### GET /api/quiz/themes?week=3
Obtener temas disponibles

#### GET /api/quiz/difficulties?week=3&themes=lógica
Obtener dificultades disponibles

### Dashboard (Profesores)

#### GET /api/teacher/dashboard/stats
Estadísticas generales

#### GET /api/teacher/students
Lista de estudiantes con estadísticas

#### GET /api/teacher/student/:id
Detalles de un estudiante

#### GET /api/teacher/dashboard/theme-stats
Estadísticas por tema

#### GET /api/teacher/dashboard/difficulty-stats
Estadísticas por dificultad

#### GET /api/teacher/dashboard/recent-activity
Actividad reciente

## Modelos de Base de Datos

### User
- id
- student_number (único)
- password_hash
- role ('student' o 'teacher')
- name
- email
- created_at

### QuizSession
- id
- user_id
- week
- theme
- difficulty
- started_at
- completed_at
- status

### Answer
- id
- session_id
- question_id
- user_answer
- is_correct
- answered_at

## Migraciones de Base de Datos

Inicializar migraciones:
```bash
flask db init
```

Crear migración:
```bash
flask db migrate -m "Description"
```

Aplicar migraciones:
```bash
flask db upgrade
```

## Desarrollo

### Ejecutar en modo desarrollo
```bash
export FLASK_ENV=development
python app.py
```

### Ejecutar tests (si los hay)
```bash
pytest
```

## Producción

### Con Gunicorn
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Variables de entorno importantes
- `DATABASE_URL`: URL de la base de datos PostgreSQL
- `JWT_SECRET_KEY`: Clave secreta para JWT
- `SECRET_KEY`: Clave secreta de Flask
- `FLASK_ENV`: production

## Notas de Seguridad

⚠️ **IMPORTANTE**: 
- Cambiar las contraseñas por defecto en producción
- Usar PostgreSQL en lugar de SQLite en producción
- Configurar CORS apropiadamente
- Usar HTTPS en producción
- Configurar JWT_SECRET_KEY seguro
- No commitear el archivo .env

## Troubleshooting

### Error: Pandoc not found
Instalar Pandoc siguiendo las instrucciones de instalación.

### Error: Database locked (SQLite)
SQLite tiene limitaciones de concurrencia. Considerar usar PostgreSQL.

### Error: CORS
Verificar que FRONTEND_URL en .env coincida con la URL del frontend.
