import React from 'react';
import { useAuth } from '../context/AuthContext';
import ChatQuiz from '../components/ChatQuiz';

const QuizPage = () => {
  const { logout } = useAuth();

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <button
        onClick={logout}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          padding: '0.5rem 1rem',
          background: 'rgba(255, 255, 255, 0.9)',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          fontWeight: '500',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontSize: '0.9rem'
        }}
      >
        Cerrar Sesión
      </button>
      <ChatQuiz />
    </div>
  );
};

export default QuizPage;
