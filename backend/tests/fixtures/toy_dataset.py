"""
Dataset de juguete para validar el pipeline de transiciones a mano.

5 preguntas (id 1..5), 4 usuarios sintéticos, 5 sesiones inventadas.

Sesiones (cada fila: user_id, [(question_id, is_correct), ...]):

    U1  S1:  [(1, T), (2, T), (3, F)]
    U1  S2:  [(2, F), (3, T)]          # (2→3) es REINTENTO de U1: ya vio q3 destino en S1 → se descarta
    U2  S3:  [(1, F), (2, T), (3, T)]
    U3  S4:  [(4, T), (5, F), (1, T)]
    U4  S5:  [(3, T), (4, F)]

Transiciones esperadas en TABLA 1 (después del filtro de primer intento):
    U1 S1:  (1→2, T), (2→3, F)
    U1 S2:  ninguna (todas las destinos ya están vistas por U1)
    U2 S3:  (1→2, T), (2→3, T)
    U3 S4:  (4→5, F), (5→1, T)
    U4 S5:  (3→4, F)

→ 7 filas en TABLA 1.

TABLA 2 (agregada por (Y, X)):
    (1,2): n=2  c=2
    (2,3): n=2  c=1
    (4,5): n=1  c=0
    (5,1): n=1  c=1
    (3,4): n=1  c=0

→ 5 aristas en TABLA 2.

Pesos esperados con Laplace (peso = -ln((c+1)/(n+2))):
    (1,2): -ln(3/4)   ≈ 0.28768
    (2,3): -ln(2/4)   ≈ 0.69315
    (4,5): -ln(1/3)   ≈ 1.09861
    (5,1): -ln(2/3)   ≈ 0.40546
    (3,4): -ln(1/3)   ≈ 1.09861
"""
SESSIONS = [
    # (user_idx, [(question_id, is_correct), ...])
    (1, [(1, True),  (2, True),  (3, False)]),
    (1, [(2, False), (3, True)]),
    (2, [(1, False), (2, True),  (3, True)]),
    (3, [(4, True),  (5, False), (1, True)]),
    (4, [(3, True),  (4, False)]),
]

# Resultado esperado de TABLA 2
EXPECTED_AGG = {
    (1, 2): {'n': 2, 'c': 2},
    (2, 3): {'n': 2, 'c': 1},
    (4, 5): {'n': 1, 'c': 0},
    (5, 1): {'n': 1, 'c': 1},
    (3, 4): {'n': 1, 'c': 0},
}

EXPECTED_RAW_COUNT = 7
EXPECTED_UNIQUE_PAIRS = 5
