// Shared Item Action Modal — receive / verify handover to owner / escalate to Super Admin
import { useState } from 'react';
import api from '../api';
import { useToast } from '../ToastContext';
import { statusBadge, valuableBadge, CategoryIcon, formatDate } from './helpers.jsx';
import {
  Info, ArrowDownToLine, CheckCircle2, ArrowUpRight,
  X, AlertTriangle, UserCheck, Check, Calendar, Phone, IdCard, User
} from 'lucide-react';

export default function ItemActionModal({ item, onClose, onDone }) {
  const toast = useToast();
  const [tab, setTab] = useState('info');

  // Owner handover fields (Required for delivery)
  const [ownerName,    setOwnerName]    = useState(item.owner_name || '');
  const [ownerRollNo,  setOwnerRollNo]  = useState(item.owner_roll_no || '');
  const [ownerPhone,   setOwnerPhone]   = useState(item.owner_phone || '');
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);
  const [handoverBy,   setHandoverBy]   = useState(item.handover_by || '');
  const [notes,        setNotes]        = useState('');

  // Escalation to Super Admin fields
  const [escalateReason, setEscalateReason] = useState('Unclaimed after department holding period — forwarded to Super Admin Office');
  const [saving, setSaving] = useState(false);

  const handleReceive = async () => {
    setSaving(true);
    try {
      await api.deptReceiveItem(item.id);
      toast.success('Item marked as received into Department Desk custody');
      onDone();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyHandover = async (e) => {
    if (e) e.preventDefault();
    if (!ownerName.trim()) {
      toast.warning('Please enter the item owner\'s name');
      return;
    }
    if (!ownerRollNo.trim()) {
      toast.warning('Please enter the owner\'s Roll Number');
      return;
    }
    if (!ownerPhone.trim()) {
      toast.warning('Please enter the owner\'s Phone Number');
      return;
    }

    setSaving(true);
    try {
      await api.deptVerifyItem(item.id, {
        owner_name: ownerName.trim(),
        owner_roll_no: ownerRollNo.trim(),
        owner_phone: ownerPhone.trim(),
        handover_date: handoverDate,
        handover_by: handoverBy.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success(`Item successfully delivered to owner ${ownerName} and marked Recovered`);
      onDone();
    } catch (err) {
      toast.error('Handover failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEscalateToAdmin = async () => {
    setSaving(true);
    try {
      await api.escalateToAdmin(item.id, {
        reason: escalateReason || 'Department forwarded item to Central Super Admin Office for final handling'
      });
      toast.success('Item process forwarded to Super Admin Office');
      onDone();
    } catch (err) {
      toast.error('Failed to forward to Super Admin: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title flex items-center gap-10">
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--bg-elevated)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
              }}>
                <CategoryIcon category={item.category} size={18} />
              </div>
              <span>{item.title}</span>
            </div>
            <div className="flex gap-8 mt-6">
              {statusBadge(item.status)}
              {valuableBadge(item.is_valuable)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs mb-20" style={{ flexWrap: 'wrap' }}>
          <button
            id="modal-tab-info"
            className={`tab ${tab === 'info' ? 'active' : ''}`}
            onClick={() => setTab('info')}
          >
            <span className="flex items-center gap-6">
              <Info size={14} />
              Details
            </span>
          </button>

          {item.status !== 'Recovered' && (
            <>
              {item.status === 'Escalated to Department' && (
                <button
                  id="modal-tab-receive"
                  className={`tab ${tab === 'receive' ? 'active' : ''}`}
                  onClick={() => setTab('receive')}
                >
                  <span className="flex items-center gap-6">
                    <ArrowDownToLine size={14} />
                    Receive Custody
                  </span>
                </button>
              )}

              <button
                id="modal-tab-verify"
                className={`tab ${tab === 'verify' ? 'active' : ''}`}
                onClick={() => setTab('verify')}
              >
                <span className="flex items-center gap-6">
                  <UserCheck size={14} />
                  Deliver to Owner
                </span>
              </button>

              <button
                id="modal-tab-escalate"
                className={`tab ${tab === 'escalate' ? 'active' : ''}`}
                onClick={() => setTab('escalate')}
              >
                <span className="flex items-center gap-6">
                  <ArrowUpRight size={14} />
                  Send to Super Admin
                </span>
              </button>
            </>
          )}
        </div>

        {/* ── Info Tab ── */}
        {tab === 'info' && (
          <div>
            {item.image_url && (
              <img src={item.image_url} alt={item.title}
                style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
            )}
            <div className="grid-2 mb-12">
              <InfoRow label="Category"   value={item.category} />
              <InfoRow label="Location"   value={item.location} />
              <InfoRow label="Reporter"   value={`${item.reporter_name || 'Anonymous'} (${item.reporter_role || 'User'})`} />
              <InfoRow label="Date Found" value={item.incident_date} />
              <InfoRow label="Escalation" value={item.escalation_level} />
              <InfoRow label="Dept Desk"  value={item.assigned_department} />
            </div>

            {item.description && (
              <div className="mb-14">
                <div className="form-label">Description</div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
              </div>
            )}

            {/* If already recovered, show recorded delivery details */}
            {item.status === 'Recovered' && item.owner_name && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginTop: 14
              }}>
                <div className="font-semibold text-sm mb-8 flex items-center gap-6" style={{ color: 'var(--brand-success)' }}>
                  <CheckCircle2 size={16} />
                  <span>Handover Delivery Confirmation</span>
                </div>
                <div className="grid-2">
                  <InfoRow label="Delivered To" value={item.owner_name} />
                  <InfoRow label="Roll Number"  value={item.owner_roll_no} />
                  <InfoRow label="Phone Number" value={item.owner_phone} />
                  <InfoRow label="Handover Date" value={formatDate(item.handover_at)} />
                  <InfoRow label="Delivered By" value={item.handover_by} />
                  {item.handover_notes && <InfoRow label="Notes" value={item.handover_notes} />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Receive Tab (Physical receipt from finder) ── */}
        {tab === 'receive' && (
          <div>
            <div className="alert alert-info mb-16 flex items-start gap-10">
              <ArrowDownToLine size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Confirm Physical Receipt:</strong> The student founder has brought the item to the department office.
                Clicking confirm transfers physical possession to the Department Desk cabinet.
              </div>
            </div>

            <div className="card mb-16" style={{ padding: '14px 16px' }}>
              <div className="text-sm"><strong>Item:</strong> {item.title}</div>
              <div className="text-sm mt-4"><strong>Current Status:</strong> {statusBadge(item.status)}</div>
              <div className="text-sm mt-4"><strong>Turned In By:</strong> {item.reporter_name || 'Student'}</div>
            </div>

            <button
              id="confirm-receive-btn"
              className="btn btn-primary w-full"
              style={{ justifyContent: 'center', height: 44 }}
              onClick={handleReceive}
              disabled={saving}
            >
              {saving ? (
                <><div className="spinner spinner-sm" /> Confirming Receipt…</>
              ) : (
                <span className="flex items-center gap-8">
                  <Check size={16} strokeWidth={2.2} />
                  Confirm Physical Desk Receipt
                </span>
              )}
            </button>
          </div>
        )}

        {/* ── Deliver to Owner Tab (Department to Owner Student) ── */}
        {tab === 'verify' && (
          <form onSubmit={handleVerifyHandover}>
            <div className="alert alert-success mb-16 flex items-start gap-10">
              <UserCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Deliver to Lost Student:</strong> Collect the owner's verification details before handing over the item.
                (Photo of ID card is not required for in-person department desk handovers).
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">1. Item Owner Full Name *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="handover-owner-name"
                    className="form-control"
                    placeholder="e.g. S. Kavitha"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    required
                  />
                </div>
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
                  <label className="form-label">Handed Over By (Staff / Desk)</label>
                  <input
                    id="handover-by-staff"
                    className="form-control"
                    placeholder="e.g. Prof. M. Anand (CSE Desk)"
                    value={handoverBy}
                    onChange={e => setHandoverBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Verification Notes / Remarks (optional)</label>
                <textarea
                  id="handover-notes"
                  className="form-control"
                  rows={2}
                  placeholder="ID verified in person, college bag contents checked, etc."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            <button
              id="confirm-verify-btn"
              type="submit"
              className="btn btn-primary w-full mt-16"
              style={{ justifyContent: 'center', height: 44 }}
              disabled={saving}
            >
              {saving ? (
                <><div className="spinner spinner-sm" /> Recording Handover…</>
              ) : (
                <span className="flex items-center gap-8">
                  <Check size={16} strokeWidth={2.2} />
                  Confirm Handover &amp; Mark as Recovered
                </span>
              )}
            </button>
          </form>
        )}

        {/* ── Escalate / Send to Super Admin Tab ── */}
        {tab === 'escalate' && (
          <div>
            <div className="alert alert-warning mb-16 flex items-start gap-10">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Send Process to Super Admin:</strong> Forward this item to the Central Lost &amp; Found Office.
                The Super Admin team will take over custody and manage all subsequent ownership verification and disposition.
              </div>
            </div>

            <div className="form-group mb-16">
              <label className="form-label">Reason for Forwarding to Super Admin</label>
              <textarea
                id="escalate-reason"
                className="form-control"
                rows={3}
                placeholder="e.g. Unclaimed after 7 days at department desk, or valuable item requiring central locker storage…"
                value={escalateReason}
                onChange={e => setEscalateReason(e.target.value)}
              />
            </div>

            <button
              id="confirm-escalate-admin-btn"
              className="btn btn-secondary w-full"
              style={{
                justifyContent: 'center', height: 44,
                borderColor: 'var(--text-primary)', color: 'var(--text-primary)'
              }}
              onClick={handleEscalateToAdmin}
              disabled={saving}
            >
              {saving ? (
                <><div className="spinner spinner-sm" /> Submitting to Super Admin…</>
              ) : (
                <span className="flex items-center gap-8">
                  <ArrowUpRight size={16} strokeWidth={2.2} />
                  Submit Item to Super Admin Office
                </span>
              )}
            </button>
          </div>
        )}

        <div className="modal-footer" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div className="form-label">{label}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value || '—'}</div>
    </div>
  );
}
