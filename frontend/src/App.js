import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import QuizPage from './pages/QuizPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import Settings from './pages/Settings';
import { AppLayout } from './components/Layout';

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-700 border-t-blue-500" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/login" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'teacher') return <Navigate to="/teacher/dashboard" replace />;
  return <Navigate to="/student/quiz" replace />;
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/student/quiz" element={
              <ProtectedRoute requiredRole="student">
                <AppLayout><QuizPage /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/student/dashboard" element={
              <ProtectedRoute requiredRole="student">
                <AppLayout><StudentDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/teacher/dashboard" element={
              <ProtectedRoute requiredRole="teacher">
                <AppLayout><TeacherDashboard /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <AppLayout><Settings /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
