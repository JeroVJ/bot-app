import React, { useState, useEffect } from 'react';
import { teacherAPI } from '../services/api';
import BayesianNetworkTab from '../components/BayesianNetworkTab';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table';
import { Progress } from '../components/ui/Progress';
import { Spinner } from '../components/ui/Spinner';
import { Stat } from '../components/ui/Stat';
import { cn } from '../lib/utils';
import {
    Users, BookOpen, BarChart3, CheckCircle, TrendingUp,
    Activity, Search, ArrowLeft, Network, ChevronRight
} from 'lucide-react';

const TeacherDashboard = () => {
    const [stats, setStats] = useState(null);
    const [students, setStudents] = useState([]);
    const [themeStats, setThemeStats] = useState([]);
    const [difficultyStats, setDifficultyStats] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, studentsRes, themesRes, diffRes] = await Promise.all([
                teacherAPI.getDashboardStats(),
                teacherAPI.getStudents(),
                teacherAPI.getThemeStats(),
                teacherAPI.getDifficultyStats()
            ]);
            setStats(statsRes.data.stats);
            setStudents(studentsRes.data.students);
            setThemeStats(themesRes.data.theme_stats);
            setDifficultyStats(diffRes.data.difficulty_stats);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
        setLoading(false);
    };

    const loadStudentDetails = async (studentId) => {
        try {
            const response = await teacherAPI.getStudentDetails(studentId);
            setSelectedStudent(response.data);
        } catch (error) {
            console.error('Error loading student details:', error);
        }
    };

    const getAccuracyBadgeVariant = (accuracy) => {
        if (accuracy >= 80) return 'success';
        if (accuracy >= 60) return 'warning';
        return 'danger';
    };

    const getProgressColor = (accuracy) => {
        if (accuracy >= 80) return 'bg-emerald-500';
        if (accuracy >= 60) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const diffLabels = { 1: 'Fácil', 2: 'Media', 3: 'Difícil' };

    const filteredStudents = students.filter(s => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            s.student_number?.toLowerCase().includes(q) ||
            s.name?.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q)
        );
    });

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'students', label: 'Estudiantes', icon: Users },
        { id: 'analytics', label: 'Analítica', icon: TrendingUp },
        { id: 'bayesian', label: 'Red Bayesiana', icon: Network },
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
                <h1 className="text-xl font-bold text-zinc-100">Dashboard Docente</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Monitorea el progreso y rendimiento de tus estudiantes</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-zinc-800 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5',
                            activeTab === tab.id
                                ? 'text-zinc-100 border-blue-500'
                                : 'text-zinc-500 border-transparent hover:text-zinc-300'
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <Stat
                            title="Total estudiantes"
                            value={stats.total_students}
                            icon={Users}
                            iconColor="text-blue-400"
                            iconBg="bg-blue-500/10"
                        />
                        <Stat
                            title="Estudiantes activos"
                            value={stats.active_students}
                            description={`${stats.total_students > 0 ? ((stats.active_students / stats.total_students) * 100).toFixed(0) : 0}% del total`}
                            icon={Activity}
                            iconColor="text-emerald-400"
                            iconBg="bg-emerald-500/10"
                        />
                        <Stat
                            title="Sesiones totales"
                            value={stats.total_sessions}
                            icon={BookOpen}
                            iconColor="text-purple-400"
                            iconBg="bg-purple-500/10"
                        />
                        <Stat
                            title="Sesiones completadas"
                            value={stats.completed_sessions}
                            description={`${stats.total_sessions > 0 ? ((stats.completed_sessions / stats.total_sessions) * 100).toFixed(0) : 0}% completadas`}
                            icon={CheckCircle}
                            iconColor="text-emerald-400"
                            iconBg="bg-emerald-500/10"
                        />
                        <Stat
                            title="Preguntas respondidas"
                            value={stats.total_questions_answered?.toLocaleString() || 0}
                            icon={BarChart3}
                            iconColor="text-amber-400"
                            iconBg="bg-amber-500/10"
                        />
                        <Stat
                            title="Precisión promedio"
                            value={`${stats.average_accuracy}%`}
                            icon={TrendingUp}
                            iconColor={stats.average_accuracy >= 70 ? 'text-emerald-400' : 'text-amber-400'}
                            iconBg={stats.average_accuracy >= 70 ? 'bg-emerald-500/10' : 'bg-amber-500/10'}
                        />
                    </div>

                    {/* Top students preview */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-zinc-400" />
                                <CardTitle>Estudiantes recientes</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Estudiante</TableHead>
                                        <TableHead>Sesiones</TableHead>
                                        <TableHead>Precisión</TableHead>
                                        <TableHead>Última actividad</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.slice(0, 5).map(student => (
                                        <TableRow key={student.id} onClick={() => { loadStudentDetails(student.id); setActiveTab('students'); }}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium text-zinc-200">{student.name || student.student_number}</p>
                                                    {student.name && <p className="text-xs text-zinc-500">{student.student_number}</p>}
                                                </div>
                                            </TableCell>
                                            <TableCell>{student.stats.total_sessions}</TableCell>
                                            <TableCell>
                                                <Badge variant={getAccuracyBadgeVariant(student.stats.accuracy)}>{student.stats.accuracy}%</Badge>
                                            </TableCell>
                                            <TableCell className="text-zinc-500">
                                                {student.last_activity ? new Date(student.last_activity).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Estudiantes Tab */}
            {activeTab === 'students' && (
                <div className="space-y-4">
                    {!selectedStudent ? (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-zinc-400" />
                                        <CardTitle>Lista de estudiantes</CardTitle>
                                    </div>
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Buscar estudiante..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="h-8 pl-8 pr-3 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors w-48"
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Estudiante</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Sesiones</TableHead>
                                            <TableHead>Precisión</TableHead>
                                            <TableHead>Última actividad</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map(student => (
                                            <TableRow key={student.id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-zinc-200">{student.name || '-'}</p>
                                                        <p className="text-xs text-zinc-500">{student.student_number}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-zinc-400">{student.email || '-'}</TableCell>
                                                <TableCell>{student.stats.total_sessions}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getAccuracyBadgeVariant(student.stats.accuracy)}>{student.stats.accuracy}%</Badge>
                                                </TableCell>
                                                <TableCell className="text-zinc-500">
                                                    {student.last_activity ? new Date(student.last_activity).toLocaleDateString('es-CO') : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        onClick={() => loadStudentDetails(student.id)}
                                                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
                                                    >
                                                        Ver <ChevronRight className="w-3 h-3" />
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver a estudiantes
                            </button>

                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-sm font-bold text-white">
                                        {selectedStudent.student.name?.charAt(0)?.toUpperCase() || '?'}
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-zinc-100">
                                        {selectedStudent.student.name || selectedStudent.student.student_number}
                                    </h2>
                                    <p className="text-xs text-zinc-500">{selectedStudent.student.student_number} · {selectedStudent.student.email || 'Sin email'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Rendimiento por tema</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {selectedStudent.performance.by_theme.length === 0 ? (
                                            <p className="text-sm text-zinc-500 py-2">Sin datos de temas</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedStudent.performance.by_theme.map(theme => (
                                                    <div key={theme.theme} className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-zinc-300 truncate max-w-[60%]">{theme.theme}</span>
                                                            <Badge variant={getAccuracyBadgeVariant(theme.accuracy)} className="text-xs">{theme.accuracy}%</Badge>
                                                        </div>
                                                        <Progress value={parseFloat(theme.accuracy)} className="h-1" color={getProgressColor(theme.accuracy)} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Rendimiento por dificultad</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        {selectedStudent.performance.by_difficulty.length === 0 ? (
                                            <p className="text-sm text-zinc-500 py-2">Sin datos de dificultad</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedStudent.performance.by_difficulty.map(diff => (
                                                    <div key={diff.difficulty} className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-zinc-300">{diffLabels[diff.difficulty] || `Nivel ${diff.difficulty}`}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-zinc-500">{diff.correct_answers}/{diff.total_questions}</span>
                                                                <Badge variant={getAccuracyBadgeVariant(diff.accuracy)} className="text-xs">{diff.accuracy}%</Badge>
                                                            </div>
                                                        </div>
                                                        <Progress value={parseFloat(diff.accuracy)} className="h-1" color={getProgressColor(diff.accuracy)} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Analítica Tab */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-blue-400" />
                                <CardTitle>Análisis por tema</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {themeStats.length === 0 ? (
                                <p className="text-sm text-zinc-500 py-4 text-center">No hay datos de temas aún</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Tema</TableHead>
                                            <TableHead>Estudiantes</TableHead>
                                            <TableHead>Preguntas</TableHead>
                                            <TableHead>Correctas</TableHead>
                                            <TableHead>Precisión</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {themeStats.map(theme => (
                                            <TableRow key={theme.theme}>
                                                <TableCell className="font-medium text-zinc-200 max-w-[200px] truncate">{theme.theme}</TableCell>
                                                <TableCell>{theme.students_attempted}</TableCell>
                                                <TableCell>{theme.total_questions}</TableCell>
                                                <TableCell className="text-emerald-400">{theme.correct_answers}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 min-w-[100px]">
                                                        <Progress value={parseFloat(theme.accuracy)} className="h-1.5 flex-1" color={getProgressColor(theme.accuracy)} />
                                                        <Badge variant={getAccuracyBadgeVariant(theme.accuracy)}>{theme.accuracy}%</Badge>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                <CardTitle>Análisis por dificultad</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {difficultyStats.length === 0 ? (
                                <p className="text-sm text-zinc-500 py-4 text-center">No hay datos de dificultad aún</p>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {difficultyStats.map(diff => (
                                        <div key={diff.difficulty} className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-sm font-medium text-zinc-200">{diffLabels[diff.difficulty] || `Nivel ${diff.difficulty}`}</span>
                                                <Badge variant={getAccuracyBadgeVariant(diff.accuracy)}>{diff.accuracy}%</Badge>
                                            </div>
                                            <Progress value={parseFloat(diff.accuracy)} className="h-2 mb-3" color={getProgressColor(diff.accuracy)} />
                                            <div className="space-y-1 text-xs text-zinc-500">
                                                <div className="flex justify-between">
                                                    <span>Preguntas</span>
                                                    <span className="text-zinc-300">{diff.total_questions}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Correctas</span>
                                                    <span className="text-emerald-400">{diff.correct_answers}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Red Bayesiana Tab */}
            {activeTab === 'bayesian' && (
                <div>
                    <BayesianNetworkTab />
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
