import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import StatCard from '../../components/admin/StatCard';
import PageHeader from '../../components/admin/PageHeader';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pct = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : '—';

export default function AdminAnalytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics').then(r => r.json()).then(d => {
      setData(d); setLoading(false);
    });
  }, []);

  if (loading) return <AdminLayout title="Analytics"><p style={{ color:'#888', padding:20 }}>Loading…</p></AdminLayout>;

  const { totalRevenue, totalOrders, revenueByDay, codCount, prepaidCount, verification } = data;
  const confirmRate = pct((verification.confirmed + verification.autoConfirmed), codCount);
  const cancelRate  = pct(verification.cancelled, codCount);
  const days   = Object.entries(revenueByDay || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
  const maxRev = Math.max(...days.map(d => d[1]), 1);

  return (
    <AdminLayout title="Analytics">
      <PageHeader title="Analytics (last 30 days)" />

      <div className="admin-stat-grid" style={{ marginBottom:24 }}>
        <StatCard label="Total Revenue"  value={fmt(totalRevenue)} color="#5C3D1E" />
        <StatCard label="Total Orders"   value={totalOrders} />
        <StatCard label="COD Orders"     value={codCount}
          sub={`${pct(codCount, totalOrders)} of total`} />
        <StatCard label="Prepaid Orders" value={prepaidCount}
          sub={`${pct(prepaidCount, totalOrders)} of total`} color="#4A7C59" />
      </div>

      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginBottom:16 }}>
        <h3 style={{ margin:'0 0 16px', fontSize:'.78rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.8px', color:'#888' }}>Revenue — Last 14 Days</h3>
        <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80 }}>
          {days.map(([day, rev]) => (
            <div key={day} title={`${day}: ${fmt(rev)}`}
              style={{ flex:1, background:'#5C3D1E', borderRadius:'3px 3px 0 0', minWidth:0,
                height:`${(rev / maxRev) * 80}px`, opacity:.85 }} />
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between',
          fontSize:'.6rem', color:'#aaa', marginTop:4 }}>
          <span>{days[0]?.[0]?.slice(5)}</span>
          <span>{days[days.length-1]?.[0]?.slice(5)}</span>
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
        <h3 style={{ margin:'0 0 14px', fontSize:'.78rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.8px', color:'#888' }}>
          WhatsApp Confirmation — COD Orders
        </h3>
        <div className="admin-stat-grid">
          <StatCard label="Customer confirmed"    value={verification.confirmed}
            sub={pct(verification.confirmed, codCount)} color="#2E7D32" />
          <StatCard label="Auto-confirmed"        value={verification.autoConfirmed}
            sub={pct(verification.autoConfirmed, codCount)} color="#1565C0" />
          <StatCard label="Cancelled by customer" value={verification.cancelled}
            sub={cancelRate} color="#C62828" />
          <StatCard label="Pending reply"         value={verification.pending} color="#E65100" />
        </div>
        <div style={{ marginTop:14, padding:'10px 14px', background:'#f5f0e8',
          borderRadius:8, fontSize:'.78rem', color:'#5C3D1E' }}>
          <b>Confirmation rate:</b> {confirmRate} &nbsp;·&nbsp; <b>Cancel rate:</b> {cancelRate}
        </div>
      </div>
    </AdminLayout>
  );
}
