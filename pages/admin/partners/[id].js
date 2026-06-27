// pages/admin/partners/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

const fmtRs   = n  => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDate = ts => ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const maskAcct = s  => s ? `••••${String(s).slice(-4)}` : '—';

const CARD = {
  background: '#fff', borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,.07)',
  padding: '20px 24px', marginBottom: 20,
};

const STATUS_COLORS = {
  earned:     { bg: '#dcfce7', color: '#15803d' },
  pending:    { bg: '#fef9c3', color: '#a16207' },
  in_transit: { bg: '#dbeafe', color: '#1d4ed8' },
  cancelled:  { bg: '#fee2e2', color: '#b91c1c' },
  completed:  { bg: '#dcfce7', color: '#15803d' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '.72rem',
      fontWeight: 700, padding: '3px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

export default function AdminPartnerDetail() {
  const router = useRouter();
  const { id }  = router.query;

  const [partner,     setPartner]     = useState(null);
  const [earnings,    setEarnings]    = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [kycLoading, setKycLoading]   = useState(false);
  const [toast, setToast]             = useState('');

  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    // Fetch partner list to get this partner's data
    fetch('/api/admin/growth-partners')
      .then(r => r.json())
      .then(async d => {
        const p = (d.partners || []).find(x => x.id === id);
        setPartner(p || null);

        // Fetch earnings & all withdrawals for this partner
        const [eRes, wRes] = await Promise.all([
          fetch(`/api/admin/gp-partner-earnings?partner_id=${id}`),
          fetch(`/api/admin/gp-withdrawals-all?partner_id=${id}`),
        ]);

        const earningsData = eRes.ok ? (await eRes.json()).earnings || [] : [];
        const wData = wRes.ok ? (await wRes.json()).withdrawals || [] : [];

        setEarnings(earningsData);
        setWithdrawals(wData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const verifyKyc = async () => {
    setKycLoading(true);
    try {
      const res = await fetch(`/api/admin/gp-kyc/${id}/verify`, { method: 'PUT' });
      if (!res.ok) throw new Error('Failed');
      setPartner(prev => ({ ...prev, kyc_verified: true, kyc_verified_at: new Date().toISOString() }));
      showToast('KYC verified successfully.');
    } catch {
      showToast('Error verifying KYC. Please try again.');
    } finally {
      setKycLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Partner Detail">
        <p style={{ color: '#888' }}>Loading…</p>
      </AdminLayout>
    );
  }

  if (!partner) {
    return (
      <AdminLayout title="Partner Not Found">
        <PageHeader title="Partner Not Found"
          action={<a href="/admin/partners" style={{ color: '#5C3D1E', textDecoration: 'none', fontWeight: 600 }}>← Back</a>} />
        <p style={{ color: '#aaa' }}>Partner with ID {id} was not found.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={partner.name}>
      <PageHeader
        title={partner.name}
        action={
          <a href="/admin/partners"
            style={{ color: '#5C3D1E', textDecoration: 'none', fontSize: '.82rem', fontWeight: 600 }}>
            ← All Partners
          </a>
        }
      />

      {toast && (
        <div style={{ background: '#1a1a1a', color: '#fff', padding: '10px 18px',
          borderRadius: 8, marginBottom: 16, fontSize: '.85rem', maxWidth: 400 }}>
          {toast}
        </div>
      )}

      {/* Profile Card */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{partner.name}</h2>
              <span style={{ fontSize: '.8rem', color: '#888' }}>@{partner.handle}</span>
              {partner.kyc_verified ? (
                <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '.72rem',
                  fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>KYC Verified</span>
              ) : (
                <span style={{ background: '#fef9c3', color: '#a16207', fontSize: '.72rem',
                  fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>KYC Pending</span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: '.83rem', color: '#555' }}>
              <span>📞 {partner.mobile}</span>
              <span>✉️ {partner.email}</span>
              <span>🏙️ {partner.city}</span>
              <span>💼 {partner.profession}</span>
            </div>
            {partner.kyc_verified_at && (
              <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: 6 }}>
                KYC verified on {fmtDate(partner.kyc_verified_at)}
              </div>
            )}
          </div>

          {!partner.kyc_verified && (
            <button
              disabled={kycLoading}
              onClick={verifyKyc}
              style={{ background: kycLoading ? '#ccc' : '#4A7C59', color: '#fff',
                border: 'none', borderRadius: 8, padding: '9px 18px',
                fontSize: '.82rem', fontWeight: 700,
                cursor: kycLoading ? 'not-allowed' : 'pointer' }}>
              {kycLoading ? 'Verifying…' : 'Verify KYC'}
            </button>
          )}
        </div>
      </div>

      {/* Bank Details */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 14px', fontSize: '.9rem', fontWeight: 700, color: '#5C3D1E' }}>
          Bank Details
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 32px', fontSize: '.85rem', color: '#444' }}>
          <div><span style={{ color: '#aaa', fontSize: '.75rem' }}>Bank</span><br /><strong>{partner.bank_name}</strong></div>
          <div><span style={{ color: '#aaa', fontSize: '.75rem' }}>Account</span><br /><strong style={{ fontFamily: 'monospace' }}>{maskAcct(partner.bank_account)}</strong></div>
          <div><span style={{ color: '#aaa', fontSize: '.75rem' }}>IFSC</span><br /><strong style={{ fontFamily: 'monospace' }}>{partner.bank_ifsc}</strong></div>
        </div>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Orders Referred', value: partner.orderCount || 0, color: '#4A7C59' },
          { label: 'Total Earned', value: fmtRs(partner.totalEarned), color: '#5C3D1E' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,.07)', flex: '1 1 160px' }}>
            <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.6px', color: '#aaa', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Earnings Table */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 14px', fontSize: '.9rem', fontWeight: 700, color: '#1a1a1a' }}>
          Earnings History
        </h3>
        {earnings.length === 0 ? (
          <p style={{ color: '#aaa', margin: 0, fontSize: '.83rem' }}>No earnings recorded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f0e8' }}>
                {['Order ID', 'Amount', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                    fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.5px', color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {earnings.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f0ede8' }}>
                  <td style={{ padding: '9px 12px', fontFamily: 'monospace',
                    fontSize: '.78rem', color: '#555' }}>{e.order_id}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700,
                    color: '#4A7C59', fontSize: '.85rem' }}>{fmtRs(e.amount)}</td>
                  <td style={{ padding: '9px 12px' }}><StatusBadge status={e.status} /></td>
                  <td style={{ padding: '9px 12px', fontSize: '.78rem', color: '#888' }}>
                    {fmtDate(e.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Withdrawals Table */}
      <div style={CARD}>
        <h3 style={{ margin: '0 0 14px', fontSize: '.9rem', fontWeight: 700, color: '#1a1a1a' }}>
          Withdrawal History
        </h3>
        {withdrawals.length === 0 ? (
          <p style={{ color: '#aaa', margin: 0, fontSize: '.83rem' }}>No withdrawals yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f0e8' }}>
                {['Amount', 'Status', 'Requested', 'Completed'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                    fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.5px', color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => (
                <tr key={w.id} style={{ borderBottom: '1px solid #f0ede8' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700,
                    color: '#15803d', fontSize: '.85rem' }}>{fmtRs(w.amount)}</td>
                  <td style={{ padding: '9px 12px' }}><StatusBadge status={w.status} /></td>
                  <td style={{ padding: '9px 12px', fontSize: '.78rem', color: '#888' }}>
                    {fmtDate(w.requested_at)}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: '.78rem', color: '#888' }}>
                    {fmtDate(w.completed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
