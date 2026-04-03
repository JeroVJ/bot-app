import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';
import {
  BookOpen, LayoutDashboard, LogOut, ChevronRight, GraduationCap, Settings, Sun, Moon
} from 'lucide-react';

function NavItem({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
        active
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
      {active && <ChevronRight className="w-3 h-3 ml-auto text-zinc-400" />}
    </Link>
  );
}

export function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleLogout = () => { logout(); navigate('/login'); };

  const studentNav = [
    { to: '/student/quiz', icon: BookOpen, label: 'Quiz' },
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Mi Dashboard' },
  ];

  const teacherNav = [
    { to: '/teacher/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  ];

  const navItems = user?.role === 'teacher' ? teacherNav : studentNav;

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-zinc-100 text-sm tracking-tight">Quiz App</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map(item => (
            <NavItem key={item.to} {...item} active={isActive(item.to)} />
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-3 border-t border-zinc-800 space-y-0.5">
          {/* Settings */}
          <NavItem to="/settings" icon={Settings} label="Configuración" active={isActive('/settings')} />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300 transition-colors"
          >
            {theme === 'dark'
              ? <><Sun className="w-4 h-4" />Modo claro</>
              : <><Moon className="w-4 h-4" />Modo oscuro</>}
          </button>

          {/* User */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-zinc-300 truncate">{user?.name || user?.student_number}</p>
              <p className="text-xs text-zinc-600 truncate capitalize">{user?.role}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-800/60 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
