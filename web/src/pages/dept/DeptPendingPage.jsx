// Department Pending Items Page — items needing immediate action with professional icons
import { useState, useEffect } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import { statusBadge, valuableBadge, CategoryIcon, timeAgo } from '../../components/helpers.jsx';
import ItemActionModal from '../../components/ItemActionModal.jsx';
import { Clock, RefreshCw, CheckCircle2, MapPin, Tag, Settings } from 'lucide-react';

export default function DeptPendingPage() {
  const toast = useToast();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionItem, setActionItem] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await api.getDeptItems('Escalated to Department');
      const withDept = await api.getDeptItems('With Department');
      setItems([...data, ...withDept]);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading pending items…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header mb-20">
        <div>
          <h2 className="flex items-center gap-10">
            <Clock size={22} color="#f59e0b" />
            Pending Action Items
          </h2>
          <p className="text-sm text-secondary mt-4">Items requiring department verification, receipt, or escalation</p>
        </div>
        <div className="flex gap-10 items-center">
          {items.length > 0 && (
            <span className="badge badge-yellow">{items.length} items awaiting review</span>
          )}
          <button className="btn btn-ghost" onClick={fetchPending}>
            <RefreshCw size={15} style={{ marginRight: 6 }} />
            Refresh
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <CheckCircle2 size={46} strokeWidth={1.5} color="var(--brand-success)" />
          </div>
          <h3>All Caught Up!</h3>
          <p>No items pending review at your department at this time.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Image / Icon */}
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title}
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: 'var(--radius-md)', flexShrink: 0,
                  background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'var(--text-secondary)'
                }}>
                  <CategoryIcon category={item.category} size={28} />
                </div>
              )}

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-10 mb-4 flex-wrap">
                  <span className="font-semibold" style={{ fontSize: '1rem' }}>{item.title}</span>
                  {statusBadge(item.status)}
                  {valuableBadge(item.is_valuable)}
                </div>
                <div className="text-sm text-secondary mb-4 flex items-center gap-12 flex-wrap">
                  <span className="flex items-center gap-4">
                    <MapPin size={13} color="var(--text-muted)" />
                    {item.location || 'Campus'}
                  </span>
                  <span className="flex items-center gap-4">
                    <Tag size={13} color="var(--text-muted)" />
                    {item.category}
                  </span>
                </div>
                <div className="text-xs text-muted">
                  Reported by {item.reporter_name || 'Staff / Student'} · {timeAgo(item.escalation_at || item.created_at)}
                </div>
                {item.description && (
                  <div className="text-sm mt-8" style={{
                    background: 'var(--bg-elevated)', padding: '8px 12px',
                    borderRadius: 'var(--radius-md)', marginTop: 8, color: 'var(--text-secondary)'
                  }}>
                    {item.description}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-8" style={{ flexShrink: 0 }}>
                <button
                  id={`pending-manage-${item.id}`}
                  className="btn btn-primary btn-sm"
                  onClick={() => setActionItem(item)}
                >
                  <Settings size={14} style={{ marginRight: 5 }} />
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {actionItem && (
        <ItemActionModal
          item={actionItem}
          onClose={() => setActionItem(null)}
          onDone={() => { setActionItem(null); fetchPending(); }}
        />
      )}
    </div>
  );
}
