import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Eye, EyeOff, ArrowRight } from 'lucide-react';

const Register = () => {
  const [form, setForm] = useState({ student_number: '', name: '', email: '', password: '', confirm: '', role: 'student' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    const result = await register({ student_number: form.student_number, name: form.name, email: form.email || undefined, password: form.password, role: form.role });
    if (result.success) {
      navigate(result.user.role === 'teacher' ? '/teacher/dashboard' : '/student/quiz');
    } else {
      setError(result.error || 'Error al registrar');
    }
    setLoading(false);
  };

  const inputClass = "w-full h-10 px-3 bg-zinc-800/60 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/20 via-zinc-950 to-zinc-950 pointer-events-none" />
      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Crear cuenta</h1>
          <p className="text-sm text-zinc-500 mt-1">Únete a Quiz App</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">⚠ {error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Número de estudiante *</label>
              <input type="text" value={form.student_number} onChange={set('student_number')} placeholder="ej. 202012345" required className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Nombre</label>
              <input type="text" value={form.name} onChange={set('name')} placeholder="Tu nombre completo" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Correo electrónico</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="tu@email.com" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Contraseña *</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" required className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Confirmar contraseña *</label>
              <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="Repite tu contraseña" required className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">Rol</label>
              <select value={form.role} onChange={set('role')} className={`${inputClass} cursor-pointer`}>
                <option value="student">Estudiante</option>
                <option value="teacher">Docente</option>
              </select>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-1">
              {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando cuenta...</> : <>Crear cuenta <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-zinc-600">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
