# preguntas_loader_simple.py
# -*- coding: utf-8 -*-
import os
import re
import unicodedata

def _strip_accents(s: str) -> str:
    """Quita acentos para comparar en minúsculas."""
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn")

# Mapa de temas canónicos
THEMES_CANON = {
    "conjunto": "Conjuntos",
    "conjuntos": "Conjuntos",
    "logica": "Lógica",
    "lógica": "Lógica",
    "proposiciones": "Proposiciones",
    "proposiciones2": "Proposiciones",
    "argumentos": "Argumentación",
    "argumentación": "Argumentación",
    "argumentacion": "Argumentación",
    "cuantificadores": "Cuantificadores",
    "demostraciones": "Demostraciones",
    "exploracion": "Exploración",
    "exploración": "Exploración",
    "funciones": "Funciones",
    "implicaciones": "Implicaciones",
    "indices": "Índices",
    "índices": "Índices",
    "sumatorias": "Sumatorias",
    "traducciones": "Traducciones",
    "preferencias": "Preferencias",
    "utilidad": "Utilidad",
}

def canon_tema(raw: str) -> str:
    """Devuelve el nombre de tema canónico."""
    s = (raw or "").strip()
    if not s:
        return ""
    key = _strip_accents(s).lower()
    if key in THEMES_CANON:
        return THEMES_CANON[key]
    return s[:1].upper() + s[1:].lower()

def simple_latex_to_html(latex_str: str) -> str:
    """
    Conversión mejorada de LaTeX a HTML con soporte para MathJax.
    """
    html = latex_str

    # Convertir bloques de matemáticas \[ ... \] a $$ ... $$ para MathJax
    html = re.sub(r'\\\[(.*?)\\\]', r'$$\1$$', html, flags=re.DOTALL)

    # Convertir matemáticas inline \( ... \) a $ ... $ para MathJax
    html = re.sub(r'\\\((.*?)\\\)', r'$\1$', html, flags=re.DOTALL)

    # Reemplazos básicos de formato
    html = re.sub(r'\\textbf\{([^}]*)\}', r'<strong>\1</strong>', html)
    html = re.sub(r'\\textit\{([^}]*)\}', r'<em>\1</em>', html)
    html = re.sub(r'\\emph\{([^}]*)\}', r'<em>\1</em>', html)

    # Espaciado
    html = re.sub(r'\\smallskip', '<br>', html)
    html = re.sub(r'\\medskip', '<br>', html)
    html = re.sub(r'\\bigskip', '<br><br>', html)

    # Saltos de línea - IMPORTANTE: mantener \\ solo fuera de matemáticas
    # Primero protegemos las matemáticas
    math_blocks = []
    def save_math(match):
        math_blocks.append(match.group(0))
        return f"__MATH_{len(math_blocks)-1}__"

    html = re.sub(r'\$\$.*?\$\$', save_math, html, flags=re.DOTALL)
    html = re.sub(r'\$.*?\$', save_math, html)

    # Ahora convertimos \\ a <br> solo fuera de matemáticas
    html = re.sub(r'\\\\', '<br>', html)

    # Restauramos las matemáticas
    for i, math in enumerate(math_blocks):
        html = html.replace(f"__MATH_{i}__", math)

    # Limpiar comandos LaTeX básicos no procesados
    html = re.sub(r'\\[a-zA-Z]+(?:\[[^\]]*\])?\{([^}]*)\}', r'\1', html)

    # Limpiar comandos sin argumentos
    html = re.sub(r'\\[a-zA-Z]+\s*', ' ', html)

    return html.strip()

def load_preguntas_from_latex(file_name: str):
    """
    Lee el archivo LaTeX y extrae preguntas.
    RÁPIDO: No convierte a HTML hasta que se solicite.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(current_dir, file_name)

    if not os.path.exists(file_path):
        print(f"Warning: {file_path} not found")
        return {}

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = r"\\begin\{question\}\{(\d+)\}\{([^\}]+)\}\{(\d+)\}\{([^\}]+)\}\{(\d+)\}\{([\s\S]+?)\}\s*\\end\{question\}"
    preguntas = {}
    matches = re.findall(pattern, content, re.DOTALL)

    for qid_str, tema, dif_str, res_str, week_str, body in matches:
        qid = int(qid_str)
        dif = int(dif_str)
        week = int(week_str)
        res_list = [r.strip() for r in res_str.split(',')]

        # Canonizar temas
        raw_topics = [t.strip() for t in tema.split(",") if t.strip()]
        canon_set = set()
        for t in raw_topics:
            ct = canon_tema(t)
            if ct:
                canon_set.add(ct)
        canon_topics = ",".join(sorted(canon_set))

        # Extraer opciones del enumerate
        enum_match = re.search(r"\\begin\{enumerate\}([\s\S]+?)\\end\{enumerate\}", body)
        enum_src = enum_match.group(1) if enum_match else ""
        items = re.findall(r"\\item\s*([A-Za-z])\)\s*([\s\S]*?)(?=(\\item|$))", enum_src)

        opts = {}
        for letra, texto, _ in items:
            txt = re.sub(r'^[A-Za-z]\)\s*', '', texto).strip()
            opts[letra.lower()] = " ".join(txt.split())

        # Guardar pregunta (sin convertir a HTML aún)
        preguntas[qid] = {
            "tema": canon_topics,
            "dif": dif,
            "res": res_list,
            "week": week,
            "body_latex": body,  # Guardamos el LaTeX original
            "opts": opts
        }

    return preguntas

def get_question_html(pregunta_data):
    """
    Convierte una pregunta a HTML bajo demanda.
    Solo se llama cuando realmente se va a mostrar la pregunta.
    """
    try:
        body = pregunta_data["body_latex"]

        # Separar enunciado de opciones
        body_no_enum = re.sub(r"\\begin\{enumerate\}([\s\S]+?)\\end\{enumerate\}", "", body, flags=re.DOTALL).strip()

        # Convertir enunciado a HTML con mejor soporte de matemáticas
        html = simple_latex_to_html(body_no_enum)

        # Agregar opciones como lista HTML
        enum_match = re.search(r"\\begin\{enumerate\}([\s\S]+?)\\end\{enumerate\}", body)
        if enum_match:
            enum_src = enum_match.group(1)
            items = re.findall(r"\\item\s*([A-Za-z])\)\s*([\s\S]*?)(?=(\\item|$))", enum_src)

            if items:
                html += "<ol type='a' style='margin-top:1rem; line-height: 1.8;'>"
                for letra, texto, _ in items:
                    txt = re.sub(r'^[A-Za-z]\)\s*', '', texto).strip()
                    txt_html = simple_latex_to_html(txt)
                    html += f"<li style='margin-bottom: 0.5rem;'>{txt_html}</li>"
                html += "</ol>"

        return html
    except Exception as e:
        print(f"Error converting question to HTML: {str(e)}")
        return f"<p>Error al cargar pregunta: {str(e)}</p>"

# Cargar preguntas al importar (rápido porque no convierte a HTML)
Preguntas = load_preguntas_from_latex("Preguntas.tex")
print(f"Loaded {len(Preguntas)} questions (lazy conversion)")