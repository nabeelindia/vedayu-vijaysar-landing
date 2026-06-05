import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import StatusBadge from '../../components/admin/StatusBadge';
import PageHeader from '../../components/admin/PageHeader';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '—';

function InboxTab() {
  const [convs,    setConvs]    = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply,    setReply]    = useState('');
  const [sending,  setSending]  = useState(false);
  const bottomRef = useRef();

  const load = () => fetch('/api/wa-inbox').then(r => r.json())
    .then(d => setConvs(d.conversations || []));

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [selected]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    await fetch('/api/wa-reply', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ phone: selected.phone, message: reply.trim() }),
    });
    setReply(''); setSending(false);
    await load();
  };

  const conv = convs.find(c => c.phone === selected?.phone);

  return (
    <div style={{ display:'flex', gap:12, height:'calc(100vh - 140px)', minHeight:400 }}>
      <div style={{ flex:'0 0 220px', overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
        {convs.length === 0 && <p style={{ color:'#aaa', fontSize:'.82rem', padding:8 }}>No messages yet.</p>}
        {convs.map(c => (
          <div key={c.phone} onClick={() => { setSelected(c);
            fetch('/api/wa-inbox', { method:'PATCH', headers:{'Content-Type':'application/json'},
              body: JSON.stringify({ phone: c.phone }) }); }}
            style={{ background: selected?.phone === c.phone ? '#5C3D1E' : '#fff',
              color: selected?.phone === c.phone ? '#fff' : '#1a1a1a',
              borderRadius:10, padding:'10px 12px', cursor:'pointer',
              boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
            <div style={{ fontWeight:700, fontSize:'.85rem' }}>{c.name}</div>
            <div style={{ fontSize:'.72rem', opacity:.7, marginTop:2 }}>
              {c.messages[c.messages.length-1]?.message?.slice(0,40)}…
            </div>
            {c.unread > 0 && (
              <span style={{ background:'#E53935', color:'#fff', fontSize:'.6rem',
                padding:'1px 6px', borderRadius:20, fontWeight:700 }}>{c.unread} new</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fff',
        borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
        {!conv ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            color:'#ccc', fontSize:'.9rem' }}>Select a conversation</div>
        ) : (
          <>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede8',
              fontWeight:700, fontSize:'.9rem', color:'#5C3D1E' }}>
              {conv.name} · <a href={`/admin/customers/${conv.phone}`}
                style={{ fontSize:'.75rem', color:'#888', fontWeight:400 }}>View profile →</a>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex',
              flexDirection:'column', gap:8 }}>
              {conv.messages.map((m, i) => (
                <div key={i} style={{ display:'flex',
                  justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth:'75%', background: m.direction === 'out' ? '#5C3D1E' : '#f0ede8',
                    color: m.direction === 'out' ? '#fff' : '#1a1a1a',
                    padding:'8px 12px', borderRadius:10, fontSize:'.82rem' }}>
                    {m.message || m.bot_replied}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding:'10px 12px', borderTop:'1px solid #f0ede8', display:'flex', gap:8 }}>
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Type a reply…"
                style={{ flex:1, padding:'9px 12px', borderRadius:8,
                  border:'1.5px solid #e0d8cc', fontSize:'.85rem', outline:'none' }} />
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                style={{ padding:'9px 16px', background: sending || !reply.trim() ? '#c4a882' : '#5C3D1E',
                  color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:'.82rem',
                  cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function VerificationsTab() {
  const router = useRouter();
  const [rows,    setRows]    = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ method:'cod', page:1 });
    if (filter !== 'all') params.set('status', filter);
    fetch(`/api/admin/orders?${params}`).then(r => r.json()).then(d => {
      setRows(d.data || []); setLoading(false);
    });
  }, [filter]);

  const FILTERS = ['all','pending','confirmed','auto_confirmed','cancelled'];

  return (
    <>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:'.72rem', fontWeight:700,
              background: filter === f ? '#5C3D1E' : '#f0ede8',
              color: filter === f ? '#fff' : '#555' }}>
            {f === 'all' ? 'All' : f === 'auto_confirmed' ? 'Auto-confirmed' : f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <p style={{ color:'#888' }}>Loading…</p> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.length === 0 && <p style={{ color:'#aaa', fontSize:'.88rem' }}>No orders found.</p>}
          {rows.map(o => (
            <div key={o.order_id} onClick={() => router.push(`/admin/orders/${o.order_id}`)}
              style={{ background:'#fff', borderRadius:12, padding:'12px 16px',
                boxShadow:'0 1px 3px rgba(0,0,0,.07)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontFamily:'monospace', fontWeight:700, color:'#5C3D1E', fontSize:'.88rem' }}>
                  {o.order_id}
                </div>
                <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{o.name} · {o.mobile}</div>
                <div style={{ fontSize:'.72rem', color:'#aaa', marginTop:2 }}>{fmtD(o.created_at)}</div>
              </div>
              <StatusBadge status={o.status} small />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function AdminWhatsApp() {
  const router = useRouter();
  const [tab, setTab] = useState('inbox');
  useEffect(() => {
    if (router.query.tab === 'verifications') setTab('verifications');
  }, [router.query.tab]);

  return (
    <AdminLayout title="WhatsApp">
      <PageHeader title="WhatsApp" />
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {['inbox','verifications'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab === t ? '#5C3D1E' : '#f0ede8',
              color: tab === t ? '#fff' : '#555', fontSize:'.82rem', fontWeight:700 }}>
            {t === 'inbox' ? '💬 Inbox' : '✅ Confirmations'}
          </button>
        ))}
      </div>
      {tab === 'inbox'         && <InboxTab />}
      {tab === 'verifications' && <VerificationsTab />}
    </AdminLayout>
  );
}
