// Shared TopBar with professional Lucide icons and Black & White Theme Toggle
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { Shield, Building2, Sun, Moon } from 'lucide-react';

export default function TopBar({ title }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const badge = user?.role === 'admin' ? (
    <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Shield size={12} strokeWidth={2.2} />
      Central Admin
    </span>
  ) : (
    <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Building2 size={12} strokeWidth={2.2} />
      Dept. Admin ({user?.department_code || 'Desk'})
    </span>
  );

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-actions flex items-center gap-12">
        {/* Black & White Theme Toggle button */}
        <button
          id="theme-toggle-btn"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun size={17} strokeWidth={2.2} />
          ) : (
            <Moon size={17} strokeWidth={2.2} />
          )}
        </button>

        {badge}

        <div className="avatar" style={{ cursor: 'default' }}>
          {user?.name?.charAt(0).toUpperCase() || '?'}
        </div>
      </div>
    </header>
  );
}
