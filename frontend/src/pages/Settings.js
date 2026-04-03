import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { User, Lock, Palette, Sun, Moon, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
        <Icon className="w-4 h-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
      <p className={cn('text-sm text-zinc-200', mono && 'font-mono')}>{value || '—'}</p>
    </div>
  );
}

const roleLabels = { student: 'Estudiante', teacher: 'Profesor', simulacion: 'Simulación' };

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState(null); // { type: 'success'|'error', msg }
  const [pwLoading, setPwLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: 'error', msg: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwStatus({ type: 'error', msg: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    setPwLoading(true);
    setPwStatus(null);
    try {
      await api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword });
      setPwStatus({ type: 'success', msg: 'Contraseña cambiada exitosamente.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al cambiar la contraseña.';
      setPwStatus({ type: 'error', msg });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-zinc-950 px-6 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Configuración</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestiona tu cuenta y preferencias de la app.</p>
        </div>

        {/* Profile */}
        <Section title="Perfil de usuario" icon={User}>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || user?.student_number?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{user?.name || user?.student_number}</p>
              <p className="text-xs text-zinc-500 capitalize">{roleLabels[user?.role] || user?.role}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nombre" value={user?.name} />
            <Field label="Número de estudiante" value={user?.student_number} mono />
            <Field label="Correo electrónico" value={user?.email} />
            <Field label="Rol" value={roleLabels[user?.role] || user?.role} />
          </div>
        </Section>

        {/* Theme */}
        <Section title="Apariencia" icon={Palette}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Tema</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {theme === 'dark' ? 'Modo oscuro activo' : 'Modo claro activo'}
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-150',
                theme === 'dark'
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
              )}
            >
              {theme === 'dark' ? (
                <><Sun className="w-4 h-4 text-amber-400" />Cambiar a claro</>
              ) : (
                <><Moon className="w-4 h-4 text-blue-400" />Cambiar a oscuro</>
              )}
            </button>
          </div>

          {/* Visual preview */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => theme !== 'dark' && toggleTheme()}
              className={cn(
                'rounded-lg border-2 p-3 text-left transition-all',
                theme === 'dark' ? 'border-blue-500' : 'border-zinc-700'
              )}
            >
              <div className="w-full h-10 bg-zinc-950 rounded mb-2 flex items-center gap-1.5 px-2">
                <div className="w-2 h-2 rounded-full bg-zinc-700" />
                <div className="flex-1 h-1.5 bg-zinc-800 rounded" />
              </div>
              <p className="text-xs font-medium text-zinc-300">Oscuro</p>
            </button>
            <button
              onClick={() => theme !== 'light' && toggleTheme()}
              className={cn(
                'rounded-lg border-2 p-3 text-left transition-all',
                theme === 'light' ? 'border-blue-500' : 'border-zinc-700'
              )}
            >
              <div className="w-full h-10 bg-zinc-100 rounded mb-2 flex items-center gap-1.5 px-2">
                <div className="w-2 h-2 rounded-full bg-zinc-300" />
                <div className="flex-1 h-1.5 bg-zinc-200 rounded" />
              </div>
              <p className="text-xs font-medium text-zinc-300">Claro</p>
            </button>
          </div>
        </Section>

        {/* Change password */}
        <Section title="Cambiar contraseña" icon={Lock}>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Contraseña actual</label>
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                required
                className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Nueva contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full h-10 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {pwStatus && (
              <div className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
                pwStatus.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              )}>
                {pwStatus.type === 'success'
                  ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {pwStatus.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
            >
              {pwLoading ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}
