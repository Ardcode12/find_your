// App.jsx — Root router
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ToastProvider } from './ToastContext';
import { ThemeProvider } from './ThemeContext';

// Layouts
import AdminLayout from './layouts/AdminLayout.jsx';
import DeptLayout  from './layouts/DeptLayout.jsx';

// Auth
import LoginPage from './pages/LoginPage.jsx';

// Admin pages
import AdminDashboard     from './pages/admin/AdminDashboard.jsx';
import AdminItemsPage     from './pages/admin/AdminItemsPage.jsx';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage.jsx';
import AdminEscalatePage  from './pages/admin/AdminEscalatePage.jsx';
import AdminDepartmentsPage from './pages/admin/AdminDepartmentsPage.jsx';

// Dept pages
import DeptDashboard  from './pages/dept/DeptDashboard.jsx';
import DeptItemsPage  from './pages/dept/DeptItemsPage.jsx';
import DeptPendingPage  from './pages/dept/DeptPendingPage.jsx';
import DeptRecoveredPage from './pages/dept/DeptRecoveredPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />

              {/* Admin Portal */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard"   element={<AdminDashboard />} />
                <Route path="items"       element={<AdminItemsPage />} />
                <Route path="analytics"   element={<AdminAnalyticsPage />} />
                <Route path="escalate"    element={<AdminEscalatePage />} />
                <Route path="departments" element={<AdminDepartmentsPage />} />
              </Route>

              {/* Department Portal */}
              <Route path="/dept" element={<DeptLayout />}>
                <Route index element={<Navigate to="/dept/dashboard" replace />} />
                <Route path="dashboard" element={<DeptDashboard />} />
                <Route path="items"     element={<DeptItemsPage />} />
                <Route path="pending"   element={<DeptPendingPage />} />
                <Route path="recovered" element={<DeptRecoveredPage />} />
              </Route>

              {/* Catch-all → login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
