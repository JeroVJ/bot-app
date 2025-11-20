import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatQuiz from '../components/ChatQuiz';

const QuizPage = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div style={{ position: 'relative', height: '100vh' }}>
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 1000,
                display: 'flex',
                gap: '0.5rem'
            }}>
                <button
                    onClick={() => navigate('/student/dashboard')}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        fontSize: '0.9rem'
                    }}
                >
                    Dashboard
                </button>
                <button
                    onClick={logout}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(255, 255, 255, 0.9)',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        fontSize: '0.9rem'
                    }}
                >
                    Cerrar Sesión
                </button>
            </div>
            <ChatQuiz />
        </div>
    );
};

export default QuizPage;