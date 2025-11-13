# 🐳 Docker Setup - Quiz App

Guía para ejecutar PostgreSQL en Docker para el proyecto Quiz App.

## Requisitos

- Docker Desktop instalado ([Descargar aquí](https://www.docker.com/products/docker-desktop))
- Docker Compose (incluido en Docker Desktop)

## 🚀 Inicio Rápido

### Opción 1: Script Automático (Recomendado)

```bash
cd quiz-app
chmod +x setup-docker.sh
./setup-docker.sh
```

Este script:
1. ✅ Inicia PostgreSQL en Docker
2. ✅ Configura el backend
3. ✅ Instala dependencias
4. ✅ Inicializa la base de datos
5. ✅ Configura el frontend

### Opción 2: Manual

```bash
# 1. Iniciar PostgreSQL en Docker
docker-compose up -d postgres

# 2. Esperar a que esté listo (unos 10 segundos)
docker-compose ps

# 3. Configurar backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
cp .env.docker .env
python init_db.py

# 4. Configurar frontend
cd ../frontend
npm install
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

## 📊 Servicios Incluidos

### PostgreSQL
- **Puerto:** 5432
- **Base de datos:** quiz_app
- **Usuario:** quiz_user
- **Contraseña:** quiz_password_2024
- **Connection URL:** `postgresql://quiz_user:quiz_password_2024@localhost:5432/quiz_app`

### Adminer (Interfaz Web)
- **URL:** http://localhost:8080
- **Sistema:** PostgreSQL
- **Servidor:** postgres
- **Usuario:** quiz_user
- **Contraseña:** quiz_password_2024
- **Base de datos:** quiz_app

## 🎯 Ejecutar la Aplicación

Una vez configurado, necesitas dos terminales:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

## 🛠️ Comandos Útiles de Docker

### Ver estado de los contenedores
```bash
docker-compose ps
```

### Ver logs de PostgreSQL
```bash
docker-compose logs -f postgres
```

### Detener PostgreSQL
```bash
docker-compose stop
```

### Reiniciar PostgreSQL
```bash
docker-compose restart postgres
```

### Detener y eliminar contenedores
```bash
docker-compose down
```

### Detener y eliminar TODO (incluyendo datos)
```bash
docker-compose down -v
```

### Acceder al shell de PostgreSQL
```bash
docker-compose exec postgres psql -U quiz_user -d quiz_app
```

### Backup de la base de datos
```bash
docker-compose exec postgres pg_dump -U quiz_user quiz_app > backup.sql
```

### Restaurar backup
```bash
docker-compose exec -T postgres psql -U quiz_user -d quiz_app < backup.sql
```

## 🔧 Configuración

### docker-compose.yml

Configura los servicios de Docker. Puedes modificar:
- Puertos
- Contraseñas
- Volúmenes
- Variables de entorno

### backend/.env.docker

Configuración del backend para conectarse a PostgreSQL en Docker:
```env
DATABASE_URL=postgresql://quiz_user:quiz_password_2024@localhost:5432/quiz_app
JWT_SECRET_KEY=tu-clave-secreta-jwt
SECRET_KEY=tu-clave-secreta-flask
FLASK_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 📦 Volúmenes

Los datos de PostgreSQL se almacenan en un volumen de Docker llamado `postgres_data`. Esto significa:
- ✅ Los datos persisten entre reinicios
- ✅ No se pierden al detener el contenedor
- ⚠️ Se eliminan con `docker-compose down -v`

## 🚨 Solución de Problemas

### PostgreSQL no inicia
```bash
# Ver logs
docker-compose logs postgres

# Eliminar y recrear
docker-compose down -v
docker-compose up -d postgres
```

### Puerto 5432 ya está en uso
Si tienes PostgreSQL instalado localmente:
```bash
# Detener PostgreSQL local
brew services stop postgresql@16

# O cambiar el puerto en docker-compose.yml:
ports:
  - "5433:5432"  # Usar puerto 5433 en lugar de 5432

# Actualizar .env:
DATABASE_URL=postgresql://quiz_user:quiz_password_2024@localhost:5433/quiz_app
```

### Error al conectar desde el backend
Verifica que:
1. PostgreSQL esté corriendo: `docker-compose ps`
2. El puerto esté correcto en `.env`
3. Las credenciales coincidan

### Backend no puede instalar psycopg2
```bash
# En Mac con Apple Silicon (M1/M2/M3)
cd backend
source venv/bin/activate
pip install psycopg2-binary --no-cache-dir
```

## 🎓 Ventajas de Usar Docker

✅ **Fácil de configurar**: Un solo comando
✅ **Aislado**: No interfiere con otras instalaciones
✅ **Portátil**: Funciona igual en Mac, Linux, Windows
✅ **Limpio**: Fácil de eliminar completamente
✅ **Consistente**: Mismo ambiente para todos
✅ **Múltiples versiones**: Puedes tener varios proyectos con diferentes versiones de PostgreSQL

## 🔄 Migrar de SQLite a PostgreSQL

Si ya iniciaste con SQLite y quieres migrar:

1. Exporta datos de SQLite (si los necesitas)
2. Elimina `quiz_app.db`
3. Actualiza `.env` con la URL de PostgreSQL
4. Ejecuta `python init_db.py`

## 🌐 Producción

Para producción, considera:
- Usar variables de entorno seguras
- Cambiar contraseñas
- Configurar backups automáticos
- Usar servicios administrados (AWS RDS, Google Cloud SQL, etc.)

## 📚 Recursos

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Docker Compose](https://docs.docker.com/compose/)
- [Adminer](https://www.adminer.org/)
