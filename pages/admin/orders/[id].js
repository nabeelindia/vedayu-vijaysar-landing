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
  const [notes,     setNotes]     = useState([]);
  const [refunds,   setRefunds]   = useState([]);
  const [newNote,   setNewNote]   = useState('');
  const [refAmount, setRefAmount] = useState('');
  const [refMethod, setRefMethod] = useState('upi');
  const [refNote,   setRefNote]   = useState('');
  const [rtoReason, setRtoReason] = useState('');
  const [showRTO,   setShowRTO]   = useState(false);
  const [saving2,   setSaving2]   = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/orders/${id}`).then(r => r.json()).then(d => {
      setData(d);
      setNotes(d.notes   || []);
      setRefunds(d.refunds || []);
    });
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

  const confirmOrder = () => patch({
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  });

  const markRTO = async () => {
    if (!rtoReason.trim()) return alert('Please enter a return reason.');
    await patch({ status: 'returned', return_reason: rtoReason.trim(), returned_at: new Date().toISOString() });
    setShowRTO(false); setRtoReason('');
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving2(true);
    const res = await fetch(`/api/admin/orders/${id}?action=note`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: newNote }),
    });
    const d = await res.json();
    if (d.note) { setNotes(n => [d.note, ...n]); setNewNote(''); }
    setSaving2(false);
  };

  const addRefund = async () => {
    if (!refAmount) return alert('Enter refund amount.');
    setSaving2(true);
    const res = await fetch(`/api/admin/orders/${id}?action=refund`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: refAmount, method: refMethod, note: refNote }),
    });
    const d = await res.json();
    if (d.refund) { setRefunds(r => [d.refund, ...r]); setRefAmount(''); setRefNote(''); }
    setSaving2(false);
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

      <div className="admin-card-row" style={{ gap:16 }}>
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
            {['pending', 'auto_confirmed'].includes(order.status) && (
              <button onClick={confirmOrder} disabled={saving}
                style={{ padding:'9px 14px', background:'#4A7C59', color:'#fff',
                  border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
                {saving ? '…' : '✓ Confirm Order'}
              </button>
            )}
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
            {order.status === 'sent' && !showRTO && (
              <button onClick={() => setShowRTO(true)}
                style={{ padding:'9px 14px', background:'#fff', color:'#880E4F',
                  border:'1.5px solid #880E4F', borderRadius:8, fontSize:'.82rem',
                  fontWeight:700, cursor:'pointer' }}>
                Mark RTO
              </button>
            )}
            {showRTO && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <input value={rtoReason} onChange={e => setRtoReason(e.target.value)}
                  placeholder="Return reason (e.g. Not reachable)"
                  style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={markRTO} disabled={saving}
                    style={{ flex:1, padding:'8px', background:'#880E4F', color:'#fff',
                      border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
                    {saving ? '…' : 'Confirm RTO'}
                  </button>
                  <button onClick={() => setShowRTO(false)}
                    style={{ padding:'8px 14px', background:'#f0ede8', border:'none',
                      borderRadius:8, fontSize:'.82rem', cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
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

      {/* Notes */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginTop:16 }}>
        <h2 style={{ margin:'0 0 12px', fontSize:'.85rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>Internal Notes</h2>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input value={newNote} onChange={e => setNewNote(e.target.value)}
            placeholder="Add a note…"
            style={{ flex:1, padding:'8px 12px', borderRadius:8,
              border:'1.5px solid #d0c8bc', fontSize:'.82rem' }}
            onKeyDown={e => e.key === 'Enter' && addNote()} />
          <button onClick={addNote} disabled={saving2}
            style={{ padding:'8px 14px', background:'#5C3D1E', color:'#fff',
              border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
            {saving2 ? '…' : 'Add'}
          </button>
        </div>
        {notes.length === 0
          ? <p style={{ color:'#aaa', fontSize:'.82rem', margin:0 }}>No notes yet.</p>
          : notes.map(n => (
              <div key={n.id} style={{ padding:'8px 0', borderBottom:'1px solid #f0ede8',
                fontSize:'.83rem', color:'#333' }}>
                <span style={{ color:'#aaa', fontSize:'.72rem', marginRight:8 }}>
                  {new Date(n.created_at).toLocaleString('en-IN',
                    { timeZone:'Asia/Kolkata', dateStyle:'short', timeStyle:'short' })}
                </span>
                {n.note}
              </div>
            ))
        }
      </div>

      {/* Refunds */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginTop:16 }}>
        <h2 style={{ margin:'0 0 12px', fontSize:'.85rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>Refunds</h2>
        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr auto', gap:8,
          marginBottom:12, alignItems:'center' }}>
          <input value={refAmount} onChange={e => setRefAmount(e.target.value)}
            placeholder="₹ amt" type="number"
            style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }} />
          <select value={refMethod} onChange={e => setRefMethod(e.target.value)}
            style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }}>
            <option value="upi">UPI</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <input value={refNote} onChange={e => setRefNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }} />
          <button onClick={addRefund} disabled={saving2}
            style={{ padding:'8px 14px', background:'#5C3D1E', color:'#fff',
              border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
            {saving2 ? '…' : 'Log'}
          </button>
        </div>
        {refunds.length === 0
          ? <p style={{ color:'#aaa', fontSize:'.82rem', margin:0 }}>No refunds logged.</p>
          : refunds.map(r => (
              <div key={r.id} style={{ padding:'8px 0', borderBottom:'1px solid #f0ede8',
                fontSize:'.83rem', color:'#333', display:'flex', gap:12, alignItems:'center' }}>
                <strong style={{ color:'#C62828' }}>₹{r.amount}</strong>
                <span style={{ background:'#f0ede8', padding:'1px 8px', borderRadius:12,
                  fontSize:'.7rem', fontWeight:700, color:'#5C3D1E', textTransform:'uppercase' }}>{r.method}</span>
                {r.note && <span style={{ color:'#555' }}>{r.note}</span>}
                <span style={{ color:'#aaa', fontSize:'.72rem', marginLeft:'auto' }}>
                  {new Date(r.created_at).toLocaleString('en-IN',
                    { timeZone:'Asia/Kolkata', dateStyle:'short', timeStyle:'short' })}
                </span>
              </div>
            ))
        }
      </div>
    </AdminLayout>
  );
}
