// Admin Auto-Escalate page — trigger batch escalation with log and professional icons
import { useState } from 'react';
import api from '../../api';
import { useToast } from '../../ToastContext';
import { Zap, Clock, Calendar, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export default function AdminEscalatePage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);

  const handleEscalate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.autoEscalate();
      setResult(res);
      toast.success(`Escalated ${res.total} item(s)`);
    } catch (err) {
      toast.error('Escalation failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="section-header mb-24">
        <div>
          <h2 className="flex items-center gap-10">
            <Zap size={22} color="var(--brand-primary)" />
            Auto Escalation
          </h2>
          <p className="text-sm text-secondary mt-4">
            Batch-escalate items that have exceeded their holding threshold
          </p>
        </div>
      </div>

      {/* Escalation rules info */}
      <div className="grid-2 mb-24">
        <div className="card">
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: '#eef2ff', color: 'var(--brand-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14
          }}>
            <Clock size={22} strokeWidth={2.2} />
          </div>
          <h3 style={{ marginBottom: 8 }}>24-Hour Rule</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Found items at <em>user level</em> with no match after 24 hours are automatically escalated:
            items from common areas go to the Admin Office, items from department areas go to the relevant Department.
          </p>
        </div>

        <div className="card">
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: '#fef3c7', color: '#d97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14
          }}>
            <Calendar size={22} strokeWidth={2.2} />
          </div>
          <h3 style={{ marginBottom: 8 }}>7-Day Rule</h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Items held at a <em>Department</em> with no owner claim after 7 days are escalated further
            to the Central Admin Office for final institutional disposition.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: 8 }}>Run Auto-Escalation Engine</h3>
        <p className="text-sm mb-20" style={{ color: 'var(--text-secondary)' }}>
          Click the button below to trigger the batch escalation routine. This will evaluate
          all pending reports against holding time thresholds.
        </p>

        <div className="alert alert-warning mb-20 flex items-start gap-10">
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>This action updates items in the database. Escalated items will change escalation levels and notify assigned units immediately.</span>
        </div>

        <button
          id="run-escalation-btn"
          className="btn btn-primary"
          onClick={handleEscalate}
          disabled={loading}
          style={{ width: '100%', justifyContent: 'center', height: 44 }}
        >
          {loading ? (
            <><div className="spinner spinner-sm" /> Running escalation routine…</>
          ) : (
            <span className="flex items-center gap-8">
              <Zap size={16} strokeWidth={2.2} />
              Run Auto Escalate Now
            </span>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="card mt-24" style={{ maxWidth: 520 }}>
          <div className="flex items-center gap-10 mb-14">
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#ecfdf5', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle2 size={18} strokeWidth={2.2} />
            </div>
            <h3>Escalation Complete</h3>
          </div>
          <div className="flex gap-16 mb-16">
            <div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'Poppins' }}>
                {result.total}
              </div>
              <div className="text-xs text-muted">Items Escalated</div>
            </div>
          </div>
          {result.escalated_item_ids?.length > 0 ? (
            <div>
              <div className="form-label">Escalated Item IDs</div>
              <div className="chip-list mt-8">
                {result.escalated_item_ids.map(id => (
                  <span key={id} className="badge badge-purple">Item #{id}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="alert alert-info flex items-center gap-8">
              <Info size={16} />
              <span>No items required escalation at this time. All items are within thresholds.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
