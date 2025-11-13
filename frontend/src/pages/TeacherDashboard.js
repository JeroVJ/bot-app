import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { teacherAPI } from '../services/api';
import '../styles/Dashboard.css';

const TeacherDashboard = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [themeStats, setThemeStats] = useState([]);
  const [difficultyStats, setDifficultyStats] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

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

  if (loading) {
    return <div className="loading">Cargando dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <h2>Dashboard - Profesor</h2>
        <div>
          <span>Profesor: {user?.name || user?.student_number}</span>
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
          className={activeTab === 'students' ? 'active' : ''} 
          onClick={() => setActiveTab('students')}
        >
          Estudiantes
        </button>
        <button 
          className={activeTab === 'analytics' ? 'active' : ''} 
          onClick={() => setActiveTab('analytics')}
        >
          Análisis
        </button>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && stats && (
          <div className="overview-section">
            <h3>Estadísticas Generales</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <h4>Total Estudiantes</h4>
                <p className="stat-number">{stats.total_students}</p>
              </div>
              <div className="stat-card">
                <h4>Estudiantes Activos</h4>
                <p className="stat-number">{stats.active_students}</p>
              </div>
              <div className="stat-card">
                <h4>Sesiones Totales</h4>
                <p className="stat-number">{stats.total_sessions}</p>
              </div>
              <div className="stat-card">
                <h4>Sesiones Completadas</h4>
                <p className="stat-number">{stats.completed_sessions}</p>
              </div>
              <div className="stat-card">
                <h4>Preguntas Respondidas</h4>
                <p className="stat-number">{stats.total_questions_answered}</p>
              </div>
              <div className="stat-card">
                <h4>Precisión Promedio</h4>
                <p className="stat-number">{stats.average_accuracy}%</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="students-section">
            <h3>Lista de Estudiantes</h3>
            {!selectedStudent ? (
              <div className="students-table">
                <table>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Sesiones</th>
                      <th>Precisión</th>
                      <th>Última Actividad</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id}>
                        <td>{student.student_number}</td>
                        <td>{student.name || '-'}</td>
                        <td>{student.email || '-'}</td>
                        <td>{student.stats.total_sessions}</td>
                        <td>{student.stats.accuracy}%</td>
                        <td>{student.last_activity ? new Date(student.last_activity).toLocaleDateString() : '-'}</td>
                        <td>
                          <button 
                            onClick={() => loadStudentDetails(student.id)}
                            className="btn-small"
                          >
                            Ver Detalles
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="student-details">
                <button onClick={() => setSelectedStudent(null)} className="btn-secondary">
                  ← Volver
                </button>
                <h4>Detalles de {selectedStudent.student.name || selectedStudent.student.student_number}</h4>
                
                <div className="student-info">
                  <p><strong>Número:</strong> {selectedStudent.student.student_number}</p>
                  <p><strong>Email:</strong> {selectedStudent.student.email || '-'}</p>
                  <p><strong>Sesiones:</strong> {selectedStudent.sessions.length}</p>
                </div>

                <h5>Rendimiento por Tema</h5>
                <table>
                  <thead>
                    <tr>
                      <th>Tema</th>
                      <th>Total Preguntas</th>
                      <th>Correctas</th>
                      <th>Precisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudent.performance.by_theme.map(theme => (
                      <tr key={theme.theme}>
                        <td>{theme.theme}</td>
                        <td>{theme.total_questions}</td>
                        <td>{theme.correct_answers}</td>
                        <td>{theme.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h5>Rendimiento por Dificultad</h5>
                <table>
                  <thead>
                    <tr>
                      <th>Nivel</th>
                      <th>Total Preguntas</th>
                      <th>Correctas</th>
                      <th>Precisión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudent.performance.by_difficulty.map(diff => (
                      <tr key={diff.difficulty}>
                        <td>Nivel {diff.difficulty}</td>
                        <td>{diff.total_questions}</td>
                        <td>{diff.correct_answers}</td>
                        <td>{diff.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="analytics-section">
            <h3>Análisis por Tema</h3>
            <table>
              <thead>
                <tr>
                  <th>Tema</th>
                  <th>Estudiantes</th>
                  <th>Preguntas</th>
                  <th>Correctas</th>
                  <th>Precisión</th>
                </tr>
              </thead>
              <tbody>
                {themeStats.map(theme => (
                  <tr key={theme.theme}>
                    <td>{theme.theme}</td>
                    <td>{theme.students_attempted}</td>
                    <td>{theme.total_questions}</td>
                    <td>{theme.correct_answers}</td>
                    <td>{theme.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Análisis por Dificultad</h3>
            <table>
              <thead>
                <tr>
                  <th>Nivel</th>
                  <th>Preguntas</th>
                  <th>Correctas</th>
                  <th>Precisión</th>
                </tr>
              </thead>
              <tbody>
                {difficultyStats.map(diff => (
                  <tr key={diff.difficulty}>
                    <td>Nivel {diff.difficulty}</td>
                    <td>{diff.total_questions}</td>
                    <td>{diff.correct_answers}</td>
                    <td>{diff.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
