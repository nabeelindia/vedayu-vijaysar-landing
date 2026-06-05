import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import StatCard from '../../components/admin/StatCard';
import OrderCard from '../../components/admin/OrderCard';
import PageHeader from '../../components/admin/PageHeader';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [recent,    setRecent]    = useState([]);
  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/dashboard-stats').then(r => r.json()),
      fetch('/api/admin/orders?page=1').then(r => r.json()),
      fetch('/api/admin/orders?status=pending&method=cod&page=1').then(r => r.json()),
    ]).then(([s, r, p]) => {
      setStats(s);
      setRecent((r.data || []).slice(0, 8));
      setPending((p.data || []).slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Dashboard">
      <PageHeader title="Dashboard" />
      {loading ? <p style={{ color:'#888', fontSize:'.9rem' }}>Loading…</p> : (
        <>
          <div className="admin-stat-grid" style={{ marginBottom:24 }}>
            <StatCard label="Today's Orders"    value={stats?.todayOrders    || 0} />
            <StatCard label="Today's Revenue"   value={`₹${Number(stats?.todayRevenue || 0).toLocaleString('en-IN')}`} color="#5C3D1E" />
            <StatCard label="Awaiting Dispatch" value={stats?.awaitingDispatch || 0} color="#E65100"
              onClick={() => router.push('/admin/orders')} />
            <StatCard label="Pending COD Reply" value={stats?.pendingCodVerify || 0} color="#E65100"
              onClick={() => router.push('/admin/whatsapp?tab=verifications')} />
            <StatCard label="RTOs This Week"    value={stats?.rtosThisWeek   || 0} color="#C62828" />
          </div>

          {pending.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <h2 style={{ fontSize:'.85rem', fontWeight:700, color:'#E65100',
                textTransform:'uppercase', letterSpacing:'.8px', margin:'0 0 10px' }}>
                ⏳ Waiting for Customer Reply
              </h2>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {pending.map(o => (
                  <OrderCard key={o.order_id} order={o}
                    onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
                ))}
              </div>
              <a href="/admin/whatsapp?tab=verifications"
                style={{ display:'block', textAlign:'center', marginTop:10,
                  fontSize:'.78rem', color:'#5C3D1E', fontWeight:600 }}>
                View all →
              </a>
            </div>
          )}

          <div>
            <h2 style={{ fontSize:'.85rem', fontWeight:700, color:'#555',
              textTransform:'uppercase', letterSpacing:'.8px', margin:'0 0 10px' }}>
              Recent Orders
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {recent.map(o => (
                <OrderCard key={o.order_id} order={o}
                  onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
              ))}
            </div>
            <a href="/admin/orders" style={{ display:'block', textAlign:'center', marginTop:12,
              fontSize:'.78rem', color:'#5C3D1E', fontWeight:600 }}>
              View all orders →
            </a>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
