// Admin Departments page — lists and manages all KEC departments with professional Lucide icons
import { useState, useEffect } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import {
  Building2, Building, Search, Plus, Trash2, MapPin, Mail, X, Check, AlertTriangle
} from 'lucide-react';

export default function AdminDepartmentsPage() {
  const toast = useToast();
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');

  const fetchDepts = async () => {
    setLoading(true);
    try {
      const data = await api.getDepartments();
      setDepts(data);
    } catch (err) {
      toast.error('Failed to load departments: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      toast.warning('Please enter both department code and name');
      return;
    }
    setSaving(true);
    try {
      await api.createDepartment({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        office_location: location.trim() || undefined,
        hod_email: email.trim() || undefined,
      });
      toast.success(`Department ${code.toUpperCase()} added successfully`);
      setModalOpen(false);
      setCode('');
      setName('');
      setLocation('');
      setEmail('');
      fetchDepts();
    } catch (err) {
      toast.error('Failed to add department: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept) => {
    if (!window.confirm(`Are you sure you want to delete department ${dept.code} (${dept.name})?`)) {
      return;
    }
    setDeletingId(dept.id);
    try {
      await api.deleteDepartment(dept.id);
      toast.success(`Department ${dept.code} deleted`);
      fetchDepts();
    } catch (err) {
      toast.error('Could not delete: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = depts.filter(d =>
    (d.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.office_location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="section-header mb-24">
        <div>
          <h2 className="flex items-center gap-10">
            <Building2 size={22} color="var(--brand-primary)" />
            KEC Academic Departments
          </h2>
          <p className="text-sm text-secondary mt-4">
            Manage registered academic departments, office desks, and contact routing
          </p>
        </div>
        <div className="flex gap-10 items-center">
          <span className="badge badge-dark" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
            {depts.length} Registered
          </span>
          <button
            id="add-dept-btn"
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2.2} />
            Add Department
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="search-box mb-20" style={{ maxWidth: 360 }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          id="dept-search-input"
          placeholder="Search by code, department name, or location…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="loading-center">
          <div className="spinner spinner-lg" />
          <span>Loading departments…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <Building2 size={42} color="var(--text-muted)" />
          </div>
          <h3>No Departments Found</h3>
          <p>No department matches "{search}".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(d => (
            <div
              key={d.id || d.code}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '18px 20px',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-default)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Building size={20} strokeWidth={2} />
                    </div>
                    <div>
                      <span className="dept-tag" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                        {d.code}
                      </span>
                    </div>
                  </div>

                  <button
                    className="btn btn-ghost"
                    title={`Delete ${d.code}`}
                    onClick={() => handleDelete(d)}
                    disabled={deletingId === d.id}
                    style={{ padding: '6px 8px', color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="font-semibold text-sm mb-8" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  {d.name || d.full_name}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {d.office_location && (
                    <div className="flex items-center gap-6">
                      <MapPin size={13} color="var(--text-muted)" />
                      <span>{d.office_location}</span>
                    </div>
                  )}
                  {d.hod_email && (
                    <div className="flex items-center gap-6">
                      <Mail size={13} color="var(--text-muted)" />
                      <span>{d.hod_email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Department Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title flex items-center gap-10">
                <Building2 size={20} color="var(--brand-primary)" />
                <span>Add Academic Department</span>
              </div>
              <button className="modal-close" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Department Code *</label>
                  <input
                    id="new-dept-code"
                    className="form-control"
                    placeholder="e.g. AIDS, CSD, MECH"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                  />
                  <span className="text-xs text-muted">Short uppercase code used for desk routing</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Department Full Name *</label>
                  <input
                    id="new-dept-name"
                    className="form-control"
                    placeholder="e.g. Artificial Intelligence & Data Science"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Department Desk / Office Location</label>
                  <input
                    id="new-dept-location"
                    className="form-control"
                    placeholder="e.g. Block G, Room 101"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Desk / HOD Email</label>
                  <input
                    id="new-dept-email"
                    type="email"
                    className="form-control"
                    placeholder="e.g. hod.aids@kongu.edu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  id="submit-dept-btn"
                >
                  {saving ? (
                    <><div className="spinner spinner-sm" /> Saving…</>
                  ) : (
                    <span className="flex items-center gap-6">
                      <Check size={16} /> Save Department
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
