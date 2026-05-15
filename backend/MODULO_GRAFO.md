# Módulo de grafo de transiciones

## Qué hace

Construye una red dirigida donde cada nodo es una pregunta y cada arista
`Y → X` representa transiciones observadas (después de la pregunta Y, el
estudiante respondió la pregunta X). El peso de la arista es
`-ln(p_correct)` con suavizado de Laplace, lo que lo hace directamente
utilizable como peso en algoritmos de camino más corto (Dijkstra).

## Flujo de datos

```
   ┌─────────────────────────────────────────────┐
   │ Answer  (con order_in_session, is_correct)  │  ← lo que escribe el
   └──────────────────────┬──────────────────────┘     quiz al responder
                          │
                          │  iterar pares (Y, X) consecutivos por sesión
                          │  filtrar primer intento por (user_id, X)
                          ▼
   ┌─────────────────────────────────────────────┐
   │ RawTransition   (TABLA 1, fuente de verdad) │
   │  user_id, session_id, order_in_session,     │
   │  question_from_id (Y), question_to_id (X),  │
   │  is_correct_to                              │
   └──────────────────────┬──────────────────────┘
                          │
                          │  GROUP BY (Y, X)
                          │  peso = -ln((c+1)/(n+2))   ← Laplace
                          ▼
   ┌─────────────────────────────────────────────┐
   │ QuestionTransition  (TABLA 2, agregada)     │
   │  question_from_id, question_to_id,          │
   │  total_transiciones (n), total_correctas (c),│
   │  peso                                       │
   └──────────────────────┬──────────────────────┘
                          │
                          │  build()
                          ▼
   ┌─────────────────────────────────────────────┐
   │ NetworkX DiGraph     (en memoria por worker)│
   │  edge attrs: weight=peso, p_correct,        │
   │              p_transition, n_transitions    │
   └─────────────────────────────────────────────┘
```

## Por qué dos tablas

- **TABLA 1 (`RawTransition`)** es la **fuente de verdad**. Cada fila
  conserva el estudiante, la sesión y el orden, así que podemos
  recalcular cualquier peso o filtro nuevo sin tocar los `Answer`
  originales. También permite auditar: "¿de dónde salió esta arista?".
- **TABLA 2 (`QuestionTransition`)** es el **resumen estadístico** que
  alimenta el grafo. Una sola fila por par `(Y, X)`. Es la que carga
  `graph_engine.build()`.

Tener ambas separadas significa que reanalizar el histórico (ej. cambiar
la fórmula del peso, agregar un filtro nuevo) es solo regenerar TABLA 2
desde TABLA 1 — no requiere reprocesar el log de respuestas.

## Filtro de primer intento

Cuando el mismo estudiante ve la pregunta X varias veces (en sesiones
distintas), solo la primera transición que llega a X cuenta. Esto evita
que los reintentos sesguen el peso de las aristas hacia `correcto` (un
estudiante puede aprenderse la respuesta tras fallarla).

Implementación: al insertar en `RawTransition`, se verifica si ya existe
una fila con el mismo `(user_id, question_to_id)`. Si sí, se descarta.

## Cómo correr el pipeline

### En desarrollo (manual)

```bash
cd backend
source venv/bin/activate
DATABASE_URL=sqlite:///quiz_app.db python init_db.py   # migra schema
python app.py                                          # arranca API
```

Luego, como profesor (`admin`/`admin123`):

```bash
# Poblar el grafo con simulación
POST /api/graph/seed-simulation
{
  "n_sessions": 3000,
  "force": true
}

# Reconstruir TABLA 1 y TABLA 2 desde Answers (sim + reales)
POST /api/graph/rebuild-pipeline

# Verificar salud del grafo
GET /api/graph/health
```

### En producción

- `init_db.py` corre antes que `gunicorn` (ver `Procfile` / `start.sh`)
  y aplica las migraciones de columna (`ALTER TABLE` defensivos).
- El grafo se mantiene **incrementalmente** vía
  `graph_pipeline.ingest_session()`, llamado al completar cada quiz
  (`POST /api/quiz/session/:id/complete` y `POST /api/quiz/submit`).
- `POST /api/graph/rebuild-pipeline` queda disponible para refrescar
  todo desde cero si se cambian preguntas o se quiere limpiar.

### Limpiar simulación cuando ya haya datos reales suficientes

```bash
POST /api/graph/seed-simulation
{
  "n_sessions": 0,   # no genera nuevas, solo limpia
  "force": true
}
```

Esto borra solo `QuizSession` y `Answer` de usuarios con `role='simulacion'`.
Los datos reales se preservan. Después corre `rebuild-pipeline` automáticamente.

## Cómo correr los tests

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
```

El dataset de juguete (`tests/fixtures/toy_dataset.py`) está calculado a
mano: 5 preguntas, 4 usuarios, 5 sesiones, con TABLA 1, TABLA 2 y los
pesos Laplace esperados precalculados. Si cambias la fórmula del peso o
el filtro, los tests tienen que actualizarse.

## Limitaciones y trabajo futuro (Bloque B)

- La selección de pregunta (`get_next_question`) sigue usando ε-greedy
  sobre `p_transition` y `p_correct`, NO el shortest-path sobre `peso`.
  El peso ya está calculado y disponible en el grafo; el cambio de
  motor de selección es trabajo del siguiente bloque.
- El grafo se reconstruye en memoria por cada worker de gunicorn. Para
  proyectos grandes podría serializarse a pickle. Hoy no se justifica
  (rebuild < 1s con 3000 sesiones).
- `QuestionOutStats` se mantiene solo para que la visualización del
  `TeacherDashboard` pueda mostrar `p_transition`. No participa del
  cálculo del peso.
