# Quiz App Frontend

Frontend de la aplicación de práctica de ejercicios con chatbot, construido con React.

## Características

- 🎨 Interfaz moderna y responsive
- 🔐 Sistema de autenticación completo
- 👤 Dos interfaces: Estudiantes y Profesores
- 📊 Dashboard interactivo para profesores
- 💬 Chatbot de quiz para estudiantes
- 🧮 Soporte para renderizado de matemáticas (MathJax)

## Estructura del Proyecto

```
frontend/
├── public/
│   └── index.html
├── src/
│   ├── components/        # Componentes reutilizables
│   ├── pages/            # Páginas principales
│   │   ├── Login.js
│   │   ├── Register.js
│   │   ├── QuizPage.js
│   │   └── TeacherDashboard.js
│   ├── context/          # Context API
│   │   └── AuthContext.js
│   ├── services/         # API services
│   │   └── api.js
│   ├── styles/           # Archivos CSS
│   │   ├── App.css
│   │   ├── Auth.css
│   │   ├── Quiz.css
│   │   └── Dashboard.css
│   ├── App.js
│   └── index.js
├── package.json
└── README.md
```

## Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

Crear archivo `.env` en la raíz del directorio frontend:

```bash
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Ejecutar en modo desarrollo

```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## Scripts Disponibles

### `npm start`

Ejecuta la aplicación en modo desarrollo.
Abre [http://localhost:3000](http://localhost:3000) en el navegador.

### `npm run build`

Compila la aplicación para producción en la carpeta `build`.
Optimiza el build para mejor rendimiento.

### `npm test`

Ejecuta los tests en modo interactivo.

## Páginas y Rutas

### Rutas Públicas

- `/login` - Página de inicio de sesión
- `/register` - Página de registro

### Rutas Protegidas (Estudiantes)

- `/student/quiz` - Interfaz de quiz interactivo

### Rutas Protegidas (Profesores)

- `/teacher/dashboard` - Dashboard con estadísticas y gestión

## Componentes Principales

### AuthContext

Maneja el estado de autenticación global:
- Login/Logout
- Registro de usuarios
- Información del usuario actual
- Protección de rutas

### QuizPage

Interfaz principal para estudiantes:
- Selección de parámetros (semana, tema, dificultad)
- Sistema de preguntas y respuestas
- Seguimiento de progreso
- Resultados finales

### TeacherDashboard

Dashboard para profesores:
- Estadísticas generales
- Lista de estudiantes
- Análisis por tema y dificultad
- Detalles individuales de estudiantes

## Servicios API

El archivo `src/services/api.js` contiene todas las funciones para comunicarse con el backend:

### Autenticación
- `authAPI.register(data)`
- `authAPI.login(data)`
- `authAPI.getCurrentUser()`

### Quiz
- `quizAPI.startSession(data)`
- `quizAPI.getQuestion(data)`
- `quizAPI.submitAnswer(data)`
- `quizAPI.getSessions()`

### Dashboard (Profesores)
- `teacherAPI.getDashboardStats()`
- `teacherAPI.getStudents()`
- `teacherAPI.getStudentDetails(id)`

## Estilos

La aplicación utiliza CSS modular organizado por componente:

- `App.css` - Estilos globales
- `Auth.css` - Páginas de autenticación
- `Quiz.css` - Interfaz del quiz
- `Dashboard.css` - Dashboard de profesores

### Paleta de Colores

- Primario: `#667eea`
- Secundario: `#764ba2`
- Éxito: `#28a745`
- Error: `#dc3545`

## Responsive Design

La aplicación es completamente responsive y se adapta a:
- Desktop (> 1024px)
- Tablet (768px - 1024px)
- Mobile (< 768px)

## Soporte de MathJax

La aplicación incluye soporte para renderizado de fórmulas matemáticas en LaTeX usando MathJax 3.

Formato soportado:
- Inline: `$formula$` o `\(formula\)`
- Display: `$$formula$$` o `\[formula\]`

## Desarrollo

### Agregar nueva página

1. Crear componente en `src/pages/`
2. Agregar ruta en `App.js`
3. Crear estilos en `src/styles/`

### Agregar nuevo endpoint de API

1. Agregar función en `src/services/api.js`
2. Usar en componente con async/await

## Build para Producción

```bash
npm run build
```

Esto genera la carpeta `build/` con la aplicación optimizada.

### Servir build localmente

```bash
npm install -g serve
serve -s build
```

### Desplegar

El contenido de `build/` puede desplegarse en:
- Netlify
- Vercel
- GitHub Pages
- Cualquier servidor web estático

## Troubleshooting

### Error: Cannot connect to backend

Verificar que:
1. El backend esté corriendo en el puerto correcto
2. `REACT_APP_API_URL` esté configurado correctamente
3. CORS esté configurado en el backend

### Fórmulas matemáticas no se renderizan

Verificar que MathJax se cargue correctamente en `public/index.html`

### Problemas de CORS

Asegurarse de que el backend tenga configurado CORS para permitir el origen del frontend.

## Contribuir

1. Hacer fork del proyecto
2. Crear rama para feature (`git checkout -b feature/NuevaCaracteristica`)
3. Commit cambios (`git commit -m 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/NuevaCaracteristica`)
5. Abrir Pull Request
