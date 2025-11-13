import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(sessionStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadUser = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data.user);
    } catch (error) {
      console.error('Error loading user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (studentNumber, password) => {
    try {
      const response = await authAPI.login({ student_number: studentNumber, password });
      console.log('Login response:', response.data);
      const { access_token, user } = response.data;
      
      if (!access_token) {
        console.error('No access_token in response');
        return { 
          success: false, 
          error: 'No se recibió token de autenticación' 
        };
      }
      
      // Usar sessionStorage para que expire al cerrar navegador
      sessionStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Error al iniciar sesión' 
      };
    }
  };

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      const { access_token, user } = response.data;
      
      sessionStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Error al registrar usuario' 
      };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('user'); // Por si quedó algo viejo
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
