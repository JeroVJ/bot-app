# 🚀 Guía de Inicio Rápido - Quiz App

## ¡Bienvenido!

Has recibido una **aplicación completamente nueva y profesional** que reemplaza la anterior. Esta nueva versión incluye:

- ✅ **Backend separado y editable** (Flask con Python)
- ✅ **Frontend editable** (React desde cero, NO compilado)
- ✅ **Base de datos real** (SQLite/PostgreSQL)
- ✅ **Autenticación funcional** (JWT)
- ✅ **Dos interfaces**: Estudiantes y Profesores
- ✅ **Dashboard para profesores** con estadísticas completas
- ✅ **Código limpio y documentado**

## 📁 Estructura del Proyecto

```
quiz-app/
├── backend/              # API REST en Flask
│   ├── app.py           # Aplicación principal
│   ├── models.py        # Modelos de base de datos
│   ├── auth_routes.py   # Rutas de autenticación
│   ├── quiz_routes.py   # Rutas del quiz
│   ├── teacher_routes.py # Rutas del dashboard
│   ├── utils.py         # Utilidades
│   ├── config.py        # Configuración
│   ├── init_db.py       # Inicializar BD
│   ├── Preguntas.tex    # Tu archivo de preguntas
│   ├── requirements.txt
│   └── README.md
│
├── frontend/            # Aplicación React
│   ├── src/
│   │   ├── pages/      # Páginas principales
│   │   ├── context/    # Estado global
│   │   ├── services/   # Servicios API
│   │   └── styles/     # Estilos CSS
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── setup.sh            # Script de instalación rápida
├── README.md           # Documentación principal
└── .gitignore
```

## ⚡ Instalación Rápida (Opción 1 - Recomendada)

### En Linux/Mac:

```bash
cd quiz-app
./setup.sh
```

Este script:
1. Crea el entorno virtual de Python
2. Instala todas las dependencias
3. Inicializa la base de datos
4. Configura el frontend
5. Te muestra los siguientes pasos

### En Windows:

Ver "Instalación Manual" abajo.

## 🔧 Instalación Manual (Opción 2)

### 1. Backend

```bash
cd quiz-app/backend

# Crear entorno virtual
python3 -m venv venv

# Activar entorno virtual
# En Mac/Linux:
source venv/bin/activate
# En Windows:
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Instalar Pandoc (requerido para LaTeX)
# Ubuntu/Debian:
sudo apt-get install pandoc
# Mac:
brew install pandoc
# Windows: https://pandoc.org/installing.html

# Crear archivo .env
cp .env.example .env
# Editar .env si es necesario

# Inicializar base de datos
python init_db.py
```

### 2. Frontend

```bash
cd quiz-app/frontend

# Instalar dependencias
npm install

# Crear archivo .env
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

## ▶️ Ejecutar la Aplicación

Necesitas **DOS terminales abiertas**:

### Terminal 1 - Backend:

```bash
cd quiz-app/backend
source venv/bin/activate    # En Windows: venv\Scripts\activate
python app.py
```

✅ Backend corriendo en: `http://localhost:5000`

### Terminal 2 - Frontend:

```bash
cd quiz-app/frontend
npm start
```

✅ Frontend corriendo en: `http://localhost:3000`

## 🔑 Cuentas de Prueba

Después de ejecutar `init_db.py`, tendrás estas cuentas:

### Profesor:
- **Usuario:** `admin`
- **Contraseña:** `admin123`
- **Acceso a:** Dashboard con estadísticas

### Estudiantes:
- **Usuario:** `202012341`, `202012342`, `202012343`
- **Contraseña:** `student123`
- **Acceso a:** Sistema de quiz interactivo

## 🎯 ¿Qué Puedes Hacer Ahora?

### Como Estudiante:
1. Iniciar sesión con una cuenta de estudiante
2. Seleccionar semana, temas y dificultad
3. Responder preguntas del quiz
4. Ver tus resultados y estadísticas

### Como Profesor:
1. Iniciar sesión con la cuenta de profesor
2. Ver estadísticas generales del curso
3. Revisar lista de estudiantes
4. Ver rendimiento por tema y dificultad
5. Analizar progreso individual de estudiantes

## 🛠️ Personalización

### Agregar Más Preguntas:

Edita el archivo `backend/Preguntas.tex` siguiendo este formato:

```latex
\begin{question}{ID}{tema}{dificultad}{respuesta}{semana}{
\textbf{Tu pregunta aquí}

\begin{enumerate}
    \item a) Opción A
    \item b) Opción B
    \item c) Opción C
    \item d) Opción D
\end{enumerate}
}
\end{question}
```

Reinicia el backend para cargar las nuevas preguntas.

### Cambiar Estilos:

Todos los estilos están en `frontend/src/styles/`:
- `App.css` - Estilos globales
- `Auth.css` - Login/Registro
- `Quiz.css` - Interfaz del quiz
- `Dashboard.css` - Dashboard de profesores

### Agregar Nuevas Funcionalidades:

El código está completamente organizado y documentado:
- Backend: Agrega rutas en archivos `*_routes.py`
- Frontend: Agrega componentes en `src/pages/` o `src/components/`

## 📚 Documentación Detallada

- **README principal:** `/README.md`
- **Backend:** `/backend/README.md`
- **Frontend:** `/frontend/README.md`

## 🐛 Solución de Problemas

### Backend no inicia:

1. ¿Está activado el entorno virtual?
   ```bash
   source venv/bin/activate
   ```

2. ¿Están instaladas las dependencias?
   ```bash
   pip install -r requirements.txt
   ```

3. ¿Está instalado Pandoc?
   ```bash
   pandoc --version
   ```

### Frontend no inicia:

1. ¿Están instaladas las dependencias?
   ```bash
   npm install
   ```

2. ¿Existe el archivo .env?
   ```bash
   cat .env
   # Debe contener: REACT_APP_API_URL=http://localhost:5000/api
   ```

### Errores de CORS:

Verifica que el backend esté configurado correctamente en `backend/app.py`. La configuración de CORS ya está incluida.

### Base de datos corrupta:

```bash
cd backend
rm quiz_app.db
python init_db.py
```

## 🚀 Próximos Pasos

1. **Explora la aplicación** con las cuentas de prueba
2. **Revisa el código** - está bien documentado
3. **Personaliza** los estilos a tu gusto
4. **Agrega más preguntas** en Preguntas.tex
5. **Registra nuevos usuarios** desde la interfaz

## 💡 Diferencias con la Versión Anterior

| Aspecto | Versión Anterior | Nueva Versión |
|---------|-----------------|---------------|
| Frontend | Compilado (no editable) | React editable |
| Backend | Todo mezclado | Arquitectura modular |
| Base de Datos | Ninguna | SQLite/PostgreSQL |
| Autenticación | Archivo JSON básico | JWT profesional |
| Roles | No existían | Estudiante/Profesor |
| Dashboard | No existía | Dashboard completo |
| Estadísticas | No se guardaban | Tracking completo |
| Código | Difícil de mantener | Limpio y documentado |

## 🎓 Recursos de Aprendizaje

Si quieres aprender más sobre las tecnologías usadas:

- **Flask:** https://flask.palletsprojects.com/
- **React:** https://react.dev/
- **SQLAlchemy:** https://www.sqlalchemy.org/
- **JWT:** https://jwt.io/introduction

## 📞 Soporte

Si tienes problemas:
1. Revisa esta guía
2. Lee los README específicos (backend/frontend)
3. Revisa los comentarios en el código

## ✨ ¡Disfruta tu Nueva Aplicación!

Esta aplicación es **completamente tuya** para:
- ✅ Modificar como quieras
- ✅ Agregar nuevas funcionalidades
- ✅ Cambiar el diseño
- ✅ Desplegar en producción
- ✅ Usar en tus clases

**¡Feliz codificación! 🎉**
