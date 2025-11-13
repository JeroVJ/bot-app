# 🔄 Actualizar Preguntas en tu Proyecto

Ya copié el archivo Preguntas.tex correcto al proyecto. 

## Opción 1: Si ya descargaste el proyecto anterior

Simplemente copia el archivo nuevo a tu proyecto:

```bash
# Desde donde tengas el archivo Preguntas.tex descargado
cp Preguntas.tex /Volumes/X9\ Pro/Personal/Proyectos/quiz-app/backend/

# O descarga el proyecto actualizado de nuevo
```

## Opción 2: Descargar el proyecto actualizado

Los archivos ya incluyen el Preguntas.tex correcto con todas las preguntas.

## 📊 Información del Archivo

- **Total de líneas:** 1,086
- **Formato:** LaTeX con estructura `\begin{question}...\end{question}`
- **Preguntas:** Sobre lógica, proposiciones, conjuntos, etc.
- **Semanas:** Semana 3 en adelante
- **Dificultades:** Niveles 1, 2, 3

## 🚀 Para que se carguen las preguntas

Una vez que copies el archivo correcto:

```bash
cd backend
source venv/bin/activate

# Reinicia el servidor (Ctrl+C si está corriendo, luego:)
python app.py
```

Deberías ver:
```
Loaded 10 questions from Preguntas.tex  # (o el número que haya en tu archivo)
```

## ✅ Verificar que funcionó

1. Inicia sesión como estudiante (202012341 / student123)
2. Selecciona semana 3
3. Selecciona tema "lógica, proposiciones"
4. Selecciona dificultad 1
5. Deberías ver preguntas disponibles

## 🎓 Estructura de una pregunta en el archivo

```latex
\begin{question}{ID}{tema1, tema2}{dificultad}{respuesta_correcta}{semana}{
\textbf{Enunciado}

Contenido...

\begin{enumerate}
    \item a) Opción A
    \item b) Opción B
    \item c) Opción C
    \item d) Opción D
\end{enumerate}
}
\end{question}
```

**Parámetros:**
- `ID`: Número único de pregunta
- `tema`: Temas separados por comas
- `dificultad`: 1, 2 o 3
- `respuesta_correcta`: a, b, c o d
- `semana`: Semana del curso

## 📝 Para agregar más preguntas

Simplemente edita `backend/Preguntas.tex` siguiendo el formato y reinicia el servidor.

---

**Nota:** El archivo que generé inicialmente era solo de ejemplo. Este es el archivo real con las preguntas de tu clase.
