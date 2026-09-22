// Department All Items Page — full tracking of found & lost items progressing in department
import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import { statusBadge, valuableBadge, CategoryIcon, timeAgo } from '../../components/helpers.jsx';
import ItemActionModal from '../../components/ItemActionModal.jsx';
import { Package, RefreshCw, Search, Settings, Inbox, HelpCircle, Sparkles, Filter } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Escalated to Department', 'With Department', 'Under Verification', 'Recovered'];
const REPORT_TYPES = [
  { id: 'all',   label: 'All Items' },
  { id: 'found', label: 'Found Reports' },
  { id: 'lost',  label: 'Lost Reports (Progressing)' },
];

export default function DeptItemsPage() {
  const toast = useToast();
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('All');
  const [reportType, setReportType] = useState('all');
  const [actionItem, setActionItem] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDeptItems({
        status: status === 'All' ? '' : status,
        report_type: reportType === 'all' ? '' : reportType,
      });
      setItems(data);
    } catch (err) {
      toast.error('Failed to load department items: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [status, reportType]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter(it =>
    (it.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.reporter_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="section-header mb-20">
        <div>
          <h2 className="flex items-center gap-10">
            <Package size={22} color="var(--brand-primary)" />
            Department Items &amp; Lost Progress
          </h2>
          <p className="text-sm text-secondary mt-4">
            Track all lost reports and found items assigned to your department office
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchItems} id="dept-items-refresh-btn">
          <RefreshCw size={15} style={{ marginRight: 6 }} />
          Refresh
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="flex items-center gap-12 mb-16 flex-wrap" style={{
        background: 'var(--bg-elevated)',
        padding: '10px 14px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)'
      }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', marginRight: 4 }}>
          TRACKING VIEW:
        </span>
        <div className="tabs" style={{ background: 'var(--bg-card)', padding: 3, borderRadius: 'var(--radius-md)' }}>
          {REPORT_TYPES.map(rt => (
            <button
              key={rt.id}
              className={`tab ${reportType === rt.id ? 'active' : ''}`}
              onClick={() => setReportType(rt.id)}
              id={`report-type-${rt.id}`}
            >
              {rt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex items-center gap-12 mb-20 flex-wrap">
        <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            id="dept-items-search"
            placeholder="Search items by title, category, location, or reporter…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              id={`dept-filter-${s.toLowerCase().replace(/\s+/g, '-')}`}
              className={`tab ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s === 'All' ? 'All Statuses' : s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <span>Loading department items…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <Inbox size={42} strokeWidth={1.5} color="var(--text-muted)" />
          </div>
          <h3>No items found</h3>
          <p>No department records match your search and filter criteria.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Valuable</th>
                <th>Escalation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-10">
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: 'var(--bg-elevated)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
                      }}>
                        <CategoryIcon category={item.category} size={17} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{item.title}</div>
                        <div className="text-xs text-muted">#{item.id} · {item.reporter_name || 'Reporter'} ({item.reporter_role || 'user'})</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${item.report_type === 'found' ? 'badge-dark' : 'badge-gray'}`}>
                      {item.report_type?.toUpperCase()}
                    </span>
                  </td>
                  <td><span className="badge badge-dark">{item.category}</span></td>
                  <td className="text-sm text-secondary">{item.location || '—'}</td>
                  <td>{statusBadge(item.status)}</td>
                  <td>{valuableBadge(item.is_valuable)}</td>
                  <td className="text-xs text-muted">{item.escalation_level}</td>
                  <td>
                    <button
                      id={`dept-action-${item.id}`}
                      className="btn btn-primary btn-sm"
                      onClick={() => setActionItem(item)}
                    >
                      <Settings size={14} style={{ marginRight: 5 }} />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actionItem && (
        <ItemActionModal
          item={actionItem}
          onClose={() => setActionItem(null)}
          onDone={() => { setActionItem(null); fetchItems(); }}
        />
      )}
    </div>
  );
}
