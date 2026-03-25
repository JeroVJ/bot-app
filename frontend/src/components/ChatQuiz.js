import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Send, Bot, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

const ChatQuiz = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [currentStep, setCurrentStep] = useState('welcome');
    const [quizState, setQuizState] = useState({
        week: null, theme: null, difficulty: null,
        sessionId: null, currentQuestion: null,
        questionNumber: 0, totalQuestions: 10, score: 0, answers: []
    });
    const [themes, setThemes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showQuickOptions, setShowQuickOptions] = useState(false);
    const [quickOptions, setQuickOptions] = useState([]);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages]);
    useEffect(() => {
        if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise().catch(() => {});
    }, [messages]);

    useEffect(() => {
        addBotMessage(`¡Hola ${user.name || user.student_number}! Soy tu asistente de estudio.`);
        setTimeout(() => { addBotMessage('¿En qué semana estás? (escribe un número del 1 al 16)'); setCurrentStep('select_week'); }, 800);
    }, []);

    const addBotMessage = (text, options = null) => {
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), type: 'bot', text, timestamp: new Date() }]);
        if (options) { setQuickOptions(options); setShowQuickOptions(true); }
        else { setShowQuickOptions(false); setQuickOptions([]); }
    };
    const addUserMessage = (text) => {
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), type: 'user', text, timestamp: new Date() }]);
        setInputValue(''); setShowQuickOptions(false); setQuickOptions([]);
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim() && quickOptions.length === 0) return;
        const message = inputValue.trim();
        addUserMessage(message);
        switch (currentStep) {
            case 'select_week': handleWeekSelect(parseInt(message)); break;
            case 'select_theme': handleThemeSelect(message); break;
            case 'select_difficulty': handleDifficultySelect(parseInt(message)); break;
            case 'answering': handleAnswer(message.toLowerCase()); break;
            case 'results': handleResultsChoice(message); break;
            default: break;
        }
    };

    const handleQuickOption = (option) => {
        addUserMessage(option.text);
        switch (currentStep) {
            case 'select_theme': handleThemeSelect(option.value); break;
            case 'select_difficulty': handleDifficultySelect(option.value); break;
            case 'answering': handleAnswer(option.value); break;
            case 'results': handleResultsChoice(option.value); break;
            default: break;
        }
    };

    const handleQuickOptionWithNoQuestions = (option) => {
        if (currentStep === 'handle_no_questions') { addUserMessage(option.text); handleNoQuestionsChoice(option.value); }
        else handleQuickOption(option);
    };

    const handleWeekSelect = async (week) => {
        if (isNaN(week) || week < 1 || week > 16) { addBotMessage('Por favor escribe un número entre 1 y 16.'); return; }
        setQuizState(prev => ({ ...prev, week }));
        setIsLoading(true);
        try {
            const response = await api.get('/quiz/themes', { params: { week } });
            const themesList = response.data.themes;
            if (themesList.length === 0) { setTimeout(() => { addBotMessage(`⚠️ No hay temas disponibles para la semana ${week}.`); setCurrentStep('select_week'); }, 500); setIsLoading(false); return; }
            setThemes(themesList);
            setTimeout(() => { addBotMessage('¡Perfecto! Selecciona un tema:', themesList.map(t => ({ text: t, value: t }))); setCurrentStep('select_theme'); }, 400);
        } catch { addBotMessage('Error cargando temas. Intenta de nuevo.'); }
        finally { setIsLoading(false); }
    };

    const handleThemeSelect = async (theme) => {
        setQuizState(prev => ({ ...prev, theme }));
        setIsLoading(true);
        try {
            const response = await api.get('/quiz/difficulties', { params: { week: quizState.week, themes: theme } });
            const diffList = response.data.difficulties;
            if (diffList.length === 0) { setTimeout(() => { addBotMessage(`No hay preguntas para "${theme}". Selecciona otro:`, themes.map(t => ({ text: t, value: t }))); setCurrentStep('select_theme'); }, 400); setIsLoading(false); return; }
            setTimeout(() => {
                const labels = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };
                addBotMessage('Selecciona la dificultad:', diffList.map(d => ({ text: labels[d] || `Nivel ${d}`, value: d })));
                setCurrentStep('select_difficulty');
            }, 400);
        } catch { addBotMessage('Error cargando dificultades.'); }
        finally { setIsLoading(false); }
    };

    const handleDifficultySelect = async (difficulty) => {
        setIsLoading(true);
        try {
            const countResponse = await api.post('/quiz/count', { week: quizState.week, themes: [quizState.theme], difficulty });
            if (countResponse.data.count === 0) {
                setTimeout(() => { addBotMessage('⚠️ No hay preguntas disponibles. ¿Qué prefieres?', [{ text: 'Cambiar dificultad', value: 'change_difficulty' }, { text: 'Cambiar tema', value: 'change_theme' }, { text: 'Reiniciar', value: 'restart' }]); setCurrentStep('handle_no_questions'); }, 400);
                setIsLoading(false); return;
            }
            const startResponse = await api.post('/quiz/start', { week: quizState.week, theme: quizState.theme, difficulty });
            const sessionId = startResponse.data.session.id;
            setQuizState(prev => ({ ...prev, difficulty, sessionId, currentQuestion: null, questionNumber: 0, score: 0, answers: [] }));
            setTimeout(() => { addBotMessage('¡Excelente! El quiz se adapta a tu desempeño. ¡Empecemos! 🚀'); setTimeout(() => { fetchNextQuestion(sessionId, 10); }, 800); }, 400);
        } catch { addBotMessage('Error iniciando el quiz. Intenta de nuevo.'); }
        finally { setIsLoading(false); }
    };

    const fetchNextQuestion = async (sessionId, totalQuestions = 10) => {
        setIsLoading(true);
        try {
            const response = await api.post('/quiz/next', { session_id: sessionId, total_questions: totalQuestions });
            if (response.data.done) { showResults(sessionId); }
            else {
                const { question, question_number, total } = response.data;
                setQuizState(prev => ({ ...prev, currentQuestion: question, questionNumber: question_number, totalQuestions: total }));
                addBotMessage(`**Pregunta ${question_number} de ${total}**`);
                const letters = ['a', 'b', 'c', 'd'];
                const opts = question.options && question.options.length > 0
                  ? question.options.map((txt, i) => ({ text: `${letters[i].toUpperCase()}) ${txt}`, value: letters[i] }))
                  : letters.map(l => ({ text: l.toUpperCase(), value: l }));
                setTimeout(() => { addBotMessage(question.question_text, opts); setCurrentStep('answering'); }, 400);
            }
        } catch { addBotMessage('Error obteniendo la siguiente pregunta.'); }
        finally { setIsLoading(false); }
    };

    const handleAnswer = async (answer) => {
        const { currentQuestion, sessionId, totalQuestions } = quizState;
        if (!currentQuestion || !sessionId) return;
        setIsLoading(true);
        try {
            const answerResponse = await api.post('/quiz/answer', { session_id: sessionId, question_id: currentQuestion.question_id, user_answer: answer });
            const { is_correct, correct_answer } = answerResponse.data;
            setQuizState(prev => ({ ...prev, score: is_correct ? prev.score + 1 : prev.score, answers: [...prev.answers, { questionId: currentQuestion.question_id, answer, isCorrect: is_correct }] }));
            setTimeout(() => {
                if (is_correct) addBotMessage('✅ ¡Correcto!');
                else addBotMessage(`❌ Incorrecto. La respuesta era: **${correct_answer.toUpperCase()}**`);
                setTimeout(() => { fetchNextQuestion(sessionId, totalQuestions); }, 1200);
            }, 300);
        } catch { addBotMessage('Error al enviar respuesta.'); setIsLoading(false); }
    };

    const showResults = async (sessionId) => {
        setQuizState(prev => {
            const total = prev.answers.length || prev.totalQuestions;
            const pct = total > 0 ? (prev.score / total) * 100 : 0;
            addBotMessage('🎉 ¡Quiz completado!');
            setTimeout(() => {
                addBotMessage(`Tu puntuación: **${prev.score}/${total}** (${pct.toFixed(0)}%)`);
                setTimeout(() => {
                    if (pct >= 80) addBotMessage('¡Excelente trabajo! 🌟 Dominas muy bien este tema.');
                    else if (pct >= 60) addBotMessage('¡Buen trabajo! 👍 Sigue practicando.');
                    else addBotMessage('Sigue estudiando. 📚 ¡Tú puedes mejorar!');
                    setTimeout(() => { addBotMessage('¿Qué quieres hacer?', [{ text: 'Otro quiz', value: 'yes' }, { text: 'Cambiar configuración', value: 'change' }, { text: 'Ver dashboard', value: 'no' }]); setCurrentStep('results'); }, 800);
                }, 800);
            }, 600);
            return prev;
        });
        const sid = sessionId || quizState.sessionId;
        if (sid) { try { await api.post(`/quiz/session/${sid}/complete`); } catch { } }
    };

    const handleNoQuestionsChoice = async (choice) => {
        if (choice === 'change_difficulty') {
            setIsLoading(true);
            try {
                const r = await api.get('/quiz/difficulties', { params: { week: quizState.week, themes: quizState.theme } });
                const labels = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };
                setTimeout(() => { addBotMessage('Selecciona otra dificultad:', r.data.difficulties.map(d => ({ text: labels[d] || `Nivel ${d}`, value: d }))); setCurrentStep('select_difficulty'); }, 400);
            } catch { addBotMessage('Error cargando dificultades.'); }
            finally { setIsLoading(false); }
        } else if (choice === 'change_theme') {
            setTimeout(() => { addBotMessage('Selecciona otro tema:', themes.map(t => ({ text: t, value: t }))); setCurrentStep('select_theme'); }, 400);
        } else if (choice === 'restart') {
            setQuizState({ week: null, theme: null, difficulty: null, sessionId: null, currentQuestion: null, questionNumber: 0, totalQuestions: 10, score: 0, answers: [] });
            setTimeout(() => { addBotMessage('¿En qué semana estás? (1-16)'); setCurrentStep('select_week'); }, 400);
        }
    };

    const handleResultsChoice = (choice) => {
        if (choice === 'yes' || choice.toLowerCase().includes('s')) {
            setQuizState(prev => ({ ...prev, sessionId: null, currentQuestion: null, questionNumber: 0, score: 0, answers: [] }));
            setTimeout(() => { handleDifficultySelect(quizState.difficulty); }, 400);
        } else if (choice === 'change') {
            setQuizState({ week: null, theme: null, difficulty: null, sessionId: null, currentQuestion: null, questionNumber: 0, totalQuestions: 10, score: 0, answers: [] });
            setTimeout(() => { addBotMessage('¿En qué semana estás? (1-16)'); setCurrentStep('select_week'); }, 400);
        } else { addBotMessage('¡Hasta luego! Redirigiendo al dashboard...'); setTimeout(() => { navigate('/student/dashboard'); }, 1200); }
    };

    const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

    const formatText = (text) => text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    const isAnswering = currentStep === 'answering';
    const progress = quizState.totalQuestions > 0 ? (quizState.questionNumber / quizState.totalQuestions) * 100 : 0;

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-zinc-100">Asistente de Estudio</h2>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                <span className="text-xs text-zinc-500">En línea · Adaptativo</span>
                            </div>
                        </div>
                    </div>
                    {isAnswering && quizState.totalQuestions > 0 && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span className="text-xs text-zinc-400">{quizState.score} correctas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs text-zinc-500">{quizState.questionNumber}/{quizState.totalQuestions}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn('flex items-end gap-2 animate-slide-up', msg.type === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                        {msg.type === 'bot' && (
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mb-0.5">
                                <Bot className="w-3 h-3 text-white" />
                            </div>
                        )}
                        <div className={cn(
                            'max-w-[78%] px-4 py-2.5 text-sm leading-relaxed',
                            msg.type === 'bot'
                                ? 'bg-zinc-800 text-zinc-200 rounded-2xl rounded-tl-sm'
                                : 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                        )}>
                            <div className="question-html" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
                            <span className={cn('block text-xs mt-1', msg.type === 'bot' ? 'text-zinc-500' : 'text-blue-200')}>
                                {msg.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        {msg.type === 'user' && (
                            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 mb-0.5">
                                <span className="text-xs font-bold text-zinc-300">{user.name?.charAt(0)?.toUpperCase() || '?'}</span>
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-end gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3 h-3 text-white" />
                        </div>
                        <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
                            <div className="flex gap-1 items-center">
                                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                {showQuickOptions && quickOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 ml-8 animate-fade-in">
                        {quickOptions.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => currentStep === 'handle_no_questions'
                                    ? handleQuickOptionWithNoQuestions(opt)
                                    : handleQuickOption(opt)}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 border border-zinc-600 text-zinc-100 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all duration-150 active:scale-95"
                            >
                                {opt.text}
                            </button>
                        ))}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        className="flex-1 h-10 px-4 bg-zinc-800 border border-zinc-700 rounded-full text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder={showQuickOptions ? 'Selecciona una opción de arriba…' : 'Escribe tu respuesta…'}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading || showQuickOptions}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || (!inputValue.trim() && !showQuickOptions)}
                        className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                    >
                        <Send className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatQuiz;
