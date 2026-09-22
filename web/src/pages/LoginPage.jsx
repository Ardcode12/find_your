// Login page — shared for admin & department staff with professional design
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useToast } from '../ToastContext';
import { useTheme } from '../ThemeContext';
import {
  Search, Eye, EyeOff, Shield, Building2, ArrowRight,
  Sparkles, CheckCircle2, Zap, Landmark, Sun, Moon
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const fillCredentials = (type) => {
    if (type === 'admin') {
      setEmail('superadmin@kongu.edu');
      setPassword('Password123');
    } else {
      setEmail('dept.cse@kongu.edu');
      setPassword('Password123');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role === 'admin') {
        toast.success(`Welcome back, ${user.name}!`);
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'department_admin') {
        toast.success(`Welcome back, ${user.name}! (${user.department_code || 'Dept'})`);
        navigate('/dept/dashboard', { replace: true });
      } else {
        toast.error('This web portal is for Department Admins and Admins only.');
        localStorage.removeItem('kec_lf_token');
      }
    } catch (err) {
      toast.error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Left Branded Presentation Column */}
        <div className="auth-left">
          <div className="auth-left-top">
            <div className="auth-left-logo">
              <div className="auth-left-logo-icon">
                <Search size={22} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="auth-brand-name">
                  Kongu Engineering College
                </h3>
                <span className="auth-brand-sub">
                  Autonomous Institution · Perundurai
                </span>
              </div>
            </div>

            <div style={{ marginTop: 40 }}>
              <span className="auth-portal-tag">Official Staff &amp; Admin System</span>
              <h2 className="auth-portal-title">
                Campus Lost &amp; Found Portal
              </h2>
              <p className="auth-portal-desc">
                Centralized multi-tier custody management, department routing, and automated escalation platform.
              </p>
            </div>

            <div className="auth-features-list">
              <div className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Building2 size={16} />
                </div>
                <div>
                  <strong>Department Desks</strong>
                  <p>12 Academic departments independently manage verified item handovers.</p>
                </div>
              </div>

              <div className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Landmark size={16} />
                </div>
                <div>
                  <strong>Central Admin Office</strong>
                  <p>Real-time campus-wide recovery analytics and common area escalations.</p>
                </div>
              </div>

              <div className="auth-feature-item">
                <div className="auth-feature-icon">
                  <Zap size={16} />
                </div>
                <div>
                  <strong>Smart Escalation</strong>
                  <p>Automatic 24-hour and 7-day holding threshold routing engine.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-left-footer">
            <div className="flex items-center gap-8">
              <Sparkles size={14} color="var(--brand-warning)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Equipped with Gemini Vision AI &amp; Role-based Security
              </span>
            </div>
          </div>
        </div>

        {/* Right Form Card Column */}
        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-card-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h2>Staff Sign In</h2>
                <p>Enter your department or administrator credentials</p>
              </div>
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={16} strokeWidth={2.2} /> : <Moon size={16} strokeWidth={2.2} />}
              </button>
            </div>

            {/* Quick Demo Fill Buttons */}
            <div className="quick-login-box">
              <div className="quick-login-label">Quick Fill Credentials:</div>
              <div className="flex gap-8">
                <button
                  type="button"
                  className="quick-fill-btn admin-btn"
                  onClick={() => fillCredentials('admin')}
                >
                  <Shield size={13} strokeWidth={2.2} />
                  Central Admin
                </button>
                <button
                  type="button"
                  className="quick-fill-btn dept-btn"
                  onClick={() => fillCredentials('dept')}
                >
                  <Building2 size={13} strokeWidth={2.2} />
                  Dept Admin (CSE)
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  placeholder="e.g. superadmin@kongu.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPw ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(s => !s)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    aria-label="Toggle password visibility"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                className="btn btn-primary w-full"
                style={{ marginTop: 12, justifyContent: 'center', height: 46, fontSize: '0.92rem' }}
                disabled={loading}
              >
                {loading ? (
                  <><div className="spinner spinner-sm" /> Authenticating…</>
                ) : (
                  <span className="flex items-center gap-8">
                    Sign In to Portal
                    <ArrowRight size={16} strokeWidth={2.2} />
                  </span>
                )}
              </button>
            </form>

            <div className="divider" style={{ margin: '24px 0 18px' }} />

            <div style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <p>Protected area for authorized KEC faculty &amp; administrative staff.</p>
              <p style={{ marginTop: 4 }}>For credential assistance, contact the Campus IT Helpdesk.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
