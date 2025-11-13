import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir token a las peticiones
api.interceptors.request.use(
  (config) => {
    // Buscar primero en sessionStorage, luego en localStorage (para migración)
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpiar ambos storages
      sessionStorage.removeItem('token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Quiz
export const quizAPI = {
  startSession: (data) => api.post('/quiz/start', data),
  getQuestion: (data) => api.post('/quiz/question', data),
  submitAnswer: (data) => api.post('/quiz/answer', data),
  completeSession: (sessionId) => api.post(`/quiz/session/${sessionId}/complete`),
  getSessions: () => api.get('/quiz/sessions'),
  getSessionDetails: (sessionId) => api.get(`/quiz/session/${sessionId}`),
  getThemes: (week) => api.get('/quiz/themes', { params: { week } }),
  getDifficulties: (week, themes) => api.get('/quiz/difficulties', { params: { week, themes } }),
  countQuestions: (data) => api.post('/quiz/count', data),
};

// Teacher Dashboard
export const teacherAPI = {
  getDashboardStats: () => api.get('/teacher/dashboard/stats'),
  getStudents: () => api.get('/teacher/students'),
  getStudentDetails: (studentId) => api.get(`/teacher/student/${studentId}`),
  getThemeStats: () => api.get('/teacher/dashboard/theme-stats'),
  getDifficultyStats: () => api.get('/teacher/dashboard/difficulty-stats'),
  getRecentActivity: () => api.get('/teacher/dashboard/recent-activity'),
};

export default api;
