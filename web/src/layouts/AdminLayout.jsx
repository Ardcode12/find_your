// Admin layout wrapper
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Sidebar from '../components/Sidebar.jsx';
import TopBar  from '../components/TopBar.jsx';

const PAGE_TITLES = {
  '/admin/dashboard':   'Dashboard',
  '/admin/items':       'Admin Office Items',
  '/admin/analytics':   'Analytics',
  '/admin/escalate':    'Auto Escalation',
  '/admin/departments': 'Departments',
};

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="loading-center" style={{ minHeight: '100vh' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dept/dashboard" replace />;

  const title = PAGE_TITLES[location.pathname] || 'Admin Portal';

  return (
    <div className="layout">
      <Sidebar role="admin" />
      <div className="main-content">
        <TopBar title={title} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
