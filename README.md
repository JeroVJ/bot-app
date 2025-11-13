# Quiz App - Sistema de Práctica de Ejercicios

Aplicación web completa para práctica de ejercicios con chatbot, diseñada para estudiantes y profesores. Incluye autenticación, gestión de sesiones de quiz, seguimiento de progreso y dashboard analítico para profesores.

## 🚀 Características Principales

### Para Estudiantes
- ✅ Sistema de autenticación seguro (JWT)
- 💬 Chatbot interactivo para practicar ejercicios
- 📚 Selección de temas y dificultad personalizada
- 📊 Seguimiento de progreso y resultados
- 🧮 Soporte para fórmulas matemáticas (MathJax)

### Para Profesores
- 📈 Dashboard con estadísticas en tiempo real
- 👥 Gestión y seguimiento de estudiantes
- 📊 Análisis por tema y dificultad
- 🎯 Visualización de rendimiento individual
- 📉 Estadísticas de actividad reciente

## 🏗️ Arquitectura

El proyecto está dividido en dos partes principales:

```
quiz-app/
├── backend/          # API REST con Flask
│   ├── app.py
│   ├── models.py
│   ├── auth_routes.py
│   ├── quiz_routes.py
│   ├── teacher_routes.py
│   └── utils.py
├── frontend/         # SPA con React
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   └── services/
│   └── public/
└── README.md
```

### Stack Tecnológico

**Backend:**
- Python 3.9+
- Flask (Framework web)
- SQLAlchemy (ORM)
- Flask-JWT-Extended (Autenticación)
- PostgreSQL/SQLite (Base de datos)
- Pandoc (Conversión LaTeX → HTML)
- Bcrypt (Encriptación de contraseñas)

**Frontend:**
- React 18
- React Router (Enrutamiento)
- Axios (Cliente HTTP)
- Context API (Estado global)
- CSS3 (Estilos)
- MathJax (Renderizado matemático)

## 📋 Requisitos Previos

- Python 3.9 o superior
- Node.js 16 o superior
- npm o yarn
- Pandoc (para conversión de LaTeX)
- PostgreSQL (opcional, para producción)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/quiz-app.git
cd quiz-app
```

### 2. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Instalar Pandoc
# Ubuntu/Debian:
sudo apt-get install pandoc
# macOS:
brew install pandoc

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Copiar archivo de preguntas
cp /ruta/a/Preguntas.tex .

# Inicializar base de datos
python init_db.py
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

## ▶️ Ejecutar la Aplicación

### Modo Desarrollo

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python app.py
```
El backend estará en `http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```
El frontend estará en `http://localhost:3000`

### Cuentas por Defecto

Después de ejecutar `init_db.py`:

**Profesor:**
- Usuario: `admin`
- Contraseña: `admin123`

**Estudiantes de prueba:**
- Usuario: `202012341`, `202012342`, `202012343`
- Contraseña: `student123`

## 📚 Documentación de la API

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
Obtener usuario actual (requiere token)

### Quiz (Estudiantes)

#### POST /api/quiz/start
Iniciar sesión de quiz
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

### Dashboard (Profesores)

#### GET /api/teacher/dashboard/stats
Estadísticas generales

#### GET /api/teacher/students
Lista de estudiantes con estadísticas

#### GET /api/teacher/student/:id
Detalles de estudiante específico

Ver documentación completa en `/backend/README.md` y `/frontend/README.md`

## 🗄️ Modelo de Datos

### User
- Información de usuario
- Rol (student/teacher)
- Credenciales encriptadas

### QuizSession
- Sesiones de práctica
- Parámetros (tema, dificultad, semana)
- Estado (en progreso, completado)

### Answer
- Respuestas individuales
- Corrección automática
- Timestamp

### Question (en memoria)
- Cargadas desde Preguntas.tex
- Metadata (tema, dificultad, semana)
- Contenido en LaTeX

## 🚀 Despliegue

### Backend

#### Heroku
```bash
# Procfile ya incluido
heroku create nombre-app
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

#### Docker
```bash
cd backend
docker build -t quiz-app-backend .
docker run -p 5000:5000 quiz-app-backend
```

### Frontend

#### Netlify
```bash
cd frontend
npm run build
# Desplegar carpeta build/ en Netlify
```

#### Vercel
```bash
cd frontend
vercel --prod
```

## 🧪 Testing

### Backend
```bash
cd backend
pytest
```

### Frontend
```bash
cd frontend
npm test
```

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con Bcrypt
- ✅ Autenticación JWT
- ✅ CORS configurado
- ✅ Validación de entrada
- ✅ Protección de rutas
- ⚠️ Cambiar claves secretas en producción
- ⚠️ Usar HTTPS en producción
- ⚠️ Configurar rate limiting

## 📝 Formato de Preguntas (Preguntas.tex)

Las preguntas deben seguir este formato LaTeX:

```latex
\begin{question}{ID}{tema1, tema2}{dificultad}{respuesta_correcta}{semana}{
\textbf{Enunciado de la pregunta}

Contenido de la pregunta...

\begin{enumerate}
    \item a) Opción A
    \item b) Opción B
    \item c) Opción C
    \item d) Opción D
\end{enumerate}
}
\end{question}
```

Ejemplo:
```latex
\begin{question}{1}{lógica, proposiciones}{1}{a}{3}{
\textbf{¿Cuál es la negación de p?}

\begin{enumerate}
    \item a) $\neg p$
    \item b) $p \land q$
    \item c) $p \lor q$
    \item d) $p \rightarrow q$
\end{enumerate}
}
\end{question}
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit cambios (`git commit -m 'Agregar característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👥 Autores

- Tu Nombre - Desarrollo completo

## 🐛 Problemas Conocidos

- SQLite tiene limitaciones de concurrencia (usar PostgreSQL en producción)
- MathJax puede tardar en cargar fórmulas complejas

## 📞 Soporte

Para problemas o preguntas:
- Abrir issue en GitHub
- Email: tu-email@example.com

## 🔄 Roadmap

- [ ] Agregar más tipos de preguntas
- [ ] Implementar sistema de hints
- [ ] Agregar gamificación
- [ ] Modo de práctica cronometrado
- [ ] Exportar estadísticas a PDF
- [ ] Modo offline
- [ ] Aplicación móvil nativa

## ⚙️ Mejoras desde la Versión Original

Esta es una reescritura completa de la aplicación original que incluye:

✅ **Backend profesional:**
- Arquitectura limpia y modular
- Autenticación real con JWT
- Base de datos con SQLAlchemy
- API REST bien estructurada

✅ **Frontend editable:**
- React desde cero (no compilado)
- Código fuente accesible y modificable
- Componentes reutilizables
- Context API para estado global

✅ **Nuevas características:**
- Sistema de roles (estudiante/profesor)
- Dashboard analítico para profesores
- Seguimiento de progreso
- Estadísticas detalladas
- Interfaz moderna y responsive

✅ **Mejores prácticas:**
- Separación de frontend y backend
- Variables de entorno
- Validación de datos
- Manejo de errores
- Código documentado

---

**¡Feliz aprendizaje! 📚✨**
