import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ChatQuiz.css';

const ChatQuiz = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
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
    const [isLoading, setIsLoading] = useState(false);
    const [showQuickOptions, setShowQuickOptions] = useState(false);
    const [quickOptions, setQuickOptions] = useState([]);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        addBotMessage(`¡Hola ${user.name}! 👋 Soy tu asistente de estudio.`);
        setTimeout(() => {
            addBotMessage("¿En qué semana estás? (escribe un número del 1 al 16)");
            setCurrentStep('select_week');
        }, 1000);
    }, []);

    const addBotMessage = (text, options = null) => {
        setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            type: 'bot',
            text,
            timestamp: new Date()
        }]);

        if (options) {
            setQuickOptions(options);
            setShowQuickOptions(true);
        } else {
            setShowQuickOptions(false);
            setQuickOptions([]);
        }
    };

    const addUserMessage = (text) => {
        setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            type: 'user',
            text,
            timestamp: new Date()
        }]);
        setInputValue('');
        setShowQuickOptions(false);
        setQuickOptions([]);
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() && quickOptions.length === 0) return;

        const message = inputValue.trim();
        addUserMessage(message);

        switch (currentStep) {
            case 'select_week':
                handleWeekSelect(parseInt(message));
                break;
            case 'select_theme':
                handleThemeSelect(message);
                break;
            case 'select_difficulty':
                handleDifficultySelect(parseInt(message));
                break;
            case 'answering':
                handleAnswer(message.toLowerCase());
                break;
            case 'results':
                handleResultsChoice(message);
                break;
            default:
                break;
        }
    };

    const handleQuickOption = (option) => {
        addUserMessage(option.text);

        switch (currentStep) {
            case 'select_theme':
                handleThemeSelect(option.value);
                break;
            case 'select_difficulty':
                handleDifficultySelect(option.value);
                break;
            case 'answering':
                handleAnswer(option.value);
                break;
            case 'results':
                handleResultsChoice(option.value);
                break;
            default:
                break;
        }
    };

    const handleWeekSelect = async (week) => {
        if (isNaN(week) || week < 1 || week > 16) {
            addBotMessage("Por favor escribe un número entre 1 y 16.");
            return;
        }

        setQuizState(prev => ({ ...prev, week }));
        setIsLoading(true);

        try {
            const response = await api.get('/quiz/themes', { params: { week } });
            const themesList = response.data.themes;
            setThemes(themesList);

            setTimeout(() => {
                addBotMessage("¡Perfecto! Ahora selecciona un tema:",
                    themesList.map(theme => ({ text: theme, value: theme }))
                );
                setCurrentStep('select_theme');
            }, 500);
        } catch (error) {
            addBotMessage("Hubo un error cargando los temas. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleThemeSelect = async (theme) => {
        setQuizState(prev => ({ ...prev, theme }));
        setIsLoading(true);

        try {
            const response = await api.get('/quiz/difficulties', {
                params: { week: quizState.week, theme }
            });
            const diffList = response.data.difficulties;

            setTimeout(() => {
                const difficultyLabels = {
                    1: 'Fácil',
                    2: 'Media',
                    3: 'Difícil'
                };

                addBotMessage("Genial. Selecciona la dificultad:",
                    diffList.map(diff => ({
                        text: difficultyLabels[diff] || `Nivel ${diff}`,
                        value: diff
                    }))
                );
                setCurrentStep('select_difficulty');
            }, 500);
        } catch (error) {
            addBotMessage("Hubo un error cargando las dificultades. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDifficultySelect = async (difficulty) => {
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
                addBotMessage(`¡Excelente! Preparé ${response.data.questions.length} preguntas para ti. ¡Empecemos! 🚀`);
                setTimeout(() => {
                    showNextQuestion(response.data.questions, 0);
                }, 1000);
            }, 500);
        } catch (error) {
            addBotMessage("Hubo un error generando el quiz. Intenta de nuevo.");
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
        setCurrentStep('answering');

        addBotMessage(`**Pregunta ${index + 1} de ${questions.length}**`);

        setTimeout(() => {
            addBotMessage(
                question.question_text,
                question.options.map((opt, i) => ({
                    text: `${String.fromCharCode(97 + i)}) ${opt}`,
                    value: String.fromCharCode(97 + i)
                }))
            );
        }, 500);
    };

    const handleAnswer = (answer) => {
        const question = quizState.questions[quizState.currentQuestion];
        const isCorrect = answer === question.correct_answer;

        const newAnswers = [...quizState.answers, {
            questionId: question.question_id,
            answer,
            isCorrect
        }];
        const newScore = isCorrect ? quizState.score + 1 : quizState.score;

        setQuizState(prev => ({
            ...prev,
            answers: newAnswers,
            score: newScore
        }));

        setTimeout(() => {
            if (isCorrect) {
                addBotMessage("✅ ¡Correcto!");
            } else {
                const correctOpt = question.options[question.correct_answer.charCodeAt(0) - 97];
                addBotMessage(`❌ Incorrecto. La respuesta correcta era: **${question.correct_answer})** ${correctOpt}`);
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

        addBotMessage(`🎉 ¡Quiz completado!`);

        setTimeout(() => {
            addBotMessage(`Tu puntuación: **${quizState.score}/${quizState.questions.length}** (${percentage.toFixed(0)}%)`);

            setTimeout(() => {
                if (percentage >= 80) {
                    addBotMessage("¡Excelente trabajo! 🌟 Dominas muy bien este tema.");
                } else if (percentage >= 60) {
                    addBotMessage("¡Buen trabajo! 👍 Sigue practicando para mejorar.");
                } else {
                    addBotMessage("Sigue estudiando. 📚 ¡Tú puedes mejorar!");
                }

                setTimeout(() => {
                    addBotMessage("¿Quieres hacer otro quiz?", [
                        { text: 'Sí, otro quiz', value: 'yes' },
                        { text: 'No, salir', value: 'no' }
                    ]);
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
        if (choice.toLowerCase().includes('s') || choice === 'yes') {
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
                addBotMessage("¡Genial! ¿En qué semana estás? (1-16)");
                setCurrentStep('select_week');
            }, 500);
        } else {
            addBotMessage("¡Gracias por practicar! Hasta pronto 👋");
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

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
                                <div dangerouslySetInnerHTML={{ __html: message.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
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

                {showQuickOptions && quickOptions.length > 0 && (
                    <div className="quick-options-message">
                        <div className="quick-options-grid">
                            {quickOptions.map((option, idx) => (
                                <button
                                    key={idx}
                                    className="quick-option-btn"
                                    onClick={() => handleQuickOption(option)}
                                >
                                    {option.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <input
                    ref={inputRef}
                    type="text"
                    className="chat-input"
                    placeholder="Escribe tu respuesta..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading || showQuickOptions}
                />
                <button
                    className="send-button"
                    onClick={handleSendMessage}
                    disabled={isLoading || (!inputValue.trim() && !showQuickOptions)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default ChatQuiz;