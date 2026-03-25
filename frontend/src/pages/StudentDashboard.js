import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Progress } from '../components/ui/Progress';
import { Spinner } from '../components/ui/Spinner';
import { Stat } from '../components/ui/Stat';
import { cn } from '../lib/utils';
import {
    BarChart3, CheckCircle, BookOpen, Flame, TrendingUp,
    TrendingDown, Clock, ChevronRight, ArrowLeft
} from 'lucide-react';

const StudentDashboard = () => {
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
            const sessionsRes = await api.get('/quiz/sessions');
            const allSessions = sessionsRes.data.sessions;
            setSessions(allSessions);

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

            setPerformanceByTheme(calculatePerformanceByTheme(completedSessions));
            setPerformanceByDifficulty(calculatePerformanceByDifficulty(completedSessions));

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
            if (session.correct_answers > session.total_questions / 2) { streak++; }
            else { break; }
        }
        return streak;
    };

    const calculatePerformanceByTheme = (sessions) => {
        const themeMap = {};
        sessions.forEach(session => {
            if (!session.theme) return;
            if (!themeMap[session.theme]) {
                themeMap[session.theme] = { theme: session.theme, total_questions: 0, correct_answers: 0, sessions: 0 };
            }
            themeMap[session.theme].total_questions += session.total_questions;
            themeMap[session.theme].correct_answers += session.correct_answers;
            themeMap[session.theme].sessions += 1;
        });
        return Object.values(themeMap).map(theme => ({
            ...theme,
            accuracy: theme.total_questions > 0 ? ((theme.correct_answers / theme.total_questions) * 100).toFixed(1) : 0
        }));
    };

    const calculatePerformanceByDifficulty = (sessions) => {
        const diffMap = {};
        sessions.forEach(session => {
            if (!session.difficulty) return;
            if (!diffMap[session.difficulty]) {
                diffMap[session.difficulty] = { difficulty: session.difficulty, total_questions: 0, correct_answers: 0, sessions: 0 };
            }
            diffMap[session.difficulty].total_questions += session.total_questions;
            diffMap[session.difficulty].correct_answers += session.correct_answers;
            diffMap[session.difficulty].sessions += 1;
        });
        return Object.values(diffMap).map(diff => ({
            ...diff,
            accuracy: diff.total_questions > 0 ? ((diff.correct_answers / diff.total_questions) * 100).toFixed(1) : 0
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

    const getAccuracyBadgeVariant = (accuracy) => {
        if (accuracy >= 80) return 'success';
        if (accuracy >= 60) return 'warning';
        return 'danger';
    };

    const getAccuracyLabel = (accuracy) => {
        if (accuracy >= 80) return 'Excelente';
        if (accuracy >= 60) return 'Bien';
        return 'Mejorar';
    };

    const getProgressColor = (accuracy) => {
        if (accuracy >= 80) return 'bg-emerald-500';
        if (accuracy >= 60) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const diffLabels = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'performance', label: 'Rendimiento' },
        { id: 'history', label: 'Historial' },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-zinc-950">
                <div className="flex flex-col items-center gap-3">
                    <Spinner size="xl" />
                    <p className="text-sm text-zinc-500">Cargando dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-zinc-950 p-6">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-xl font-bold text-zinc-100">Mi Dashboard</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Sigue tu progreso y rendimiento académico</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-zinc-800">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                            activeTab === tab.id
                                ? 'text-zinc-100 border-blue-500'
                                : 'text-zinc-500 border-transparent hover:text-zinc-300'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Stat
                            title="Sesiones completadas"
                            value={stats.completed_sessions}
                            description={`de ${stats.total_sessions} totales`}
                            icon={CheckCircle}
                            iconColor="text-emerald-400"
                            iconBg="bg-emerald-500/10"
                        />
                        <Stat
                            title="Preguntas respondidas"
                            value={stats.total_questions}
                            description={`${stats.correct_answers} correctas`}
                            icon={BookOpen}
                            iconColor="text-blue-400"
                            iconBg="bg-blue-500/10"
                        />
                        <Stat
                            title="Precisión global"
                            value={`${stats.accuracy}%`}
                            description={getAccuracyLabel(stats.accuracy)}
                            icon={BarChart3}
                            iconColor={stats.accuracy >= 80 ? 'text-emerald-400' : stats.accuracy >= 60 ? 'text-amber-400' : 'text-red-400'}
                            iconBg={stats.accuracy >= 80 ? 'bg-emerald-500/10' : stats.accuracy >= 60 ? 'bg-amber-500/10' : 'bg-red-500/10'}
                        />
                        <Stat
                            title="Racha actual"
                            value={stats.current_streak}
                            description="sesiones exitosas"
                            icon={Flame}
                            iconColor="text-orange-400"
                            iconBg="bg-orange-500/10"
                        />
                    </div>

                    {/* Best / Worst Theme */}
                    {performanceByTheme.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        <CardTitle>Mejor tema</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const best = [...performanceByTheme].sort((a, b) => b.accuracy - a.accuracy)[0];
                                        return (
                                            <div>
                                                <p className="text-zinc-100 font-medium text-sm mb-1 truncate">{best.theme}</p>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={best.accuracy} className="h-1.5 flex-1" color="bg-emerald-500" />
                                                    <span className="text-xs text-emerald-400 font-medium tabular-nums">{best.accuracy}%</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 mt-1">{best.sessions} sesiones · {best.correct_answers}/{best.total_questions} correctas</p>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <TrendingDown className="w-4 h-4 text-amber-400" />
                                        <CardTitle>Tema a mejorar</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {(() => {
                                        const worst = [...performanceByTheme].sort((a, b) => a.accuracy - b.accuracy)[0];
                                        return (
                                            <div>
                                                <p className="text-zinc-100 font-medium text-sm mb-1 truncate">{worst.theme}</p>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={worst.accuracy} className="h-1.5 flex-1" color={getProgressColor(worst.accuracy)} />
                                                    <span className="text-xs text-amber-400 font-medium tabular-nums">{worst.accuracy}%</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 mt-1">{worst.sessions} sesiones · {worst.correct_answers}/{worst.total_questions} correctas</p>
                                            </div>
                                        );
                                    })()}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* Recent Activity */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-zinc-400" />
                                <CardTitle>Actividad reciente</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {recentActivity.length === 0 ? (
                                <p className="text-sm text-zinc-500 py-4 text-center">No hay actividad reciente</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tema</TableHead>
                                            <TableHead>Dificultad</TableHead>
                                            <TableHead>Resultado</TableHead>
                                            <TableHead>Fecha</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentActivity.slice(0, 5).map(session => {
                                            const acc = session.total_questions > 0
                                                ? ((session.correct_answers / session.total_questions) * 100).toFixed(0)
                                                : 0;
                                            return (
                                                <TableRow key={session.id}>
                                                    <TableCell className="font-medium text-zinc-200">{session.theme || 'Quiz'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="default">{diffLabels[session.difficulty] || `Nivel ${session.difficulty}`}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant={getAccuracyBadgeVariant(acc)}>{acc}%</Badge>
                                                            <span className="text-zinc-500 text-xs">{session.correct_answers}/{session.total_questions}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-zinc-500">
                                                        {new Date(session.started_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Rendimiento Tab */}
            {activeTab === 'performance' && (
                <div className="space-y-6">
                    {/* By Theme */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-blue-400" />
                                <CardTitle>Rendimiento por tema</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {performanceByTheme.length === 0 ? (
                                <p className="text-sm text-zinc-500 py-4 text-center">No hay datos de temas aún</p>
                            ) : (
                                <div className="space-y-4">
                                    {[...performanceByTheme].sort((a, b) => b.accuracy - a.accuracy).map(theme => (
                                        <div key={theme.theme} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-zinc-200 truncate max-w-[60%]">{theme.theme}</span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-xs text-zinc-500">{theme.correct_answers}/{theme.total_questions}</span>
                                                    <Badge variant={getAccuracyBadgeVariant(theme.accuracy)}>{theme.accuracy}%</Badge>
                                                </div>
                                            </div>
                                            <Progress value={parseFloat(theme.accuracy)} className="h-1.5" color={getProgressColor(theme.accuracy)} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* By Difficulty */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                <CardTitle>Rendimiento por dificultad</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {performanceByDifficulty.length === 0 ? (
                                <p className="text-sm text-zinc-500 py-4 text-center">No hay datos de dificultad aún</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[...performanceByDifficulty].sort((a, b) => a.difficulty - b.difficulty).map(diff => (
                                        <div key={diff.difficulty} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-zinc-200">{diffLabels[diff.difficulty] || `Nivel ${diff.difficulty}`}</span>
                                                <Badge variant={getAccuracyBadgeVariant(diff.accuracy)}>{diff.accuracy}%</Badge>
                                            </div>
                                            <Progress value={parseFloat(diff.accuracy)} className="h-2 mb-3" color={getProgressColor(diff.accuracy)} />
                                            <div className="flex justify-between text-xs text-zinc-500">
                                                <span>{diff.correct_answers}/{diff.total_questions} correctas</span>
                                                <span>{diff.sessions} sesiones</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Historial Tab */}
            {activeTab === 'history' && (
                <div className="space-y-4">
                    {!selectedSession ? (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-zinc-400" />
                                    <CardTitle>Historial de sesiones</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                {sessions.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <BookOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-zinc-400">No hay sesiones aún</p>
                                        <p className="text-xs text-zinc-600 mt-1">¡Completa un quiz para ver tu historial aquí!</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tema</TableHead>
                                                <TableHead>Dificultad</TableHead>
                                                <TableHead>Resultado</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sessions.map(session => {
                                                const accuracy = session.total_questions > 0
                                                    ? ((session.correct_answers / session.total_questions) * 100).toFixed(0)
                                                    : 0;
                                                return (
                                                    <TableRow key={session.id}>
                                                        <TableCell className="font-medium text-zinc-200">{session.theme || '-'}</TableCell>
                                                        <TableCell>
                                                            <Badge>{diffLabels[session.difficulty] || `Nivel ${session.difficulty || '-'}`}</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant={getAccuracyBadgeVariant(accuracy)}>{accuracy}%</Badge>
                                                                <span className="text-zinc-500 text-xs">{session.correct_answers}/{session.total_questions}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={session.status === 'completed' ? 'success' : 'warning'}>
                                                                {session.status === 'completed' ? 'Completado' : 'En progreso'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-zinc-500">
                                                            {new Date(session.started_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </TableCell>
                                                        <TableCell>
                                                            <button
                                                                onClick={() => loadSessionDetails(session.id)}
                                                                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
                                                            >
                                                                Ver <ChevronRight className="w-3 h-3" />
                                                            </button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver al historial
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Información general</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Tema</span>
                                            <span className="text-zinc-200 font-medium">{selectedSession.theme}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Dificultad</span>
                                            <Badge>{diffLabels[selectedSession.difficulty] || `Nivel ${selectedSession.difficulty}`}</Badge>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Fecha</span>
                                            <span className="text-zinc-200">{new Date(selectedSession.started_at).toLocaleDateString('es-CO')}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Duración</span>
                                            <span className="text-zinc-200">
                                                {selectedSession.completed_at
                                                    ? `${Math.round((new Date(selectedSession.completed_at) - new Date(selectedSession.started_at)) / 60000)} min`
                                                    : 'En progreso'}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Resultados</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0 space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Total preguntas</span>
                                            <span className="text-zinc-200 font-medium">{selectedSession.total_questions}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Correctas</span>
                                            <span className="text-emerald-400 font-medium">{selectedSession.correct_answers}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-zinc-500">Incorrectas</span>
                                            <span className="text-red-400 font-medium">{selectedSession.total_questions - selectedSession.correct_answers}</span>
                                        </div>
                                        <div className="flex justify-between text-sm items-center">
                                            <span className="text-zinc-500">Precisión</span>
                                            <Badge variant={getAccuracyBadgeVariant((selectedSession.correct_answers / selectedSession.total_questions) * 100)}>
                                                {((selectedSession.correct_answers / selectedSession.total_questions) * 100).toFixed(1)}%
                                            </Badge>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {selectedSession.answers && selectedSession.answers.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Respuestas detalladas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>#</TableHead>
                                                    <TableHead>Pregunta</TableHead>
                                                    <TableHead>Tu respuesta</TableHead>
                                                    <TableHead>Resultado</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedSession.answers.map((answer, idx) => (
                                                    <TableRow key={answer.id}>
                                                        <TableCell className="text-zinc-500 font-mono">{idx + 1}</TableCell>
                                                        <TableCell className="text-zinc-400">#{answer.question_id}</TableCell>
                                                        <TableCell className="font-medium text-zinc-200">{answer.user_answer?.toUpperCase()}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={answer.is_correct ? 'success' : 'danger'}>
                                                                {answer.is_correct ? '✓ Correcto' : '✗ Incorrecto'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
