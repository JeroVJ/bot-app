import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { quizAPI } from '../services/api';
import '../styles/Quiz.css';

const QuizPage = () => {
  const { user, logout } = useAuth();
  const [stage, setStage] = useState('welcome');
  const [week, setWeek] = useState('');
  const [themes, setThemes] = useState([]);
  const [selectedThemes, setSelectedThemes] = useState([]);
  const [difficulty, setDifficulty] = useState('');
  const [difficulties, setDifficulties] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableCount, setAvailableCount] = useState(null);
  const questionRef = useRef(null);

  useEffect(() => {
    if (week) {
      loadThemes();
    }
  }, [week]);

  useEffect(() => {
    if (week && selectedThemes.length > 0) {
      loadDifficulties();
    }
  }, [week, selectedThemes]);

  useEffect(() => {
    // Render MathJax when question changes
    if (currentQuestion && questionRef.current) {
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([questionRef.current]).catch((err) => console.error(err));
      }
    }
  }, [currentQuestion]);

  useEffect(() => {
    if (week && selectedThemes.length > 0 && difficulty) {
      countAvailableQuestions();
    }
  }, [week, selectedThemes, difficulty]);

  const countAvailableQuestions = async () => {
    try {
      const response = await quizAPI.countQuestions({
        week: parseInt(week),
        themes: selectedThemes,
        difficulty: parseInt(difficulty)
      });
      setAvailableCount(response.data.count);
    } catch (error) {
      console.error('Error counting questions:', error);
      setAvailableCount(null);
    }
  };

  const loadThemes = async () => {
    try {
      const response = await quizAPI.getThemes(week);
      setThemes(response.data.themes);
    } catch (error) {
      console.error('Error loading themes:', error);
    }
  };

  const loadDifficulties = async () => {
    try {
      const response = await quizAPI.getDifficulties(week, selectedThemes);
      setDifficulties(response.data.difficulties);
    } catch (error) {
      console.error('Error loading difficulties:', error);
    }
  };

  const startQuiz = async () => {
    console.log('🚀 startQuiz called');
    console.log('  - week:', week);
    console.log('  - selectedThemes:', selectedThemes);
    console.log('  - difficulty:', difficulty);
    
    if (!week || selectedThemes.length === 0 || !difficulty) {
      setMessage('Por favor completa todos los campos');
      return;
    }

    setLoading(true);
    try {
      console.log('📝 Creating session...');
      const sessionResponse = await quizAPI.startSession({
        week: parseInt(week),
        theme: selectedThemes.join(', '),
        difficulty: parseInt(difficulty)
      });
      
      console.log('✅ Session created:', sessionResponse.data.session);
      setCurrentSession(sessionResponse.data.session);
      
      console.log('📚 Loading first question...');
      await loadQuestion();
      
      console.log('🎯 Setting stage to quiz');
      setStage('quiz');
      setMessage('');
    } catch (error) {
      console.error('❌ Error starting quiz:', error);
      setMessage('Error al iniciar el quiz: ' + (error.response?.data?.error || error.message));
    }
    setLoading(false);
  };

  const loadQuestion = async () => {
    console.log('🔍 loadQuestion called');
    console.log('  - week:', week);
    console.log('  - selectedThemes:', selectedThemes);
    console.log('  - difficulty:', difficulty);
    console.log('  - exclude_ids:', answeredQuestions.map(q => q.question_id));
    
    setLoading(true);
    try {
      const response = await quizAPI.getQuestion({
        week: parseInt(week),
        themes: selectedThemes,
        difficulty: parseInt(difficulty),
        exclude_ids: answeredQuestions.map(q => q.question_id)
      });

      console.log('📥 Response received:', response.data);

      if (response.data.question) {
        console.log('✅ Question loaded:', response.data.question.id);
        setCurrentQuestion(response.data.question);
        setUserAnswer('');
        setMessage('');
      } else {
        console.log('⚠️ No question available');
        if (answeredQuestions.length === 0) {
          // No hay preguntas para esta configuración
          setMessage('No hay preguntas disponibles para esta configuración. Intenta con otros temas o dificultad.');
          setStage('selectParams');
        } else {
          // Ya respondió todas las preguntas disponibles
          finishQuiz();
        }
      }
    } catch (error) {
      console.error('❌ Error loading question:', error);
      setMessage('Error al cargar pregunta: ' + (error.response?.data?.error || error.message));
    }
    setLoading(false);
  };

  const submitAnswer = async () => {
    if (!userAnswer) {
      setMessage('Por favor selecciona una respuesta');
      return;
    }

    setLoading(true);
    try {
      const response = await quizAPI.submitAnswer({
        session_id: currentSession.id,
        question_id: currentQuestion.id,
        user_answer: userAnswer
      });

      const result = response.data;
      
      // Crear nueva lista de preguntas respondidas incluyendo la actual
      const newAnsweredQuestions = [...answeredQuestions, {
        question_id: currentQuestion.id,
        is_correct: result.is_correct,
        user_answer: userAnswer,
        correct_answer: result.correct_answer
      }];
      
      setAnsweredQuestions(newAnsweredQuestions);

      setMessage(result.is_correct ? '¡Correcto! ✓' : `Incorrecto. La respuesta correcta era: ${result.correct_answer}`);

      // Esperar y cargar siguiente pregunta, excluyendo las ya respondidas
      setTimeout(async () => {
        try {
          const nextResponse = await quizAPI.getQuestion({
            week: parseInt(week),
            themes: selectedThemes,
            difficulty: parseInt(difficulty),
            exclude_ids: newAnsweredQuestions.map(q => q.question_id) // Usar la nueva lista
          });

          if (nextResponse.data.question) {
            setCurrentQuestion(nextResponse.data.question);
            setUserAnswer('');
            setMessage('');
          } else {
            finishQuiz();
          }
        } catch (error) {
          console.error('Error loading next question:', error);
          setMessage('Error al cargar siguiente pregunta');
        }
      }, 2000);
    } catch (error) {
      setMessage('Error al enviar respuesta: ' + (error.response?.data?.error || error.message));
    }
    setLoading(false);
  };

  const finishQuiz = async () => {
    if (currentSession) {
      try {
        await quizAPI.completeSession(currentSession.id);
      } catch (error) {
        console.error('Error completing session:', error);
      }
    }
    setStage('results');
  };

  const resetQuiz = () => {
    setStage('welcome');
    setWeek('');
    setSelectedThemes([]);
    setDifficulty('');
    setCurrentSession(null);
    setCurrentQuestion(null);
    setAnsweredQuestions([]);
    setMessage('');
  };

  const correctAnswers = answeredQuestions.filter(q => q.is_correct).length;
  const totalAnswers = answeredQuestions.length;

  return (
    <div className="quiz-container">
      <nav className="quiz-nav">
        <h2>Quiz App</h2>
        <div>
          <span>Bienvenido, {user?.name || user?.student_number}</span>
          <button onClick={logout} className="btn-secondary">Cerrar Sesión</button>
        </div>
      </nav>

      <div className="quiz-content">
        {stage === 'welcome' && (
          <div className="welcome-section">
            <h1>¡Bienvenido a PP-BOT!</h1>
            <p>Estás a punto de comenzar la práctica libre de ejercicios.</p>
            <p>Las preguntas son de opción múltiple: responde con a, b, c, o d.</p>
            <button onClick={() => setStage('selectParams')} className="btn-primary">
              Comenzar
            </button>
          </div>
        )}

        {stage === 'selectParams' && (
          <div className="params-section">
            <h2>Configuración del Quiz</h2>

            <div className="form-group">
              <label>¿En qué semana de universidad estás?</label>
              <input
                type="number"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="Ej: 3"
                min="1"
              />
            </div>

            {week && themes.length > 0 && (
              <div className="form-group">
                <label>Selecciona uno o más temas:</label>
                <div className="checkbox-group">
                  {themes.map(theme => (
                    <label key={theme} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedThemes.includes(theme)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedThemes([...selectedThemes, theme]);
                          } else {
                            setSelectedThemes(selectedThemes.filter(t => t !== theme));
                          }
                        }}
                      />
                      {theme}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {selectedThemes.length > 0 && difficulties.length > 0 && (
              <div className="form-group">
                <label>Selecciona la dificultad:</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {difficulties.map(diff => (
                    <option key={diff} value={diff}>Nivel {diff}</option>
                  ))}
                </select>
              </div>
            )}

            {availableCount !== null && (
              <div className="available-count" style={{
                padding: '10px',
                background: availableCount === 0 ? '#fee' : '#efe',
                borderRadius: '5px',
                marginTop: '10px',
                textAlign: 'center'
              }}>
                {availableCount === 0 ? (
                  <span style={{ color: '#c00' }}>⚠️ No hay preguntas disponibles con esta configuración</span>
                ) : (
                  <span style={{ color: '#060' }}>✓ {availableCount} pregunta{availableCount !== 1 ? 's' : ''} disponible{availableCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}

            {message && <div className="message error">{message}</div>}

            <button
              onClick={startQuiz}
              className="btn-primary"
              disabled={loading || !week || selectedThemes.length === 0 || !difficulty || availableCount === 0}
            >
              {loading ? 'Iniciando...' : 'Iniciar Quiz'}
            </button>
          </div>
        )}

        {stage === 'quiz' && currentQuestion && (
          <div className="question-section">
            <div className="question-header">
              <span>Pregunta {totalAnswers + 1}</span>
              <span>Tema: {currentQuestion.theme}</span>
              <span>Dificultad: {currentQuestion.difficulty}</span>
            </div>

            <div
              ref={questionRef}
              className="question-content"
              dangerouslySetInnerHTML={{ __html: currentQuestion.content }}
            />

            <div className="answer-options">
              {['a', 'b', 'c', 'd'].map(option => (
                <label key={option} className="answer-option">
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={userAnswer === option}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    disabled={loading}
                  />
                  <span>{option.toUpperCase()}</span>
                </label>
              ))}
            </div>

            {message && <div className={`message ${message.includes('Correcto') ? 'success' : 'error'}`}>{message}</div>}

            <div className="quiz-actions">
              <button onClick={submitAnswer} className="btn-primary" disabled={loading || !userAnswer}>
                {loading ? 'Enviando...' : 'Enviar Respuesta'}
              </button>
              <button onClick={finishQuiz} className="btn-secondary">
                Finalizar Quiz
              </button>
            </div>
          </div>
        )}

        {stage === 'results' && (
          <div className="results-section">
            <h2>¡Quiz Completado!</h2>
            <div className="results-stats">
              <p>Preguntas respondidas: {totalAnswers}</p>
              <p>Respuestas correctas: {correctAnswers}</p>
              <p>Respuestas incorrectas: {totalAnswers - correctAnswers}</p>
              <p>Precisión: {totalAnswers > 0 ? ((correctAnswers / totalAnswers) * 100).toFixed(1) : 0}%</p>
            </div>
            <button onClick={resetQuiz} className="btn-primary">
              Nuevo Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPage;
