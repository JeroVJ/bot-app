import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import QuizPage from './pages/QuizPage';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import './styles/App.css';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="loading">Cargando...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/" replace />;
    }

    return children;
};

// Home redirect based on role
const Home = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="loading">Cargando...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role === 'teacher') {
        return <Navigate to="/teacher/dashboard" replace />;
    }

    // Redirect students to dashboard instead of quiz
    return <Navigate to="/student/dashboard" replace />;
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <div className="App">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        {/* Student Routes */}
                        <Route
                            path="/student/dashboard"
                            element={
                                <ProtectedRoute requiredRole="student">
                                    <StudentDashboard />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/student/quiz"
                            element={
                                <ProtectedRoute requiredRole="student">
                                    <QuizPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Teacher Routes */}
                        <Route
                            path="/teacher/dashboard"
                            element={
                                <ProtectedRoute requiredRole="teacher">
                                    <TeacherDashboard />
                                </ProtectedRoute>
                            }
                        />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;