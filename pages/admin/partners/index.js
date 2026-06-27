// pages/admin/partners/index.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

const fmtRs = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const CARD_STYLE = {
  background: '#fff',
  borderRadius: 12,
  padding: '16px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,.07)',
  flex: '1 1 180px',
  minWidth: 0,
};

const LABEL_STYLE = { fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.6px', color: '#aaa', marginBottom: 6 };
const VALUE_STYLE = { fontSize: '1.6rem', fontWeight: 800, color: '#1a1a1a' };

export default function AdminPartners() {
  const router = useRouter();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/admin/growth-partners')
      .then(r => r.json())
      .then(d => { setPartners(d.partners || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Stats
  const totalPartners    = partners.length;
  const ordersViaPartners = partners.reduce((s, p) => s + (p.orderCount || 0), 0);
  const totalEarnedAll   = partners.reduce((s, p) => s + (p.totalEarned || 0), 0);

  return (
    <AdminLayout title="Growth Partners">
      <PageHeader
        title={`Growth Partners ${totalPartners > 0 ? `(${totalPartners})` : ''}`}
        action={
          <a href="/admin/partners/withdrawals"
            style={{ background: '#5C3D1E', color: '#fff', textDecoration: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: '.82rem', fontWeight: 700 }}>
            Withdrawal Queue
          </a>
        }
      />

      {/* Stats */}
      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Total Partners</div>
          <div style={VALUE_STYLE}>{totalPartners}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Orders via Partners</div>
          <div style={{ ...VALUE_STYLE, color: '#4A7C59' }}>{ordersViaPartners}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>Total Earned (all time)</div>
          <div style={{ ...VALUE_STYLE, color: '#5C3D1E' }}>{fmtRs(totalEarnedAll)}</div>
        </div>
        <div style={CARD_STYLE}>
          <div style={LABEL_STYLE}>KYC Verified</div>
          <div style={{ ...VALUE_STYLE, color: '#C9A84C' }}>
            {partners.filter(p => p.kyc_verified).length}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : partners.length === 0 ? (
        <p style={{ color: '#aaa' }}>No growth partners yet.</p>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f0e8' }}>
                {['Name / Handle', 'Profession / City', 'Orders', 'Total Earned', 'KYC', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left',
                    fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.6px', color: '#888' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id}
                  style={{ borderBottom: '1px solid #f0ede8' }}
                  onMouseOver={e => e.currentTarget.style.background = '#faf8f5'}
                  onMouseOut={e  => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.88rem', color: '#1a1a1a' }}>{p.name}</div>
                    <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>@{p.handle}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '.83rem', color: '#444' }}>{p.profession || '—'}</div>
                    <div style={{ fontSize: '.75rem', color: '#aaa', marginTop: 2 }}>{p.city || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '.9rem', fontWeight: 700,
                    color: '#4A7C59' }}>{p.orderCount}</td>
                  <td style={{ padding: '10px 14px', fontSize: '.83rem', fontWeight: 600,
                    color: '#5C3D1E' }}>{fmtRs(p.totalEarned)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {p.kyc_verified ? (
                      <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '.72rem',
                        fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>Verified</span>
                    ) : (
                      <span style={{ background: '#fef9c3', color: '#a16207', fontSize: '.72rem',
                        fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>KYC Pending</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => router.push(`/admin/partners/${p.id}`)}
                      style={{ background: '#5C3D1E', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '6px 14px', fontSize: '.78rem',
                        fontWeight: 600, cursor: 'pointer' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}
