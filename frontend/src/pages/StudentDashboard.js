import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/Dashboard.css';

const StudentDashboard = () => {
    const { user, logout } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [stats, setStats] = useState(null);
    const [performanceByTheme, setPerformanceByTheme] = useState([]);
    const [performanceByDifficulty, setPerformanceByDifficulty] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Get all sessions
            const sessionsRes = await api.get('/quiz/sessions');
            const allSessions = sessionsRes.data.sessions;
            setSessions(allSessions);

            // Calculate stats
            const completedSessions = allSessions.filter(s => s.status === 'completed');
            const totalQuestions = completedSessions.reduce((sum, s) => sum + s.total_questions, 0);
            const correctAnswers = completedSessions.reduce((sum, s) => sum + s.correct_answers, 0);
            const accuracy = totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(1) : 0;

            setStats({
                total_sessions: allSessions.length,
                completed_sessions: completedSessions.length,
                total_questions: totalQuestions,
                correct_answers: correctAnswers,
                accuracy: accuracy,
                current_streak: calculateStreak(completedSessions)
            });

            // Calculate performance by theme
            const themePerformance = calculatePerformanceByTheme(completedSessions);
            setPerformanceByTheme(themePerformance);

            // Calculate performance by difficulty
            const difficultyPerformance = calculatePerformanceByDifficulty(completedSessions);
            setPerformanceByDifficulty(difficultyPerformance);

            // Recent activity (last 10 sessions)
            const recent = allSessions
                .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
                .slice(0, 10);
            setRecentActivity(recent);

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
        setLoading(false);
    };

    const calculateStreak = (sessions) => {
        if (sessions.length === 0) return 0;

        const sorted = sessions.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
        let streak = 0;

        for (let session of sorted) {
            if (session.correct_answers > session.total_questions / 2) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    };

    const calculatePerformanceByTheme = (sessions) => {
        const themeMap = {};

        sessions.forEach(session => {
            if (!session.theme) return;

            if (!themeMap[session.theme]) {
                themeMap[session.theme] = {
                    theme: session.theme,
                    total_questions: 0,
                    correct_answers: 0,
                    sessions: 0
                };
            }

            themeMap[session.theme].total_questions += session.total_questions;
            themeMap[session.theme].correct_answers += session.correct_answers;
            themeMap[session.theme].sessions += 1;
        });

        return Object.values(themeMap).map(theme => ({
            ...theme,
            accuracy: theme.total_questions > 0
                ? ((theme.correct_answers / theme.total_questions) * 100).toFixed(1)
                : 0
        }));
    };

    const calculatePerformanceByDifficulty = (sessions) => {
        const diffMap = {};

        sessions.forEach(session => {
            if (!session.difficulty) return;

            if (!diffMap[session.difficulty]) {
                diffMap[session.difficulty] = {
                    difficulty: session.difficulty,
                    total_questions: 0,
                    correct_answers: 0,
                    sessions: 0
                };
            }

            diffMap[session.difficulty].total_questions += session.total_questions;
            diffMap[session.difficulty].correct_answers += session.correct_answers;
            diffMap[session.difficulty].sessions += 1;
        });

        return Object.values(diffMap).map(diff => ({
            ...diff,
            accuracy: diff.total_questions > 0
                ? ((diff.correct_answers / diff.total_questions) * 100).toFixed(1)
                : 0
        }));
    };

    const loadSessionDetails = async (sessionId) => {
        try {
            const response = await api.get(`/quiz/session/${sessionId}`);
            setSelectedSession(response.data.session);
        } catch (error) {
            console.error('Error loading session details:', error);
        }
    };

    const getAccuracyColor = (accuracy) => {
        if (accuracy >= 80) return '#10b981';
        if (accuracy >= 60) return '#f59e0b';
        return '#ef4444';
    };

    const getAccuracyLabel = (accuracy) => {
        if (accuracy >= 80) return 'Excelente';
        if (accuracy >= 60) return 'Bien';
        return 'Mejorar';
    };

    if (loading) {
        return <div className="loading">Cargando dashboard...</div>;
    }

    return (
        <div className="dashboard-container">
            <nav className="dashboard-nav">
                <h2>Mi Dashboard</h2>
                <div>
                    <span>Estudiante: {user?.name || user?.student_number}</span>
                    <button onClick={logout} className="btn-secondary">Cerrar Sesión</button>
                </div>
            </nav>

            <div className="dashboard-tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    Resumen
                </button>
                <button
                    className={activeTab === 'performance' ? 'active' : ''}
                    onClick={() => setActiveTab('performance')}
                >
                    Rendimiento
                </button>
                <button
                    className={activeTab === 'history' ? 'active' : ''}
                    onClick={() => setActiveTab('history')}
                >
                    Historial
                </button>
            </div>

            <div className="dashboard-content">
                {activeTab === 'overview' && stats && (
                    <div className="overview-section">
                        <h3>Resumen General</h3>
                        <div className="stats-grid">
                            <div className="stat-card">
                                <h4>Sesiones Completadas</h4>
                                <p className="stat-number">{stats.completed_sessions}</p>
                                <span className="stat-label">de {stats.total_sessions} totales</span>
                            </div>
                            <div className="stat-card">
                                <h4>Preguntas Respondidas</h4>
                                <p className="stat-number">{stats.total_questions}</p>
                                <span className="stat-label">{stats.correct_answers} correctas</span>
                            </div>
                            <div className="stat-card">
                                <h4>Precisión Global</h4>
                                <p className="stat-number" style={{ color: getAccuracyColor(stats.accuracy) }}>
                                    {stats.accuracy}%
                                </p>
                                <span className="stat-label">{getAccuracyLabel(stats.accuracy)}</span>
                            </div>
                            <div className="stat-card streak-card">
                                <h4>Racha Actual</h4>
                                <p className="stat-number">🔥 {stats.current_streak}</p>
                                <span className="stat-label">sesiones exitosas</span>
                            </div>
                        </div>

                        <div className="quick-stats-section">
                            <h3>Rendimiento Rápido</h3>
                            <div className="quick-stats-grid">
                                <div className="quick-stat-card">
                                    <h5>Mejor Tema</h5>
                                    {performanceByTheme.length > 0 ? (
                                        <>
                                            <p className="quick-stat-value">
                                                {performanceByTheme.sort((a, b) => b.accuracy - a.accuracy)[0].theme}
                                            </p>
                                            <span className="quick-stat-detail">
                        {performanceByTheme.sort((a, b) => b.accuracy - a.accuracy)[0].accuracy}% precisión
                      </span>
                                        </>
                                    ) : (
                                        <p className="quick-stat-value">-</p>
                                    )}
                                </div>
                                <div className="quick-stat-card">
                                    <h5>Tema a Mejorar</h5>
                                    {performanceByTheme.length > 0 ? (
                                        <>
                                            <p className="quick-stat-value">
                                                {performanceByTheme.sort((a, b) => a.accuracy - b.accuracy)[0].theme}
                                            </p>
                                            <span className="quick-stat-detail">
                        {performanceByTheme.sort((a, b) => a.accuracy - b.accuracy)[0].accuracy}% precisión
                      </span>
                                        </>
                                    ) : (
                                        <p className="quick-stat-value">-</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="recent-activity-section">
                            <h3>Actividad Reciente</h3>
                            <div className="activity-list">
                                {recentActivity.slice(0, 5).map(session => (
                                    <div key={session.id} className="activity-item">
                                        <div className="activity-icon" style={{
                                            background: session.status === 'completed' ? '#d1fae5' : '#fee2e2'
                                        }}>
                                            {session.status === 'completed' ? '✓' : '○'}
                                        </div>
                                        <div className="activity-content">
                                            <div className="activity-header">
                                                <span className="activity-theme">{session.theme || 'Quiz'}</span>
                                                <span className="activity-date">
                          {new Date(session.started_at).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short'
                          })}
                        </span>
                                            </div>
                                            <div className="activity-details">
                                                <span>Nivel {session.difficulty}</span>
                                                <span>•</span>
                                                <span>{session.correct_answers}/{session.total_questions} correctas</span>
                                                <span>•</span>
                                                <span style={{ color: getAccuracyColor(
                                                        (session.correct_answers / session.total_questions) * 100
                                                    )}}>
                          {((session.correct_answers / session.total_questions) * 100).toFixed(0)}%
                        </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'performance' && (
                    <div className="performance-section">
                        <h3>Rendimiento por Tema</h3>
                        <div className="performance-cards">
                            {performanceByTheme.map(theme => (
                                <div key={theme.theme} className="performance-card">
                                    <div className="performance-header">
                                        <h4>{theme.theme}</h4>
                                        <span className="performance-badge" style={{
                                            background: getAccuracyColor(theme.accuracy),
                                            color: 'white'
                                        }}>
                      {theme.accuracy}%
                    </span>
                                    </div>
                                    <div className="performance-stats">
                                        <div className="performance-stat">
                                            <span className="stat-value">{theme.sessions}</span>
                                            <span className="stat-label">sesiones</span>
                                        </div>
                                        <div className="performance-stat">
                                            <span className="stat-value">{theme.total_questions}</span>
                                            <span className="stat-label">preguntas</span>
                                        </div>
                                        <div className="performance-stat">
                                            <span className="stat-value">{theme.correct_answers}</span>
                                            <span className="stat-label">correctas</span>
                                        </div>
                                    </div>
                                    <div className="performance-bar">
                                        <div
                                            className="performance-fill"
                                            style={{
                                                width: `${theme.accuracy}%`,
                                                background: getAccuracyColor(theme.accuracy)
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <h3>Rendimiento por Dificultad</h3>
                        <div className="difficulty-performance">
                            {performanceByDifficulty.sort((a, b) => a.difficulty - b.difficulty).map(diff => {
                                const diffLabels = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };
                                return (
                                    <div key={diff.difficulty} className="difficulty-card">
                                        <div className="difficulty-header">
                                            <h4>{diffLabels[diff.difficulty] || `Nivel ${diff.difficulty}`}</h4>
                                            <span className="difficulty-accuracy" style={{
                                                color: getAccuracyColor(diff.accuracy)
                                            }}>
                        {diff.accuracy}%
                      </span>
                                        </div>
                                        <div className="difficulty-progress">
                                            <div
                                                className="difficulty-progress-bar"
                                                style={{
                                                    width: `${diff.accuracy}%`,
                                                    background: getAccuracyColor(diff.accuracy)
                                                }}
                                            />
                                        </div>
                                        <div className="difficulty-stats">
                                            <span>{diff.correct_answers} de {diff.total_questions} correctas</span>
                                            <span>{diff.sessions} sesiones</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="history-section">
                        {!selectedSession ? (
                            <>
                                <h3>Historial de Sesiones</h3>
                                <div className="sessions-list">
                                    {sessions.length === 0 ? (
                                        <div className="empty-state">
                                            <p>No has completado ninguna sesión aún.</p>
                                            <p>¡Comienza un quiz para ver tu progreso aquí!</p>
                                        </div>
                                    ) : (
                                        <table>
                                            <thead>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Tema</th>
                                                <th>Dificultad</th>
                                                <th>Preguntas</th>
                                                <th>Correctas</th>
                                                <th>Precisión</th>
                                                <th>Estado</th>
                                                <th>Acciones</th>
                                            </tr>
                                            </thead>
                                            <tbody>
                                            {sessions.map(session => {
                                                const accuracy = session.total_questions > 0
                                                    ? ((session.correct_answers / session.total_questions) * 100).toFixed(0)
                                                    : 0;
                                                return (
                                                    <tr key={session.id}>
                                                        <td>
                                                            {new Date(session.started_at).toLocaleDateString('es-CO', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </td>
                                                        <td>{session.theme || '-'}</td>
                                                        <td>Nivel {session.difficulty || '-'}</td>
                                                        <td>{session.total_questions}</td>
                                                        <td>{session.correct_answers}</td>
                                                        <td>
                                <span style={{ color: getAccuracyColor(accuracy) }}>
                                  {accuracy}%
                                </span>
                                                        </td>
                                                        <td>
                                <span className={`status-badge ${session.status}`}>
                                  {session.status === 'completed' ? 'Completado' : 'En progreso'}
                                </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() => loadSessionDetails(session.id)}
                                                                className="btn-small"
                                                            >
                                                                Ver Detalles
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="session-details">
                                <button onClick={() => setSelectedSession(null)} className="btn-secondary">
                                    ← Volver
                                </button>
                                <h3>Detalles de la Sesión</h3>

                                <div className="session-info-grid">
                                    <div className="session-info-card">
                                        <h5>Información General</h5>
                                        <p><strong>Tema:</strong> {selectedSession.theme}</p>
                                        <p><strong>Dificultad:</strong> Nivel {selectedSession.difficulty}</p>
                                        <p><strong>Fecha:</strong> {new Date(selectedSession.started_at).toLocaleDateString('es-CO')}</p>
                                        <p><strong>Duración:</strong> {selectedSession.completed_at
                                            ? `${Math.round((new Date(selectedSession.completed_at) - new Date(selectedSession.started_at)) / 60000)} min`
                                            : 'En progreso'}
                                        </p>
                                    </div>

                                    <div className="session-info-card">
                                        <h5>Resultados</h5>
                                        <p><strong>Total preguntas:</strong> {selectedSession.total_questions}</p>
                                        <p><strong>Correctas:</strong> {selectedSession.correct_answers}</p>
                                        <p><strong>Incorrectas:</strong> {selectedSession.total_questions - selectedSession.correct_answers}</p>
                                        <p>
                                            <strong>Precisión:</strong>
                                            <span style={{
                                                color: getAccuracyColor((selectedSession.correct_answers / selectedSession.total_questions) * 100),
                                                marginLeft: '8px'
                                            }}>
                        {((selectedSession.correct_answers / selectedSession.total_questions) * 100).toFixed(1)}%
                      </span>
                                        </p>
                                    </div>
                                </div>

                                {selectedSession.answers && selectedSession.answers.length > 0 && (
                                    <>
                                        <h4>Respuestas Detalladas</h4>
                                        <div className="answers-list">
                                            {selectedSession.answers.map((answer, idx) => (
                                                <div key={answer.id} className="answer-item">
                                                    <div className="answer-number">
                                                        {idx + 1}
                                                    </div>
                                                    <div className="answer-content">
                                                        <div className="answer-header">
                                                            <span className="answer-id">Pregunta #{answer.question_id}</span>
                                                            <span className={`answer-result ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                                {answer.is_correct ? '✓ Correcto' : '✗ Incorrecto'}
                              </span>
                                                        </div>
                                                        <p className="answer-text">
                                                            <strong>Tu respuesta:</strong> {answer.user_answer?.toUpperCase()}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;