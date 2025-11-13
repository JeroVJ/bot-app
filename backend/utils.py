import re
import tempfile
import subprocess
import pypandoc

def normalize_answer(answer):
    """Normalize answer to lowercase and strip whitespace"""
    return answer.lower().strip()

def convert_latex_to_html(latex_string):
    """
    Convert LaTeX string to HTML using Pandoc
    """
    try:
        # Ensure pandoc is available
        pandoc_path = pypandoc.get_pandoc_path()
        
        # Create a temporary file with the LaTeX content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.tex', delete=False, encoding='utf-8') as temp_tex:
            temp_tex.write(latex_string)
            temp_tex_path = temp_tex.name
        
        # Create a temporary file for HTML output
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False, encoding='utf-8') as temp_html:
            temp_html_path = temp_html.name
        
        # Convert using pandoc
        subprocess.run(
            [pandoc_path, temp_tex_path, "-o", temp_html_path, "--mathjax"],
            check=True,
            capture_output=True
        )
        
        # Read the HTML output
        with open(temp_html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        return html_content
    except Exception as e:
        print(f"Error converting LaTeX to HTML: {str(e)}")
        return f"<p>Error converting LaTeX: {str(e)}</p>"

def parse_question_from_latex(latex_block):
    """
    Parse a question from LaTeX format
    Returns dict with question details
    """
    try:
        # Extract question metadata using a more flexible regex
        # Format: \begin{question}{id}{tema}{dif}{res}{week}{content}
        pattern = r'\\begin\{question\}\{(\d+)\}\{([^}]+)\}\{(\d+)\}\{([a-d])\}\{(\d+)\}\{(.*)'
        match = re.search(pattern, latex_block, re.DOTALL)
        
        if match:
            # Get the content between { and \end{question}
            full_content = match.group(6)
            # Remove the closing \end{question}
            content = full_content.rsplit('}\\end{question}', 1)[0] if '}\\end{question}' in full_content else full_content
            
            return {
                'question_id': int(match.group(1)),
                'theme': match.group(2).strip(),
                'difficulty': int(match.group(3)),
                'correct_answer': match.group(4).strip(),
                'week': int(match.group(5)),
                'content': content.strip()
            }
        return None
    except Exception as e:
        print(f"Error parsing question: {str(e)}")
        return None

def load_questions_from_tex(tex_file_path):
    """
    Load all questions from a .tex file
    Returns list of question dictionaries
    """
    try:
        with open(tex_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find all question blocks
        question_blocks = re.findall(
            r'\\begin\{question\}.*?\\end\{question\}',
            content,
            re.DOTALL
        )
        
        questions = []
        for block in question_blocks:
            question = parse_question_from_latex(block)
            if question:
                questions.append(question)
        
        return questions
    except Exception as e:
        print(f"Error loading questions from tex: {str(e)}")
        return []

def get_available_themes(questions, week=None):
    """
    Get available themes from questions, optionally filtered by week
    """
    themes = set()
    for q in questions:
        if week is None or q['week'] <= week:
            # Split themes by comma
            question_themes = [t.strip() for t in q['theme'].split(',')]
            themes.update(question_themes)
    return sorted(list(themes))

def get_available_difficulties(questions, themes=None, week=None):
    """
    Get available difficulties for given themes and week
    """
    difficulties = set()
    for q in questions:
        if week is None or q['week'] <= week:
            question_themes = [t.strip().lower() for t in q['theme'].split(',')]
            if themes is None or any(t.lower() in question_themes for t in themes):
                difficulties.add(q['difficulty'])
    return sorted(list(difficulties))

def filter_questions(questions, themes=None, difficulty=None, week=None):
    """
    Filter questions by themes, difficulty, and week
    """
    filtered = []
    for q in questions:
        # Check week
        if week is not None and q['week'] > week:
            continue
        
        # Check difficulty
        if difficulty is not None and q['difficulty'] != difficulty:
            continue
        
        # Check themes
        if themes is not None:
            question_themes = [t.strip().lower() for t in q['theme'].split(',')]
            if not any(t.lower() in question_themes for t in themes):
                continue
        
        filtered.append(q)
    
    return filtered
