import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import StatusBadge from '../../../components/admin/StatusBadge';
import VerifyTimeline from '../../../components/admin/VerifyTimeline';
import PageHeader from '../../../components/admin/PageHeader';

const fmt  = n  => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '—';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data,   setData]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [awb,    setAwb]    = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/orders/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  const patch = async (updates) => {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method:'PATCH', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(updates),
    });
    const d = await res.json();
    if (d.order) setData(prev => ({ ...prev, order: d.order }));
    setSaving(false);
  };

  const markSent = async () => {
    if (!awb.trim()) return alert('Please enter a tracking number.');
    await patch({ status:'sent', awb: awb.trim(), sent_at: new Date().toISOString() });
    setAwb('');
  };

  if (!data) return <AdminLayout title="Order"><p style={{ color:'#888', padding:20 }}>Loading…</p></AdminLayout>;

  const { order, verification } = data;

  const Row = ({ label, value }) => (
    <tr style={{ borderBottom:'1px solid #f0ede8' }}>
      <td style={{ padding:'9px 0', fontWeight:600, color:'#555', width:'40%', fontSize:'.85rem' }}>{label}</td>
      <td style={{ padding:'9px 0', fontSize:'.85rem', color:'#1a1a1a' }}>{value}</td>
    </tr>
  );

  return (
    <AdminLayout title={order.order_id}>
      <PageHeader title={order.order_id}
        action={<a href="/admin/orders" style={{ fontSize:'.8rem', color:'#5C3D1E', fontWeight:600 }}>← Orders</a>} />

      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 280px', background:'#fff', borderRadius:12,
          padding:'18px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <h2 style={{ margin:0, fontSize:'.85rem', fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.7px', color:'#888' }}>Order Details</h2>
            <StatusBadge status={order.status} small />
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              <Row label="Customer"   value={order.name} />
              <Row label="Mobile"     value={<a href={`tel:+${order.mobile}`} style={{ color:'#5C3D1E' }}>{order.mobile}</a>} />
              <Row label="Email"      value={order.email || '—'} />
              <Row label="Address"    value={`${order.address}, ${order.city}, ${order.state} — ${order.pincode}`} />
              <Row label="Pack"       value={`${order.pack} × ${order.qty}`} />
              <Row label="Amount"     value={fmt(order.price)} />
              <Row label="Payment"    value={order.method === 'cod' ? 'Cash on Delivery' : 'Prepaid (UPI/Card)'} />
              <Row label="Placed at"  value={fmtD(order.created_at)} />
              {order.awb         && <Row label="Tracking No." value={order.awb} />}
              {order.courier     && <Row label="Courier"      value={order.courier} />}
              {order.sent_at     && <Row label="Order sent"   value={fmtD(order.sent_at)} />}
              {order.delivered_at && <Row label="Delivered"   value={fmtD(order.delivered_at)} />}
            </tbody>
          </table>

          <div style={{ marginTop:18, display:'flex', flexDirection:'column', gap:8 }}>
            {(order.status === 'confirmed' || order.status === 'auto_confirmed') && (
              <div style={{ display:'flex', gap:8 }}>
                <input value={awb} onChange={e => setAwb(e.target.value)}
                  placeholder="Enter tracking number"
                  style={{ flex:1, padding:'9px 12px', borderRadius:8,
                    border:'1.5px solid #d0c8bc', fontSize:'.82rem', outline:'none' }} />
                <button onClick={markSent} disabled={saving}
                  style={{ padding:'9px 14px', background:'#5C3D1E', color:'#fff',
                    border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
                  {saving ? '…' : 'Order Sent'}
                </button>
              </div>
            )}
            {order.status === 'sent' && (
              <button onClick={() => patch({ status:'delivered', delivered_at: new Date().toISOString() })}
                disabled={saving}
                style={{ padding:'9px 14px', background:'#4A7C59', color:'#fff',
                  border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
                {saving ? '…' : 'Mark Delivered'}
              </button>
            )}
            {!['cancelled','returned','delivered'].includes(order.status) && (
              <button onClick={() => { if (confirm('Cancel this order?')) patch({ status:'cancelled' }); }}
                disabled={saving}
                style={{ padding:'9px 14px', background:'#fff', color:'#C62828',
                  border:'1.5px solid #C62828', borderRadius:8, fontSize:'.82rem',
                  fontWeight:700, cursor:'pointer' }}>
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {order.method === 'cod' && (
          <div style={{ flex:'0 1 240px', background:'#fff', borderRadius:12,
            padding:'18px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.07)', height:'fit-content' }}>
            <h2 style={{ margin:'0 0 14px', fontSize:'.85rem', fontWeight:700,
              textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>
              WhatsApp Confirmation
            </h2>
            <VerifyTimeline order={order} verification={verification} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
