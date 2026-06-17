import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

const BROWN = '#5C3D1E';

const STATUS_COLORS = {
  pending:     { bg: '#fff3cd', color: '#856404' },
  in_progress: { bg: '#cce5ff', color: '#004085' },
  resolved:    { bg: '#d4edda', color: '#155724' },
  rejected:    { bg: '#f8d7da', color: '#721c24' },
};

const STATUS_LABELS = {
  pending:     'Pending',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  rejected:    'Rejected',
};

const fmtD = iso => iso
  ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
  : '—';

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: '.68rem', fontWeight: 700,
      padding: '3px 9px', borderRadius: 20, display: 'inline-block',
    }}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ReturnRow({ r, onStatusChange }) {
  const [updating, setUpdating] = useState(false);

  async function updateStatus(newStatus) {
    setUpdating(true);
    await fetch('/api/admin/returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, status: newStatus }),
    });
    onStatusChange(r.id, newStatus);
    setUpdating(false);
  }

  const waLink = r.customer_phone
    ? `https://wa.me/91${r.customer_phone}?text=${encodeURIComponent(
        `Hi ${r.customer_name || 'there'}, this is Vedayu support. We received your replacement request for order ${r.order_id}. We'll arrange your replacement shortly!`
      )}`
    : null;

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,.07)',
      padding: '16px 18px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        {/* Left: order + customer info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: '.95rem', color: BROWN }}>{r.order_id}</span>
            <StatusBadge status={r.status} />
          </div>
          {r.customer_name && (
            <div style={{ fontSize: '.82rem', color: '#333', marginBottom: 2 }}>
              👤 {r.customer_name}
            </div>
          )}
          {r.customer_phone && (
            <div style={{ fontSize: '.82rem', color: '#333', marginBottom: 2 }}>
              📱 {r.customer_phone}
            </div>
          )}
          {r.customer_email && (
            <div style={{ fontSize: '.82rem', color: '#555', marginBottom: 2 }}>
              ✉️ {r.customer_email}
            </div>
          )}
          <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: 4 }}>
            {fmtD(r.created_at)}
          </div>
        </div>

        {/* Middle: pack + issue */}
        <div style={{ flex: 2, minWidth: 200 }}>
          {(r.pack || r.amount) && (
            <div style={{ fontSize: '.82rem', color: '#555', marginBottom: 6 }}>
              📦 {r.pack || '—'}{r.amount ? ` · ₹${r.amount}` : ''}
            </div>
          )}
          <div style={{
            background: '#f5f0e8', borderRadius: 8, padding: '8px 12px',
            fontSize: '.84rem', color: '#333', lineHeight: 1.45,
          }}>
            <span style={{ fontWeight: 600, display: 'block', marginBottom: 2, color: BROWN }}>Issue:</span>
            {r.issue || <span style={{ color: '#aaa' }}>No issue description</span>}
          </div>
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" style={{
              background: '#25D366', color: '#fff',
              borderRadius: 8, padding: '7px 12px',
              fontSize: '.78rem', fontWeight: 700,
              textDecoration: 'none', textAlign: 'center',
            }}>
              💬 WhatsApp
            </a>
          )}
          <a href={`/admin/orders?q=${r.order_id}`} target="_blank" rel="noreferrer" style={{
            background: '#f5f0e8', color: BROWN,
            borderRadius: 8, padding: '7px 12px',
            fontSize: '.78rem', fontWeight: 700,
            textDecoration: 'none', textAlign: 'center',
          }}>
            📦 View Order
          </a>
          <select
            value={r.status}
            disabled={updating}
            onChange={e => updateStatus(e.target.value)}
            style={{
              border: `1px solid #ddd`, borderRadius: 8,
              padding: '7px 8px', fontSize: '.78rem',
              cursor: 'pointer', background: '#fff',
            }}
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function AdminReturns() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/admin/returns')
      .then(r => r.json())
      .then(d => { setReturns(d.returns || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handleStatusChange(id, newStatus) {
    setReturns(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  }

  const filtered = filter === 'all' ? returns : returns.filter(r => r.status === filter);
  const counts = {
    all:         returns.length,
    pending:     returns.filter(r => r.status === 'pending').length,
    in_progress: returns.filter(r => r.status === 'in_progress').length,
    resolved:    returns.filter(r => r.status === 'resolved').length,
  };

  return (
    <AdminLayout title="Returns">
      <PageHeader
        title="Return / Replacement Requests"
        subtitle={`${counts.pending} pending · ${returns.length} total`}
      />

      {/* Filter chips */}
      <div className="admin-filter-bar" style={{ marginBottom: 16 }}>
        {[
          { key: 'all',         label: `All (${counts.all})` },
          { key: 'pending',     label: `Pending (${counts.pending})` },
          { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
          { key: 'resolved',    label: `Resolved (${counts.resolved})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none',
            cursor: 'pointer', fontSize: '.8rem', fontWeight: filter === key ? 700 : 400,
            background: filter === key ? BROWN : '#fff',
            color: filter === key ? '#fff' : '#555',
            boxShadow: '0 1px 3px rgba(0,0,0,.08)',
          }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ padding: 24, color: '#888' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <p style={{ padding: 24, color: '#aaa', fontSize: '.9rem' }}>No return requests yet.</p>
      ) : (
        <div>
          {filtered.map(r => (
            <ReturnRow key={r.id} r={r} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
