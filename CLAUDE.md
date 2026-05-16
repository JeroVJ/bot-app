# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

Two-tier app for a Spanish-language math/logic quiz course:

- `backend/` — Flask + SQLAlchemy REST API (Python 3.9+, JWT auth, gunicorn for prod)
- `frontend/` — React 18 SPA (CRA + Tailwind, dark-themed dashboard)
- `docker-compose.yml` — local PostgreSQL + Adminer for dev

Questions live in `backend/Preguntas.tex` (LaTeX). On `init_db.py` they are parsed and persisted into the `questions` table; their original LaTeX body is JSON-encoded into `Question.content` and rendered to HTML lazily on each request.

## Commands

### Backend

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Initialize schema, seed admin/test users, load Preguntas.tex → questions table
python init_db.py

# Dev server (binds 0.0.0.0:5000, debug=True)
python app.py

# Prod server (Railway / docker)
gunicorn 'app:create_app()' --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 180
```

Env vars (see `backend/.env.example`): `DATABASE_URL` (sqlite default, switch to `postgresql://...` for prod), `JWT_SECRET_KEY`, `SECRET_KEY`, `FLASK_ENV`, `FRONTEND_URL`. `DATABASE_URL` starting with `postgres://` is rewritten to `postgresql://` automatically by `config.py` (Railway compatibility).

Default seeded accounts: teacher `admin` / `admin123`, students `202012341`–`202012343` / `student123`.

### Frontend

```bash
cd frontend
npm install
# .env: REACT_APP_API_URL=http://localhost:5000/api
npm start          # dev server on http://localhost:3000 (proxy → :5000)
npm run build      # production build → build/
```

CRA is launched with `DANGEROUSLY_DISABLE_HOST_CHECK=true` so tunnels/proxies work. `craco.config.js` is present but `react-scripts` is what actually runs.

### Local Postgres (optional, replaces SQLite)

```bash
docker-compose up -d postgres   # postgres:16-alpine on :5432, Adminer on :8080
cp backend/.env.docker backend/.env
cd backend && python init_db.py
```

### Tests

```bash
cd backend && source venv/bin/activate
python -m pytest tests/ -v
```

`tests/test_graph_pipeline.py` cubre el pipeline de grafo end-to-end con un dataset de juguete calculado a mano en `tests/fixtures/toy_dataset.py` (5 preguntas, 4 usuarios, 5 sesiones). Si tocas el cálculo del peso, el filtro de primer intento o el agregado, los valores esperados en el fixture tienen que actualizarse.

`npm test` no tiene suite — solo el placeholder de CRA.

## High-level architecture

### Backend (Flask app factory)

`app.py:create_app()` builds the Flask app, wires SQLAlchemy/JWT/CORS/Migrate, and registers four blueprints — each owns one logical domain:

| Blueprint    | File                | Prefix         | Responsibility                                                        |
|--------------|---------------------|----------------|-----------------------------------------------------------------------|
| `auth_bp`    | `auth_routes.py`    | `/api/auth`    | register / login / `/me` / change-password (JWT, bcrypt)              |
| `quiz_bp`    | `quiz_routes.py`    | `/api/quiz`    | Student-facing: start session, fetch question, submit answer, list sessions, themes/difficulties, graph-driven `/next` |
| `teacher_bp` | `teacher_routes.py` | `/api/teacher` | Aggregate stats per student / theme / difficulty + recent-activity feed (teacher role only) |
| `graph_bp`   | `graph_routes.py`   | `/api/graph`   | Build/inspect the question transition graph, run simulations          |

CORS allows the configured `FRONTEND_URL` plus the production domain `pp-bot.com`. JWT identity is stored as a string (`str(user.id)`) — callers convert back with `int(get_jwt_identity())`. Two of the blueprints define their own `check_teacher_role()` helper; do not assume a shared one.

Two LaTeX loaders exist — only `preguntas_loader_simple.py` is in use. `preguntas_loader.py` and `utils.py:convert_latex_to_html` (Pandoc-based) are legacy and not wired into the app. `preguntas_loader_simple.py` parses `Preguntas.tex` at import time, canonicalizes theme names via `THEMES_CANON`, and exposes `get_question_html()` for on-demand LaTeX→HTML conversion with MathJax-friendly `$…$` / `$$…$$` delimiters.

### Question graph engine (key subsystem)

Pipeline de dos tablas. Ver `backend/MODULO_GRAFO.md` para el detalle.

```
Answer (con order_in_session)
   → RawTransition  (TABLA 1, fuente de verdad — filtro de primer intento)
   → QuestionTransition (TABLA 2, agregada, con peso = -ln((c+1)/(n+2)))
   → networkx.DiGraph (in-memory por worker)
```

- **`RawTransition`** (`models.py`): una fila por cada par consecutivo `(Y, X)` observado en una sesión `'completed'`, conservando `user_id`, `session_id`, `order_in_session`. Aplica filtro **primer intento por `(user_id, question_to_id)`** — si el estudiante ya vio X como destino, la transición no se cuenta.
- **`QuestionTransition`** (`models.py`): agregado `(Y, X) → (total_transiciones, total_correctas, peso)` donde `peso = -ln((c+1)/(n+2))` con Laplace. Siempre `>= 0` y finito, sumable como peso de Dijkstra.
- **`QuestionOutStats`**: legacy, solo para `p_transition` en visualización; NO participa del peso.
- **`graph_engine.QuizGraph.build()`** carga `QuestionTransition` y agrega aristas con `weight=peso`, plus atributos secundarios `p_correct`, `p_transition`, `n_transitions`.
- **`get_next_question()`** sigue siendo ε-greedy (`EPSILON=0.15`, score `0.7*p_transition + 0.3*p_correct`) — el cambio a shortest-path sobre `weight` es trabajo del Bloque B (en curso, ver más abajo).
- **`get_shortest_path(src, tgt)`** envuelve `nx.shortest_path(..., weight='weight')`. Usado por `/api/graph/health`.

Mantenimiento del grafo:

- **Incremental** (lo normal en producción): `graph_pipeline.ingest_session(db, session_id)` se llama desde `POST /api/quiz/session/:id/complete` y `POST /api/quiz/submit`. Inserta filas nuevas en `RawTransition` y actualiza solo las aristas afectadas en `QuestionTransition`. Invalida el grafo en memoria del worker.
- **Rebuild completo** (manual): `graph_pipeline.rebuild_full(db)` borra TABLA 1 y TABLA 2 y las regenera desde cero leyendo todos los `Answer` de sesiones completadas. Endpoint: `POST /api/graph/rebuild-pipeline` (o el alias `reset-transitions`). El filtro de primer intento se aplica respetando el orden cronológico global por usuario.
- **Simulación**: `simulation.py:run_simulation()` crea **un usuario sintético por sesión** (role `simulacion`, prefijo `sim_NNNNNNN`) — necesario para que el filtro de primer intento no descarte las transiciones cruzadas. `seed-simulation` con `force=True` borra solo sesiones/answers de usuarios `role='simulacion'`, **nunca** datos reales. Tras la simulación llama a `rebuild_full()`.

**Multi-worker gotcha**: cada gunicorn worker tiene su propio `quiz_graph`. `graph_routes.get_graph()` reconstruye lazy desde la BD en el primer request. `ingest_session` y `rebuild_full` setean `quiz_graph.G = None` para forzar el rebuild en los demás workers en su próximo request. Si agregas un endpoint nuevo que toque el grafo, úsalo a través de `get_graph()`.

**Migraciones de schema** (`init_db.py`): `db.create_all()` solo crea tablas nuevas. Las columnas agregadas a tablas existentes (`Answer.order_in_session`, `QuestionTransition.peso`) se aplican con `ALTER TABLE` defensivos en `_ensure_column()`. Idempotente — corre en cada arranque y no falla si ya están.

### Bloque B — selección Dijkstra (EN CURSO, sesión pausada 2026-05-15)

El Bloque A (TABLA 1 + TABLA 2 + pesos Laplace + tests + docs) está cerrado y los 8 tests de `tests/test_graph_pipeline.py` pasan. El siguiente paso es reemplazar la selección ε-greedy en `graph_engine.QuizGraph.get_next_question()` por una basada en Dijkstra sobre `weight`.

**Decisiones ya tomadas por el usuario:**
- **Sin exploración**: NO mantener ε-greedy. La selección es determinista 100% Dijkstra. Eliminar `EPSILON`, `W_TRANS`, `W_CORR` y el random fallback del cuerpo de `get_next_question`. Mantener solo el fallback random si el grafo no tiene info para `last_qid` (cold start: sesión sin respuestas previas, o `last_qid` sin out-edges).

**Pendiente de decidir antes de codear** (preguntar al retomar):

Política de selección — tres opciones presentadas, usuario aún no eligió:

1. **Vecino directo de menor peso** — argmin sobre `last_qid.out_edges` filtrado por `available_qids \ asked_ids`. Dijkstra se reduce a una lookup de aristas; ignora candidatos que no son vecinos directos.
2. **Shortest-path lookahead** *(recomendado en la pregunta original)* — para cada candidato X no contestado, `nx.shortest_path_length(last_qid, X, weight='weight')`. Elegir X de menor distancia y devolver el **primer salto** del camino. Aprovecha transitividad cuando `(last_qid → X)` directo no existe pero hay un camino Y intermedio. Esto es lo que justifica usar Dijkstra de verdad.
3. **Camino al objetivo final** — Dijkstra de `last_qid` a un nodo destino fijo (¿la pregunta más difícil de la sesión? ¿la última?). El siguiente paso es `path[1]`. Requiere definir el objetivo.

Llamadas y archivos a tocar cuando se retome:
- `backend/graph_engine.py:127` — reescribir `get_next_question(last_qid, asked_ids, available_qids, performance=0.5)`. El parámetro `performance` puede quedar deprecado o usarse para ajustar el objetivo en la opción 3.
- `backend/graph_engine.py:36-44` — limpiar constantes `EPSILON`, `W_TRANS`, `W_CORR` y el comentario asociado.
- `backend/graph_engine.py:18-21` — actualizar el docstring del módulo.
- `backend/quiz_routes.py:472` — único call site, no cambia la firma pública si conservamos los kwargs.
- `backend/MODULO_GRAFO.md:135-143` — mover "Limitaciones y trabajo futuro (Bloque B)" a sección "Bloque B implementado".
- Tests nuevos en `tests/test_graph_pipeline.py`: verificar (a) que `get_next_question` retorna determinístico el primer salto correcto en el dataset de juguete, (b) que cuando no hay info de `last_qid` cae al fallback, (c) que nunca retorna una pregunta ya en `asked_ids`.

Estado del repo: nada modificado todavía. La conversación se pausó después de que el usuario confirmara "no ε-greedy" pero antes de elegir entre las tres políticas.

### Data model (`models.py`)

`User` ─< `QuizSession` ─< `Answer`. `Question` is independent (matched by `question_id`, an integer that is _not_ the primary key — the PK is autoincrement `id`). `QuestionTransition` and `QuestionOutStats` are statistical aggregates with no FK constraints to `Question` — be defensive about missing question IDs when reading them.

`User.role` is a free-form string: `'student'`, `'teacher'`, or `'simulacion'` (the synthetic data user `student_number='sim_data'`). The simulation user must remain excluded from teacher dashboard counts — current routes filter by `role='student'`.

### Frontend (React)

Single `App.js` defines all routes. `AuthContext` (`context/AuthContext.js`) wraps the app and exposes `login` / `register` / `logout` / `isAuthenticated` / `isTeacher` / `isStudent`. Tokens are stored in **sessionStorage** (not localStorage) so they clear on browser close; the axios interceptor falls back to localStorage for migration. A 401 from any endpoint triggers a hard redirect to `/login` and clears storage.

Routing model:
- `/` → `HomeRedirect` (sends students to `/student/quiz`, teachers to `/teacher/dashboard`)
- `/student/quiz` → `ChatQuiz` (conversational quiz UI driving the `/api/quiz/*` endpoints)
- `/student/dashboard` → student's own history/stats
- `/teacher/dashboard` → `TeacherDashboard`, which internally tab-switches to `BayesianNetworkTab` for graph visualisations (SVG-based, no D3/vis.js)

All API calls go through `services/api.js`. Three grouped clients: `authAPI`, `quizAPI`, `teacherAPI`, `graphAPI`. Add new endpoints there rather than calling `axios` ad-hoc.

UI uses Tailwind (`darkMode: 'class'`) + a small ad-hoc primitives library in `components/ui/` (`Button`, `Card`, `Badge`, `Progress`, `Table`, `Spinner`, `Stat`, `Input`). `cn()` from `lib/utils.js` merges classes (`clsx` + `tailwind-merge`). Lucide icons.

MathJax is loaded in `public/index.html`; after every message update `ChatQuiz` calls `window.MathJax.typesetPromise()` to re-typeset rendered HTML containing `$…$` / `$$…$$`.

## Working with the question bank

Question metadata follows this LaTeX format (parsed by `preguntas_loader_simple.py`):

```latex
\begin{question}{ID}{tema1, tema2}{difficulty}{correct_answer}{week}{
\textbf{Statement}
\begin{enumerate}
    \item a) ...
    \item b) ...
    ...
\end{enumerate}
}\end{question}
```

After editing `Preguntas.tex`:
1. Restart the backend (it parses on import) OR
2. If questions are already in the DB, manually delete them or drop the table — `init_db.py` only loads when `Question.query.count() == 0`.

`THEMES_CANON` normalises tema spelling/accents. Add new variants there if a new tema doesn't show up under the right canonical name.

## Conventions / things to know

- All user-facing strings are Spanish; preserve that voice when adding UI.
- Question content is stored as a JSON-serialised dict in `Question.content`, not raw LaTeX. Use `json.loads(q.content)` then `get_question_html()`.
- Don't reintroduce Pandoc — the simple regex loader is intentional (no system dependency, faster cold-start).
- When changing the schema, `Flask-Migrate` is wired up but no migrations are committed; in dev `db.create_all()` runs in `app.py`. For prod use `flask db migrate` / `flask db upgrade`.
- Production deploy targets are Railway (backend, see `Procfile` and `railway.json`) and Vercel (frontend, see `vercel.json`).
