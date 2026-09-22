// Shared Sidebar component with professional Lucide icons
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import {
  LayoutDashboard, Package, BarChart3, Zap, Clock,
  CheckCircle2, Building2, LogOut, Search, Shield, ShieldAlert
} from 'lucide-react';

const AdminNav = [
  { to: '/admin/dashboard', label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/admin/items',     label: 'All Items',    Icon: Package },
  { to: '/admin/analytics', label: 'Analytics',    Icon: BarChart3 },
  { to: '/admin/escalate',  label: 'Auto Escalate', Icon: Zap },
];

const DeptNav = [
  { to: '/dept/dashboard', label: 'Dashboard',  Icon: LayoutDashboard },
  { to: '/dept/items',     label: 'My Items',   Icon: Package },
  { to: '/dept/pending',   label: 'Pending',    Icon: Clock },
  { to: '/dept/recovered', label: 'Recovered',  Icon: CheckCircle2 },
];

export default function Sidebar({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = role === 'admin' ? AdminNav : DeptNav;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Search size={18} strokeWidth={2.5} />
        </div>
        <div className="sidebar-logo-text">
          <strong>KEC Lost &amp; Found</strong>
          <span>
            {role === 'admin' ? 'Admin Portal' : 'Dept. Portal'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Management</div>
        {navItems.map(item => {
          const ItemIcon = item.Icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <ItemIcon size={18} strokeWidth={2} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        {role === 'admin' && (
          <>
            <div className="nav-section-label">System</div>
            <NavLink
              to="/admin/departments"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              id="nav-departments"
            >
              <Building2 size={18} strokeWidth={2} />
              <span>Departments</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* User info */}
        <div className="flex items-center gap-10 mb-12 user-card-sidebar">
          <div className="avatar">
            {user?.name?.charAt(0).toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
              {user?.name || 'Staff User'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }} className="truncate">
              {user?.department || (user?.role === 'admin' ? 'Central Admin' : 'Staff')}
            </div>
          </div>
        </div>

        <button
          id="logout-btn"
          onClick={handleLogout}
          className="btn btn-ghost w-full"
          style={{ justifyContent: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}
        >
          <LogOut size={16} strokeWidth={2} style={{ marginRight: 6 }} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
