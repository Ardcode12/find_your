// Department Dashboard — overview of department items with professional icons
import { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../ToastContext';
import { statusBadge, CategoryIcon, timeAgo, escalationBadge } from '../../components/helpers.jsx';
import ItemActionModal from '../../components/ItemActionModal.jsx';
import {
  Package, Clock, ShieldCheck, CheckCircle2, Sparkles,
  RefreshCw, AlertCircle, Inbox, ArrowRight, Settings
} from 'lucide-react';

export default function DeptDashboard() {
  const { user } = useAuth();
  const toast    = useToast();
  const [stats,   setStats]   = useState(null);
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionItem, setActionItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, i] = await Promise.all([
        api.getDeptStats(),
        api.getDeptItems(),
      ]);
      setStats(s);
      setItems(i);
    } catch (err) {
      toast.error('Failed to load dashboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading department dashboard…</span>
      </div>
    );
  }

  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const pendingItems = items.filter(it =>
    it.status === 'Escalated to Department' || it.status === 'With Department'
  );

  return (
    <div>
      {/* Hero */}
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
          <h1 style={{ color: 'var(--text-primary)', marginBottom: 6, fontSize: '1.6rem' }}>
            {user?.department || 'Department'} Portal
          </h1>
          <div className="flex items-center gap-8">
            <span className="dept-tag">{user?.department_code || '—'}</span>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Manage found items assigned to your department office
            </p>
          </div>
        </div>
        <button
          id="dept-refresh-btn"
          className="btn btn-ghost"
          onClick={fetchData}
        >
          <RefreshCw size={15} style={{ marginRight: 6 }} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid mb-24">
          <DeptStatCard
            Icon={Package}
            color="var(--text-primary)"
            bgColor="var(--bg-elevated)"
            value={stats.total}
            label="Total Assigned"
          />
          <DeptStatCard
            Icon={Clock}
            color="var(--brand-warning)"
            bgColor="rgba(245,158,11,0.1)"
            value={stats.pending}
            label="Pending Review"
          />
          <DeptStatCard
            Icon={ShieldCheck}
            color="var(--brand-success)"
            bgColor="rgba(16,185,129,0.1)"
            value={stats.verified}
            label="Verified"
          />
          <DeptStatCard
            Icon={CheckCircle2}
            color="var(--text-primary)"
            bgColor="var(--bg-elevated)"
            value={stats.recovered}
            label="Recovered"
          />
          <DeptStatCard
            Icon={Sparkles}
            color="var(--brand-warning)"
            bgColor="rgba(245,158,11,0.1)"
            value={stats.valuable}
            label="Valuable Items"
          />
        </div>
      )}

      {/* Pending Items urgent list */}
      {pendingItems.length > 0 && (
        <div className="mb-24">
          <div className="section-header">
            <span className="section-title flex items-center gap-8">
              <AlertCircle size={18} color="var(--brand-danger)" />
              Needs Attention ({pendingItems.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingItems.slice(0, 5).map(item => (
              <div key={item.id} className="card flex items-center gap-12" style={{ padding: '14px 18px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'var(--bg-elevated)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
                }}>
                  <CategoryIcon category={item.category} size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-semibold text-sm truncate">{item.title}</div>
                  <div className="text-xs text-muted">
                    {item.location || 'Campus'} · {timeAgo(item.created_at)}
                  </div>
                </div>
                {statusBadge(item.status)}
                {item.is_valuable && (
                  <span className="badge badge-yellow">
                    <Sparkles size={11} style={{ marginRight: 4 }} />
                    Valuable
                  </span>
                )}
              </div>
            ))}
          </div>
          {pendingItems.length > 5 && (
            <p className="text-xs text-muted" style={{ marginTop: 10, textAlign: 'center' }}>
              +{pendingItems.length - 5} more pending items — <a href="/dept/pending" className="font-semibold">view all pending items</a>
            </p>
          )}
        </div>
      )}

      {/* Recent items table */}
      <div className="table-wrapper">
        <div className="table-header">
          <span className="section-title flex items-center gap-8">
            <Package size={18} color="var(--brand-primary)" />
            Recent Items
          </span>
          <span className="text-xs text-muted">{items.length} total</span>
        </div>
        {recentItems.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
              <Inbox size={42} strokeWidth={1.5} color="var(--text-muted)" />
            </div>
            <h3>No items yet</h3>
            <p>Items escalated to your department will appear here.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Status</th>
                <th>Escalation</th>
                <th>Valuable</th>
                <th>Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentItems.map(item => (
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
                        <div className="text-xs text-muted">#{item.id}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-dark">{item.category}</span></td>
                  <td>{statusBadge(item.status)}</td>
                  <td>{escalationBadge(item.escalation_level)}</td>
                  <td>
                    {item.is_valuable ? (
                      <span className="badge badge-yellow">
                        <Sparkles size={11} style={{ marginRight: 4 }} />
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="text-xs text-muted">{timeAgo(item.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActionItem(item)}
                    >
                      <Settings size={13} style={{ marginRight: 4 }} />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionItem && (
        <ItemActionModal
          item={actionItem}
          onClose={() => setActionItem(null)}
          onDone={() => { setActionItem(null); fetchData(); }}
        />
      )}
    </div>
  );
}

function DeptStatCard({ Icon, color, bgColor, value, label }) {
  return (
    <div className="stat-card">
      <div className="stat-card-icon" style={{ background: bgColor, color: color }}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </div>
      <div className="stat-card-label">{label}</div>
    </div>
  );
}
