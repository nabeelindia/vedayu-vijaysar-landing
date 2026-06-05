// pages/admin/referrals.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

const fmtRs = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AdminReferrals() {
  const router  = useRouter();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/referrals')
      .then(r => r.json())
      .then(d => { setData(d.leaderboard || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Referrals">
      <PageHeader title="Referral Leaderboard" />
      {loading
        ? <p style={{ color:'#888' }}>Loading…</p>
        : data.length === 0
          ? <p style={{ color:'#aaa' }}>No referral data yet.</p>
          : (
            <div style={{ background:'#fff', borderRadius:12, overflow:'hidden',
              boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f5f0e8' }}>
                    {['#','Name','Mobile','Orders referred','Discount given'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left',
                        fontSize:'.72rem', fontWeight:700, textTransform:'uppercase',
                        letterSpacing:'.6px', color:'#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.referrerId}
                      onClick={() => row.mobile && router.push(`/admin/customers/${row.mobile}`)}
                      style={{ borderBottom:'1px solid #f0ede8',
                        cursor: row.mobile ? 'pointer' : 'default' }}
                      onMouseOver={e => e.currentTarget.style.background = '#faf8f5'}
                      onMouseOut={e  => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', color:'#aaa' }}>{i + 1}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', fontWeight:600, color:'#1a1a1a' }}>{row.name}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', color:'#555', fontFamily:'monospace' }}>{row.mobile || '—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.9rem', fontWeight:800, color:'#4A7C59' }}>{row.ordersReferred}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', color:'#5C3D1E', fontWeight:600 }}>{fmtRs(row.totalDiscount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </AdminLayout>
  );
}
