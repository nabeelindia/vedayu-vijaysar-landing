// pages/admin/partners/withdrawals.js
import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

const fmtRs   = n  => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = ts => ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const maskAcct = s  => s ? `••••${String(s).slice(-4)}` : '—';

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState('');
  const [processing, setProcessing]   = useState(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/gp-withdrawals')
      .then(r => r.json())
      .then(d => { setWithdrawals(d.withdrawals || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, []);

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const markTransferred = async (id) => {
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/gp-withdrawals/${id}/complete`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed');
      setWithdrawals(prev => prev.filter(w => w.id !== id));
      showToast('Marked as transferred — WhatsApp sent to partner.');
    } catch {
      showToast('Error marking withdrawal. Please try again.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <AdminLayout title="Withdrawal Requests">
      <PageHeader
        title={`Withdrawal Requests${withdrawals.length > 0 ? ` (${withdrawals.length})` : ''}`}
        action={
          <a href="/admin/partners"
            style={{ color: '#5C3D1E', textDecoration: 'none', fontSize: '.82rem', fontWeight: 600 }}>
            ← All Partners
          </a>
        }
      />

      {/* Toast */}
      {toast && (
        <div style={{ background: '#1a1a1a', color: '#fff', padding: '10px 18px',
          borderRadius: 8, marginBottom: 16, fontSize: '.85rem', maxWidth: 400 }}>
          {toast}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : withdrawals.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '40px 24px',
          textAlign: 'center', color: '#aaa', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
          No pending withdrawal requests.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f0e8' }}>
                {['Partner', 'Amount', 'Bank Details', 'Requested', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                    fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.6px', color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => {
                const p = w.partner || {};
                return (
                  <tr key={w.id}
                    style={{ borderBottom: '1px solid #f0ede8', background: '#fffbeb' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#1a1a1a' }}>
                        {p.name || '—'}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
                        @{p.handle} · {p.profession || ''}{p.city ? ` · ${p.city}` : ''}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: 2 }}>
                        {p.mobile || ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
                        {fmtRs(w.amount)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '.83rem', color: '#444', fontWeight: 600 }}>
                        {p.bank_name || '—'}
                      </div>
                      <div style={{ fontSize: '.78rem', color: '#888', fontFamily: 'monospace', marginTop: 2 }}>
                        {maskAcct(p.bank_account)}
                      </div>
                      <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: 2 }}>
                        {p.bank_ifsc || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '.78rem', color: '#888' }}>
                      {fmtDate(w.requested_at)}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button
                        disabled={processing === w.id}
                        onClick={() => markTransferred(w.id)}
                        style={{ background: processing === w.id ? '#ccc' : '#4A7C59',
                          color: '#fff', border: 'none', borderRadius: 6,
                          padding: '7px 14px', fontSize: '.78rem', fontWeight: 700,
                          cursor: processing === w.id ? 'not-allowed' : 'pointer',
                          whiteSpace: 'nowrap' }}>
                        {processing === w.id ? 'Processing…' : 'Mark Transferred'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
