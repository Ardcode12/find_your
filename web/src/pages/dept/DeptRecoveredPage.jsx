// Department Recovered Items Page — displaying verified returned items with owner handover details
import { useState, useEffect } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import { CategoryIcon, formatDate } from '../../components/helpers.jsx';
import { CheckCircle2, Search, Inbox, MapPin, Tag, UserCheck, Calendar, Phone } from 'lucide-react';

export default function DeptRecoveredPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getDeptItems({ status: 'Recovered' })
      .then(d => setItems(d))
      .catch(err => toast.error('Failed to load recovered items: ' + err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(it =>
    (it.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.owner_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.owner_roll_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.location || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-center">
        <div className="spinner spinner-lg" />
        <span>Loading recovered items…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header mb-20">
        <div>
          <h2 className="flex items-center gap-10">
            <CheckCircle2 size={22} color="var(--brand-success)" />
            Recovered &amp; Delivered Items
          </h2>
          <p className="text-sm text-secondary mt-4">
            Items successfully verified and handed over to their rightful student owners
          </p>
        </div>
        <span className="badge badge-dark" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
          {items.length} Returned
        </span>
      </div>

      <div className="search-box mb-20" style={{ maxWidth: 360 }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          id="recovered-search"
          placeholder="Search by title, owner name, or roll number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <Inbox size={42} strokeWidth={1.5} color="var(--text-muted)" />
          </div>
          <h3>No recovered items found</h3>
          <p>Recovered items with verified handovers will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(item => (
            <div key={item.id} className="card" style={{ position: 'relative', overflow: 'hidden', padding: '18px 20px' }}>
              {/* Header badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div className="flex items-center gap-10">
                  <div style={{
                    width: 38, height: 38, borderRadius: 8,
                    background: 'var(--bg-elevated)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
                  }}>
                    <CategoryIcon category={item.category} size={18} />
                  </div>
                  <div>
                    <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)', display: 'block' }}>
                      {item.title}
                    </span>
                    <span className="text-xs text-muted">Item #{item.id} · {item.category}</span>
                  </div>
                </div>

                <span className="badge badge-dark" style={{ fontSize: '0.72rem', flexShrink: 0 }}>
                  <CheckCircle2 size={12} strokeWidth={2.2} style={{ marginRight: 4 }} />
                  Delivered
                </span>
              </div>

              {item.image_url && (
                <img src={item.image_url} alt={item.title}
                  style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 12 }} />
              )}

              <div className="text-xs text-muted mb-8 flex items-center gap-6">
                <MapPin size={12} />
                <span>Found at: {item.location || 'Campus'}</span>
              </div>

              {/* Owner delivery box */}
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 5
              }}>
                <div className="font-semibold flex items-center gap-6" style={{ color: 'var(--text-primary)' }}>
                  <UserCheck size={14} color="var(--brand-success)" />
                  <span>Delivered to: {item.owner_name || 'Owner Student'}</span>
                </div>
                {item.owner_roll_no && (
                  <div className="text-secondary flex items-center gap-6">
                    <span>Roll No: <strong>{item.owner_roll_no}</strong></span>
                    {item.owner_phone && <span>· Phone: {item.owner_phone}</span>}
                  </div>
                )}
                <div className="text-muted flex items-center gap-6" style={{ fontSize: '0.72rem', marginTop: 2 }}>
                  <Calendar size={12} />
                  <span>Handed over on {formatDate(item.handover_at)} {item.handover_by && `by ${item.handover_by}`}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
