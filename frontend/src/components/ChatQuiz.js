import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ChatQuiz.css';

const ChatQuiz = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [quizState, setQuizState] = useState({
    week: null,
    theme: null,
    difficulty: null,
    questions: [],
    currentQuestion: 0,
    answers: [],
    score: 0
  });
  const [themes, setThemes] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Mensaje de bienvenida
    addBotMessage(`¡Hola ${user.name}! 👋 Soy tu asistente de estudio. Vamos a crear un quiz personalizado para ti.`);
    setTimeout(() => {
      const weekOptions = Array.from({ length: 16 }, (_, i) => ({
        id: i + 1,
        text: `Semana ${i + 1}`,
        value: i + 1
      }));
      addBotMessage("¿En qué semana estás?", weekOptions);
      setCurrentStep('select_week');
    }, 1000);
  }, [user.name]);

  const addBotMessage = (text, options = null) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'bot',
      text,
      options,
      timestamp: new Date()
    }]);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      text,
      timestamp: new Date()
    }]);
  };

  const handleWeekSelect = async (week) => {
    addUserMessage(`Semana ${week}`);
    setQuizState(prev => ({ ...prev, week }));
    setIsLoading(true);

    try {
      const response = await api.get('/quiz/themes', { params: { week } });
      const themesList = response.data.themes;
      setThemes(themesList);
      
      setTimeout(() => {
        const themeOptions = themesList.map(theme => ({
          id: theme,
          text: theme,
          value: theme
        }));
        addBotMessage("¡Perfecto! Ahora, ¿qué tema quieres estudiar?", themeOptions);
        setCurrentStep('select_theme');
      }, 500);
    } catch (error) {
      addBotMessage("Hubo un error cargando los temas. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeSelect = async (theme) => {
    addUserMessage(theme);
    setQuizState(prev => ({ ...prev, theme }));
    setIsLoading(true);

    try {
      const response = await api.get('/quiz/difficulties', {
        params: { week: quizState.week, theme }
      });
      const diffList = response.data.difficulties;
      setDifficulties(diffList);
      
      setTimeout(() => {
        // Map difficulty numbers to labels
        const difficultyLabels = {
          1: 'Fácil',
          2: 'Media',
          3: 'Difícil'
        };
        
        const diffOptions = diffList.map(diff => ({
          id: diff,
          text: difficultyLabels[diff] || `Nivel ${diff}`,
          value: diff
        }));
        addBotMessage("Genial. ¿Qué nivel de dificultad prefieres?", diffOptions);
        setCurrentStep('select_difficulty');
      }, 500);
    } catch (error) {
      addBotMessage("Hubo un error cargando las dificultades. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDifficultySelect = async (difficulty) => {
    addUserMessage(difficulty);
    setQuizState(prev => ({ ...prev, difficulty }));
    setIsLoading(true);

    try {
      const response = await api.post('/quiz/generate', {
        week: quizState.week,
        theme: quizState.theme,
        difficulty,
        num_questions: 10
      });
      
      setQuizState(prev => ({
        ...prev,
        questions: response.data.questions,
        currentQuestion: 0
      }));

      setTimeout(() => {
        addBotMessage(`¡Excelente! He preparado ${response.data.questions.length} preguntas para ti. ¡Empecemos! 🚀`);
        setTimeout(() => {
          showNextQuestion(response.data.questions, 0);
        }, 1000);
      }, 500);
    } catch (error) {
      addBotMessage("Hubo un error generando el quiz. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const showNextQuestion = (questions, index) => {
    if (index >= questions.length) {
      showResults();
      return;
    }

    const question = questions[index];
    addBotMessage(`Pregunta ${index + 1} de ${questions.length}:`);
    
    setTimeout(() => {
      addBotMessage(
        question.question_text,
        question.options.map((opt, i) => ({
          id: String.fromCharCode(97 + i), // a, b, c, d
          text: opt,
          value: String.fromCharCode(97 + i)
        }))
      );
      setCurrentStep('answering');
    }, 500);
  };

  const handleAnswer = (questionId, answer) => {
    const question = quizState.questions[quizState.currentQuestion];
    addUserMessage(question.options[answer.charCodeAt(0) - 97]);

    const isCorrect = answer === question.correct_answer;
    const newAnswers = [...quizState.answers, { questionId, answer, isCorrect }];
    const newScore = isCorrect ? quizState.score + 1 : quizState.score;

    setQuizState(prev => ({
      ...prev,
      answers: newAnswers,
      score: newScore
    }));

    setTimeout(() => {
      if (isCorrect) {
        addBotMessage("¡Correcto! ✅");
      } else {
        addBotMessage(`Incorrecto. La respuesta correcta era: ${question.options[question.correct_answer.charCodeAt(0) - 97]} ❌`);
      }

      const nextIndex = quizState.currentQuestion + 1;
      setQuizState(prev => ({ ...prev, currentQuestion: nextIndex }));

      setTimeout(() => {
        showNextQuestion(quizState.questions, nextIndex);
      }, 1500);
    }, 500);
  };

  const showResults = async () => {
    const percentage = (quizState.score / quizState.questions.length) * 100;
    
    addBotMessage(`¡Quiz completado! 🎉`);
    
    setTimeout(() => {
      addBotMessage(
        `Tu puntuación: ${quizState.score}/${quizState.questions.length} (${percentage.toFixed(0)}%)`,
        null
      );

      setTimeout(() => {
        if (percentage >= 80) {
          addBotMessage("¡Excelente trabajo! 🌟 Dominas muy bien este tema.");
        } else if (percentage >= 60) {
          addBotMessage("¡Buen trabajo! 👍 Sigue practicando para mejorar.");
        } else {
          addBotMessage("Sigue estudiando. 📚 ¡Tú puedes mejorar!");
        }

        setTimeout(() => {
          addBotMessage(
            "¿Quieres intentar otro quiz?",
            [
              { id: 'yes', text: 'Sí, otro quiz', value: 'yes' },
              { id: 'no', text: 'No, ver mi progreso', value: 'no' }
            ]
          );
          setCurrentStep('results');
        }, 1000);
      }, 1000);
    }, 1000);

    // Guardar resultados
    try {
      await api.post('/quiz/submit', {
        week: quizState.week,
        theme: quizState.theme,
        difficulty: quizState.difficulty,
        score: quizState.score,
        total: quizState.questions.length,
        answers: quizState.answers
      });
    } catch (error) {
      console.error('Error saving quiz results:', error);
    }
  };

  const handleResultsChoice = (choice) => {
    if (choice === 'yes') {
      addUserMessage("Sí, otro quiz");
      // Reset y empezar de nuevo
      setQuizState({
        week: null,
        theme: null,
        difficulty: null,
        questions: [],
        currentQuestion: 0,
        answers: [],
        score: 0
      });
      setTimeout(() => {
        addBotMessage("¡Genial! Vamos a crear otro quiz. ¿En qué semana estás?");
        setCurrentStep('select_week');
      }, 500);
    } else {
      addUserMessage("No, ver mi progreso");
      // TODO: Navegar a dashboard de progreso
      setTimeout(() => {
        addBotMessage("El dashboard de progreso estará disponible pronto. Por ahora, ¿quieres hacer otro quiz?");
        setCurrentStep('select_week');
      }, 500);
    }
  };

  const handleOptionClick = (option) => {
    switch (currentStep) {
      case 'select_week':
        handleWeekSelect(option.value);
        break;
      case 'select_theme':
        handleThemeSelect(option.value);
        break;
      case 'select_difficulty':
        handleDifficultySelect(option.value);
        break;
      case 'answering':
        handleAnswer(quizState.questions[quizState.currentQuestion].question_id, option.value);
        break;
      case 'results':
        handleResultsChoice(option.value);
        break;
      default:
        break;
    }
  };

  // Encontrar el último mensaje con opciones
  const lastMessageWithOptions = [...messages].reverse().find(msg => msg.options);

  return (
    <div className="chat-quiz-container">
      <div className="chat-header">
        <div className="chat-header-content">
          <div className="chat-avatar">🤖</div>
          <div className="chat-header-text">
            <h2>Asistente de Estudio</h2>
            <p className="chat-status">En línea</p>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            {message.type === 'bot' && (
              <div className="message-avatar">🤖</div>
            )}
            <div className="message-content">
              <div className="message-bubble">
                <div dangerouslySetInnerHTML={{ __html: message.text }} />
              </div>
              <span className="message-time">
                {message.timestamp.toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </div>
            {message.type === 'user' && (
              <div className="message-avatar user-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="message bot">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="message-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {lastMessageWithOptions && (
        <div className="chat-options">
          <div className="options-grid">
            {lastMessageWithOptions.options.map((option) => (
              <button
                key={option.id}
                className="option-button"
                onClick={() => handleOptionClick(option)}
                disabled={isLoading}
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatQuiz;
