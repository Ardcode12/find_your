// Admin Items Page — all items at Admin Office level or Campus-wide with close/handover and deletion
import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import { statusBadge, escalationBadge, valuableBadge, formatDate, CategoryIcon, timeAgo } from '../../components/helpers.jsx';
import {
  Package, RefreshCw, Search, Eye, CheckCircle2,
  X, Inbox, Sparkles, Check, Trash2, Building, Filter, FileText
} from 'lucide-react';

const STATUS_FILTERS = ['All', 'At Admin Office', 'Recovered', 'Under Verification', 'Escalated to Department', 'Reported'];

export default function AdminItemsPage() {
  const toast = useToast();
  const [items,   setItems]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('All');
  const [scope,   setScope]   = useState('admin'); // 'admin' or 'all'
  const [deptFilter, setDeptFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [claims,   setClaims]   = useState([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [handoverModal, setHandoverModal] = useState(null);
  const [ownerName,    setOwnerName]    = useState('');
  const [ownerRollNo,  setOwnerRollNo]  = useState('');
  const [ownerPhone,   setOwnerPhone]   = useState('');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);
  const [handoverBy,   setHandoverBy]   = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch departments list for filtering
  useEffect(() => {
    api.getDepartments().then(d => setDepartments(d)).catch(() => {});
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminItems({
        status: status === 'All' ? '' : status,
        scope: scope,
        department: deptFilter || undefined,
      });
      setItems(data);
    } catch (err) {
      toast.error('Failed to load items: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [status, scope, deptFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleOpenDetail = async (item) => {
    setSelected(item);
    setClaims([]);
    if (item.status === 'Under Verification' || item.status === 'Matched') {
      setLoadingClaims(true);
      try {
        const itemClaims = await api.getItemClaims(item.id);
        setClaims(itemClaims);
      } catch (err) {
        // quiet ignore if no claims
      } finally {
        setLoadingClaims(false);
      }
    }
  };

  const handleOpenHandover = (item) => {
    setHandoverModal(item);
    setOwnerName(item.owner_name || '');
    setOwnerRollNo(item.owner_roll_no || '');
    setOwnerPhone(item.owner_phone || '');
    setHandoverDate(new Date().toISOString().split('T')[0]);
    setHandoverBy('Dr. S. K. Ramesh (Chief Admin Officer)');
    setHandoverNote('');
  };

  const handleClose = async (e) => {
    if (e) e.preventDefault();
    if (!handoverModal) return;
    if (!ownerName.trim()) {
      toast.warning('Please enter the owner\'s name');
      return;
    }
    if (!ownerRollNo.trim()) {
      toast.warning('Please enter the owner\'s roll number');
      return;
    }
    if (!ownerPhone.trim()) {
      toast.warning('Please enter the owner\'s phone number');
      return;
    }

    setSaving(true);
    try {
      await api.adminCloseItem(handoverModal.id, {
        owner_name: ownerName.trim(),
        owner_roll_no: ownerRollNo.trim(),
        owner_phone: ownerPhone.trim(),
        handover_date: handoverDate,
        handover_by: handoverBy.trim() || 'Central Admin Office',
        notes: handoverNote.trim() || undefined,
      });
      toast.success(`Item successfully delivered to owner ${ownerName} and marked Recovered`);
      setHandoverModal(null);
      fetchItems();
      if (selected?.id === handoverModal.id) setSelected(null);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Permanently delete item #${item.id} ('${item.title}')? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteAdminItem(item.id);
      toast.success(`Item #${item.id} deleted`);
      if (selected?.id === item.id) setSelected(null);
      fetchItems();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const filtered = items.filter(it =>
    (it.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.category || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.location || '').toLowerCase().includes(search.toLowerCase()) ||
    (it.assigned_department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="section-header mb-20">
        <div>
          <h2 className="flex items-center gap-10">
            <Package size={22} color="var(--brand-primary)" />
            Central Admin Items Management
          </h2>
          <p className="text-sm text-secondary mt-4">
            {scope === 'admin'
              ? 'Items currently escalated to Central Lost & Found Office'
              : 'Campus-wide repository across all academic departments and student posts'}
          </p>
        </div>
        <div className="flex gap-10">
          <button className="btn btn-ghost" onClick={fetchItems} id="admin-items-refresh-btn">
            <RefreshCw size={15} style={{ marginRight: 6 }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Scope Switcher & Department Filter */}
      <div className="flex items-center justify-between gap-12 mb-16 flex-wrap" style={{
        background: 'var(--bg-elevated)',
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)'
      }}>
        {/* Scope Tabs */}
        <div className="tabs" style={{ background: 'var(--bg-card)', padding: 3, borderRadius: 'var(--radius-md)' }}>
          <button
            className={`tab ${scope === 'admin' ? 'active' : ''}`}
            onClick={() => setScope('admin')}
            id="scope-admin-btn"
          >
            Admin Office Custody
          </button>
          <button
            className={`tab ${scope === 'all' ? 'active' : ''}`}
            onClick={() => setScope('all')}
            id="scope-all-btn"
          >
            Campus-Wide (All Items)
          </button>
        </div>

        {/* Department Filter */}
        <div className="flex items-center gap-8">
          <Filter size={15} color="var(--text-muted)" />
          <select
            className="form-select"
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            style={{ minWidth: 160, fontSize: '0.85rem', padding: '6px 10px' }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="flex items-center gap-12 mb-20 flex-wrap">
        <div className="search-box" style={{ flex: 1, minWidth: 220 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            id="admin-items-search"
            placeholder="Search items by title, category, location, or department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              id={`filter-${s.toLowerCase().replace(/\s+/g, '-')}`}
              className={`tab ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <span>Loading items…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <Inbox size={42} strokeWidth={1.5} color="var(--text-muted)" />
          </div>
          <h3>No items found</h3>
          <p>No items match your search and filter criteria.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Dept / Office</th>
                <th>Escalation</th>
                <th>Valuable</th>
                <th>Date</th>
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
                        <div className="text-xs text-muted">#{item.id} · {item.reporter_name || 'Anonymous'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge badge-dark">{item.category}</span></td>
                  <td className="text-sm text-secondary">{item.location || '—'}</td>
                  <td>{statusBadge(item.status)}</td>
                  <td>
                    {item.assigned_department ? (
                      <span className="dept-tag">{item.assigned_department}</span>
                    ) : item.assigned_office ? (
                      <span className="badge badge-gray">{item.assigned_office}</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td>{escalationBadge(item.escalation_level)}</td>
                  <td>{valuableBadge(item.is_valuable)}</td>
                  <td className="text-xs text-muted">{timeAgo(item.admin_received_at || item.created_at)}</td>
                  <td>
                    <div className="flex gap-6 items-center">
                      <button
                        id={`view-item-${item.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleOpenDetail(item)}
                        title="View details"
                      >
                        <Eye size={14} />
                      </button>
                      {item.status !== 'Recovered' && (
                        <button
                          id={`close-item-${item.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleOpenHandover(item)}
                          title="Mark delivered to owner"
                        >
                          <CheckCircle2 size={14} style={{ marginRight: 4 }} />
                          Deliver
                        </button>
                      )}
                      <button
                        id={`delete-item-${item.id}`}
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(item)}
                        title="Delete item"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title flex items-center gap-8">
                  <CategoryIcon category={selected.category} size={18} />
                  <span>{selected.title}</span>
                </div>
                <div className="text-xs text-muted mt-4">Item #{selected.id} · Report type: {selected.report_type}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>

            {selected.image_url && (
              <img src={selected.image_url} alt={selected.title}
                style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
            )}

            <div className="grid-2 mb-12">
              <InfoRow label="Category"    value={selected.category} />
              <InfoRow label="Status"      value={statusBadge(selected.status)} />
              <InfoRow label="Location"    value={selected.location} />
              <InfoRow label="Reporter"    value={`${selected.reporter_name || 'Anonymous'} (${selected.reporter_role || 'User'})`} />
              <InfoRow label="Escalation"  value={escalationBadge(selected.escalation_level)} />
              <InfoRow label="Assigned Dept" value={selected.assigned_department || 'Central Office'} />
              <InfoRow label="Valuable"    value={selected.is_valuable ? 'Yes' : 'No'} />
              <InfoRow label="Reported On" value={formatDate(selected.created_at)} />
            </div>

            {selected.description && (
              <div className="mb-14">
                <div className="form-label">Description</div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
              </div>
            )}

            {/* If Recovered: show delivered owner details */}
            {selected.status === 'Recovered' && selected.owner_name && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginBottom: 14
              }}>
                <div className="font-semibold text-sm mb-8 flex items-center gap-6" style={{ color: 'var(--brand-success)' }}>
                  <CheckCircle2 size={16} />
                  <span>Delivered to Owner</span>
                </div>
                <div className="grid-2">
                  <InfoRow label="Owner Name"  value={selected.owner_name} />
                  <InfoRow label="Roll Number" value={selected.owner_roll_no} />
                  <InfoRow label="Phone Number" value={selected.owner_phone} />
                  <InfoRow label="Handover Date" value={formatDate(selected.handover_at)} />
                  <InfoRow label="Handed Over By" value={selected.handover_by} />
                  {selected.handover_notes && <InfoRow label="Notes" value={selected.handover_notes} />}
                </div>
              </div>
            )}

            {/* Claims info if present */}
            {claims.length > 0 && (
              <div className="mb-14" style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px'
              }}>
                <div className="form-label mb-6 flex items-center gap-6">
                  <FileText size={14} color="var(--brand-primary)" />
                  <span>Submitted Verification Claims ({claims.length})</span>
                </div>
                {claims.map(c => (
                  <div key={c.id} style={{ fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6, marginBottom: 6 }}>
                    <div className="font-semibold">{c.claimant_name} ({c.claimant_role}) — Status: {c.status}</div>
                    <div className="text-xs text-secondary mt-2"><strong>Hidden Details:</strong> {c.hidden_details}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                className="btn btn-ghost"
                onClick={() => handleDelete(selected)}
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={14} style={{ marginRight: 6 }} />
                Delete Item
              </button>

              <div className="flex gap-8">
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
                {selected.status !== 'Recovered' && (
                  <button
                    className="btn btn-primary"
                    onClick={() => { handleOpenHandover(selected); setSelected(null); }}
                  >
                    <CheckCircle2 size={15} style={{ marginRight: 6 }} />
                    Deliver to Owner
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Handover Modal */}
      {handoverModal && (
        <div className="modal-backdrop" onClick={() => setHandoverModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title flex items-center gap-8">
                <CheckCircle2 size={18} color="var(--brand-success)" />
                Deliver to Owner (Admin Office)
              </div>
              <button className="modal-close" onClick={() => setHandoverModal(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleClose}>
              <div className="alert alert-success mb-16 flex items-start gap-10">
                <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>Central Admin Handover:</strong> Enter the owner student's credentials for final delivery confirmation.
                  (ID card photo is not required for Central Admin in-person verification).
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">1. Item Owner Full Name *</label>
                  <input
                    id="handover-owner-name"
                    className="form-control"
                    placeholder="e.g. S. Kavitha"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">2. Owner Roll Number *</label>
                    <input
                      id="handover-owner-roll"
                      className="form-control"
                      placeholder="e.g. 22CS142"
                      value={ownerRollNo}
                      onChange={e => setOwnerRollNo(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">3. Owner Phone Number *</label>
                    <input
                      id="handover-owner-phone"
                      className="form-control"
                      placeholder="e.g. 9876543210"
                      value={ownerPhone}
                      onChange={e => setOwnerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">4. Submitting / Handover Date *</label>
                    <input
                      id="handover-date"
                      type="date"
                      className="form-control"
                      value={handoverDate}
                      onChange={e => setHandoverDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Handed Over By (Admin Staff)</label>
                    <input
                      id="handover-by"
                      className="form-control"
                      placeholder="e.g. Dr. S. K. Ramesh (Chief Admin Officer)"
                      value={handoverBy}
                      onChange={e => setHandoverBy(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="handover-note">Notes / Verification Remarks (optional)</label>
                  <textarea
                    id="handover-note"
                    className="form-control"
                    rows={2}
                    placeholder="Physical appearance matched, ID card physically inspected, etc."
                    value={handoverNote}
                    onChange={e => setHandoverNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setHandoverModal(null)}>Cancel</button>
                <button
                  id="confirm-handover-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <><div className="spinner spinner-sm" /> Saving…</>
                  ) : (
                    <span className="flex items-center gap-6">
                      <Check size={15} strokeWidth={2.2} />
                      Confirm Handover &amp; Close Item
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{value || '—'}</div>
    </div>
  );
}
