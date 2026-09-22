// Admin Dashboard — overview stats + recent escalations + quick actions with professional icons
import { useState, useEffect } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import { statusBadge, formatDate, escalationBadge, timeAgo, CategoryIcon } from '../../components/helpers.jsx';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Zap, RefreshCw, Package, Search, CheckCircle2,
  Building2, Landmark, Sparkles, BarChart3, PieChart as PieIcon,
  Clock, ArrowRight
} from 'lucide-react';

const COLORS = ['#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8'];

export default function AdminDashboard() {
  const toast = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminAnalytics();
      setAnalytics(data);
    } catch (err) {
      toast.error('Failed to load analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoEscalate = async () => {
    setEscalating(true);
    try {
      const res = await api.autoEscalate();
      toast.success(`Auto-escalated ${res.total} item(s) successfully`);
      fetchAnalytics();
    } catch (err) {
      toast.error('Escalation failed: ' + err.message);
    } finally {
      setEscalating(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading admin overview…</span>
      </div>
    );
  }

  if (!analytics) return null;

  const a = analytics;

  const statusData = (a.by_status || []).map(s => ({
    name: s.status,
    value: s.count,
  }));

  const catData = (a.by_category || []).slice(0, 8).map(c => ({
    name: c.category,
    count: c.count,
  }));

  return (
    <div>
      {/* Hero Banner */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px 28px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', marginBottom: 6, fontSize: '1.6rem' }}>Admin Overview</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Kongu Engineering College — Central Lost &amp; Found Office
          </p>
        </div>
        <div className="flex gap-10">
          <button
            id="admin-auto-escalate-btn"
            className="btn btn-primary"
            onClick={handleAutoEscalate}
            disabled={escalating}
          >
            {escalating ? (
              <><div className="spinner spinner-sm" /> Running…</>
            ) : (
              <span className="flex items-center gap-6">
                <Zap size={15} strokeWidth={2.2} />
                Auto Escalate
              </span>
            )}
          </button>
          <button
            id="admin-refresh-btn"
            className="btn btn-ghost"
            onClick={fetchAnalytics}
          >
            <RefreshCw size={15} strokeWidth={2.2} style={{ marginRight: 6 }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <StatCard
          Icon={Package}
          color="var(--text-primary)"
          bgColor="var(--bg-elevated)"
          value={a.total_items}
          label="Total Items"
          sub="All time logged"
        />
        <StatCard
          Icon={Search}
          color="var(--text-primary)"
          bgColor="var(--bg-elevated)"
          value={a.total_found}
          label="Found Reports"
          sub={`${a.total_lost} lost reports`}
        />
        <StatCard
          Icon={CheckCircle2}
          color="var(--brand-success)"
          bgColor="rgba(16,185,129,0.1)"
          value={a.total_recovered}
          label="Recovered"
          sub={`${a.recovery_rate}% recovery rate`}
        />
        <StatCard
          Icon={Building2}
          color="var(--text-primary)"
          bgColor="var(--bg-elevated)"
          value={a.total_at_departments}
          label="At Departments"
          sub="Escalated to dept desks"
        />
        <StatCard
          Icon={Landmark}
          color="var(--brand-danger)"
          bgColor="rgba(239,68,68,0.1)"
          value={a.total_at_admin}
          label="At Admin Office"
          sub="Pending central action"
        />
        <StatCard
          Icon={Sparkles}
          color="var(--brand-warning)"
          bgColor="rgba(245,158,11,0.1)"
          value={a.total_valuable}
          label="Valuable Items"
          sub="High-priority routing"
        />
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-24">
        {/* Category Bar Chart */}
        <div className="chart-wrapper">
          <div className="chart-title flex items-center gap-8">
            <BarChart3 size={18} color="var(--brand-primary)" />
            <span>Items by Category</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={catData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Poppins' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Poppins' }} />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 12,
                  fontFamily: 'Poppins',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              />
              <Bar dataKey="count" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie */}
        <div className="chart-wrapper">
          <div className="chart-title flex items-center gap-8">
            <PieIcon size={18} color="var(--brand-primary)" />
            <span>Items by Status</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${value}`}
                labelLine={false}
              >
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  color: '#0f172a',
                  fontSize: 12,
                  fontFamily: 'Poppins',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#475569', fontSize: 11, fontFamily: 'Poppins' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department breakdown */}
      {(a.by_department || []).length > 0 && (
        <div className="table-wrapper mb-24">
          <div className="table-header">
            <span className="section-title flex items-center gap-8">
              <Building2 size={18} color="var(--brand-primary)" />
              Department Breakdown
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Total</th>
                <th>Pending</th>
                <th>Recovered</th>
                <th>At Admin</th>
                <th>Recovery %</th>
              </tr>
            </thead>
            <tbody>
              {a.by_department.map(dept => (
                <tr key={dept.department_code}>
                  <td>
                    <div className="flex items-center gap-8">
                      <span className="dept-tag">{dept.department_code}</span>
                      <span className="text-sm font-medium">{dept.department_name}</span>
                    </div>
                  </td>
                  <td><strong>{dept.total}</strong></td>
                  <td>
                    <span className="badge badge-yellow">{dept.pending}</span>
                  </td>
                  <td>
                    <span className="badge badge-green">{dept.recovered}</span>
                  </td>
                  <td>
                    <span className="badge badge-red">{dept.at_admin}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        flex: 1, height: 6, background: 'var(--bg-elevated)',
                        borderRadius: 3, overflow: 'hidden', minWidth: 60,
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${dept.recovery_rate}%`,
                          background: 'linear-gradient(90deg, #10b981 0%, #0ea5e9 100%)',
                          borderRadius: 3,
                        }} />
                      </div>
                      <span className="text-xs text-muted" style={{ minWidth: 32 }}>
                        {dept.recovery_rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent escalations */}
      {(a.recent_escalations || []).length > 0 && (
        <div className="table-wrapper">
          <div className="table-header">
            <span className="section-title flex items-center gap-8">
              <Clock size={18} color="var(--brand-primary)" />
              Recent Escalations
            </span>
            <a href="/admin/items" className="text-xs font-semibold flex items-center gap-4">
              View all items <ArrowRight size={13} />
            </a>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Status</th>
                <th>Escalation Level</th>
                <th>Department</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {a.recent_escalations.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-10">
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'var(--bg-elevated)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
                      }}>
                        <CategoryIcon category={item.category} size={16} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{item.title}</div>
                        <div className="text-xs text-muted">ID: #{item.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-gray">{item.category}</span>
                  </td>
                  <td>{statusBadge(item.status)}</td>
                  <td>{escalationBadge(item.escalation_level)}</td>
                  <td>
                    {item.assigned_department ? (
                      <span className="dept-tag">{item.assigned_department}</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">{timeAgo(item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ Icon, color, bgColor, value, label, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bgColor, color: color }}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </div>
      <div className="stat-card-label">{label}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
