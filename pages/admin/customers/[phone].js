import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import OrderCard from '../../../components/admin/OrderCard';
import PageHeader from '../../../components/admin/PageHeader';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '';

export default function CustomerProfile() {
  const router    = useRouter();
  const { phone } = router.query;
  const [data, setData] = useState(null);
  const [tab,  setTab]  = useState('orders');

  useEffect(() => {
    if (!phone) return;
    fetch(`/api/admin/customers/${phone}`).then(r => r.json()).then(setData);
  }, [phone]);

  if (!data) return <AdminLayout title="Customer"><p style={{ color:'#888', padding:20 }}>Loading…</p></AdminLayout>;

  const { profile, orders, waThread, totalSpend } = data;

  return (
    <AdminLayout title={profile?.name || phone}>
      <PageHeader title={profile?.name || phone}
        action={<a href="/admin/customers" style={{ fontSize:'.8rem', color:'#5C3D1E', fontWeight:600 }}>← Customers</a>} />

      <div style={{ background:'#fff', borderRadius:12, padding:'16px 18px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginBottom:16,
        display:'flex', flexWrap:'wrap', gap:16 }}>
        <div style={{ flex:'1 1 160px' }}>
          <div style={{ fontSize:'1rem', fontWeight:800, color:'#1a1a1a' }}>{profile?.name}</div>
          <div style={{ fontSize:'.82rem', color:'#888', marginTop:4 }}>
            <a href={`tel:+${profile?.mobile}`} style={{ color:'#5C3D1E' }}>{profile?.mobile}</a>
          </div>
          {profile?.email && <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{profile.email}</div>}
          <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{profile?.city}, {profile?.state}</div>
        </div>
        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#5C3D1E' }}>{orders.length}</div>
            <div style={{ fontSize:'.68rem', color:'#888', fontWeight:600 }}>ORDERS</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#4A7C59' }}>
              ₹{Number(totalSpend).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize:'.68rem', color:'#888', fontWeight:600 }}>TOTAL SPEND</div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {['orders','whatsapp'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab === t ? '#5C3D1E' : '#f0ede8',
              color: tab === t ? '#fff' : '#555', fontSize:'.82rem', fontWeight:700 }}>
            {t === 'orders' ? '📦 Orders' : '💬 WhatsApp'}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {orders.map(o => (
            <OrderCard key={o.order_id} order={o}
              onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
          ))}
        </div>
      )}

      {tab === 'whatsapp' && (
        <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px',
          boxShadow:'0 1px 3px rgba(0,0,0,.07)', display:'flex', flexDirection:'column', gap:10 }}>
          {waThread.length === 0 && <p style={{ color:'#aaa', fontSize:'.85rem' }}>No messages yet.</p>}
          {waThread.map((m, i) => (
            <div key={i} style={{ display:'flex',
              justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth:'80%', background: m.direction === 'out' ? '#5C3D1E' : '#f0ede8',
                color: m.direction === 'out' ? '#fff' : '#1a1a1a',
                padding:'8px 12px', borderRadius:10, fontSize:'.82rem' }}>
                <div>{m.message || m.bot_replied}</div>
                <div style={{ fontSize:'.65rem', opacity:.6, marginTop:4, textAlign:'right' }}>
                  {fmtD(m.at || m.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
