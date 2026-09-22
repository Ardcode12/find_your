// Admin Analytics — detailed breakdown charts with professional styling
import { useState, useEffect } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid,
} from 'recharts';
import {
  BarChart3, PieChart as PieIcon, Package, Search,
  CheckCircle2, Sparkles, Building2, HelpCircle
} from 'lucide-react';

const COLORS = ['#18181b', '#27272a', '#3f3f46', '#52525b', '#71717a', '#a1a1aa', '#d4d4d8'];

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'Poppins',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
};

export default function AdminAnalyticsPage() {
  const toast = useToast();
  const [analytics, setAnalytics] = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.getAdminAnalytics()
      .then(d => setAnalytics(d))
      .catch(err => toast.error('Failed: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading analytics…</span>
      </div>
    );
  }
  if (!analytics) return null;

  const a = analytics;

  const catData  = (a.by_category || []).map(c => ({ name: c.category, count: c.count }));
  const statData = (a.by_status   || []).map(s => ({ name: s.status,   value: s.count }));
  const deptData = (a.by_department || []).map(d => ({
    name:      d.department_code,
    total:     d.total,
    recovered: d.recovered,
    pending:   d.pending,
  }));

  const recoveryRate = a.recovery_rate || 0;

  return (
    <div>
      <div className="section-header mb-24">
        <div>
          <h2 className="flex items-center gap-10">
            <BarChart3 size={22} color="var(--brand-primary)" />
            Analytics &amp; Reports
          </h2>
          <p className="text-sm text-secondary mt-4">Campus-wide Lost &amp; Found tracking intelligence</p>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '22px 28px',
        marginBottom: 24,
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
        alignItems: 'center',
        boxShadow: 'var(--shadow-xs)'
      }}>
        {[
          { label: 'Total Items',   value: a.total_items,      Icon: Package,       color: 'var(--text-primary)' },
          { label: 'Found Reports', value: a.total_found,      Icon: Search,        color: 'var(--text-primary)' },
          { label: 'Lost Reports',  value: a.total_lost,       Icon: HelpCircle,    color: 'var(--text-secondary)' },
          { label: 'Recovered',     value: a.total_recovered,  Icon: CheckCircle2,  color: 'var(--brand-success)' },
          { label: 'Valuables',     value: a.total_valuable,   Icon: Sparkles,      color: 'var(--brand-warning)' },
        ].map(m => {
          const ItemIcon = m.Icon;
          return (
            <div key={m.label} style={{ textAlign: 'center', minWidth: 90 }}>
              <div style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'Poppins'
              }}>
                {m.value}
              </div>
              <div style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                marginTop: 2
              }}>
                <ItemIcon size={13} color={m.color} />
                {m.label}
              </div>
            </div>
          );
        })}

        <div style={{ marginLeft: 'auto', textAlign: 'center', minWidth: 100 }}>
          <div style={{ position: 'relative', width: 76, height: 76, margin: '0 auto 6px' }}>
            <svg width="76" height="76" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#10b981" strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 32 * recoveryRate / 100} ${2 * Math.PI * 32}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '0.95rem', fontWeight: 800, color: '#10b981',
              fontFamily: 'Poppins'
            }}>
              {recoveryRate}%
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recovery Rate</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid-2 mb-24">
        <div className="chart-wrapper">
          <div className="chart-title flex items-center gap-8">
            <BarChart3 size={18} color="var(--brand-primary)" />
            <span>Items by Category</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={catData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Poppins' }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Poppins' }} width={80} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-wrapper">
          <div className="chart-title flex items-center gap-8">
            <PieIcon size={18} color="var(--brand-primary)" />
            <span>Status Breakdown</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statData} cx="50%" cy="45%" outerRadius={75} dataKey="value"
                label={({ name, value }) => `${value}`} labelLine={false}>
                {statData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend formatter={(v) => <span style={{ color: '#475569', fontSize: 11, fontFamily: 'Poppins' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Department stacked bar */}
      {deptData.length > 0 && (
        <div className="chart-wrapper mb-24">
          <div className="chart-title flex items-center gap-8">
            <Building2 size={18} color="var(--brand-primary)" />
            <span>Department Performance</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Poppins' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'Poppins' }} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend formatter={(v) => <span style={{ color: '#475569', fontSize: 11, fontFamily: 'Poppins' }}>{v}</span>} />
              <CartesianGrid stroke="#f1f5f9" />
              <Bar dataKey="total"     name="Total"     fill="var(--brand-primary)" radius={[4,4,0,0]} />
              <Bar dataKey="pending"   name="Pending"   fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="recovered" name="Recovered" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dept table */}
      {deptData.length > 0 && (
        <div className="table-wrapper">
          <div className="table-header">
            <span className="section-title flex items-center gap-8">
              <Building2 size={18} color="var(--brand-primary)" />
              Department Summary
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Department</th>
                <th>Total</th>
                <th>Pending</th>
                <th>Recovered</th>
                <th>At Admin</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {(a.by_department || []).map(d => (
                <tr key={d.department_code}>
                  <td><span className="dept-tag">{d.department_code}</span></td>
                  <td className="text-sm font-medium">{d.department_name}</td>
                  <td><strong>{d.total}</strong></td>
                  <td><span className="badge badge-yellow">{d.pending}</span></td>
                  <td><span className="badge badge-green">{d.recovered}</span></td>
                  <td><span className="badge badge-red">{d.at_admin}</span></td>
                  <td className="text-sm">
                    {d.total > 0 ? `${Math.round(d.recovered / d.total * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
