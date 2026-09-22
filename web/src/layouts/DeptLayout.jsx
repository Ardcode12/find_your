// Department layout wrapper
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Sidebar from '../components/Sidebar.jsx';
import TopBar  from '../components/TopBar.jsx';

const PAGE_TITLES = {
  '/dept/dashboard': 'Department Dashboard',
  '/dept/items':     'All Items',
  '/dept/pending':   'Pending Items',
  '/dept/recovered': 'Recovered Items',
};

export default function DeptLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="loading-center" style={{ minHeight: '100vh' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'department_admin' && user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  // Admins can also view dept portal — route them correctly
  const title = PAGE_TITLES[location.pathname] || 'Department Portal';

  return (
    <div className="layout">
      <Sidebar role="department_admin" />
      <div className="main-content">
        <TopBar title={title} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
