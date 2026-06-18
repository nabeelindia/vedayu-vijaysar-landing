import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import StatusBadge from '../../components/admin/StatusBadge';
import PageHeader from '../../components/admin/PageHeader';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '—';

const fmtTime = iso => iso
  ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  : null;

const msgDateKey = iso => iso
  ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  : null;

const dateSeparatorLabel = (iso) => {
  if (!iso) return null;
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === todayIST) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d === yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return mobile;
}

function ConvList({ convs, selected, onSelect }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {convs.length === 0 && <p style={{ color:'#aaa', fontSize:'.82rem', padding:8 }}>No messages yet.</p>}
      {convs.map(c => (
        <div key={c.phone} onClick={() => onSelect(c)}
          style={{ background: selected?.phone === c.phone ? '#5C3D1E' : '#fff',
            color: selected?.phone === c.phone ? '#fff' : '#1a1a1a',
            borderRadius:10, padding:'12px 14px', cursor:'pointer',
            boxShadow:'0 1px 3px rgba(0,0,0,.07)', userSelect:'none' }}>
          <div style={{ fontWeight:700, fontSize:'.9rem' }}>{c.name}</div>
          <div style={{ fontSize:'.75rem', opacity:.7, marginTop:3, overflow:'hidden',
            textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {c.messages[c.messages.length-1]?.message?.slice(0,50)}…
          </div>
          {c.unread > 0 && (
            <span style={{ background:'#E53935', color:'#fff', fontSize:'.62rem',
              padding:'2px 7px', borderRadius:20, fontWeight:700, marginTop:4,
              display:'inline-block' }}>{c.unread} new</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Thread({ conv, onBack, isMobile, reply, setReply, sending, sendReply, bottomRef }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', background:'#fff',
      borderRadius: isMobile ? 12 : 12, overflow:'hidden',
      boxShadow:'0 1px 3px rgba(0,0,0,.07)',
      height: isMobile ? 'calc(100vh - 200px)' : '100%' }}>
      {/* Header */}
      <div style={{ padding:'12px 14px', borderBottom:'1px solid #f0ede8',
        display:'flex', alignItems:'center', gap:10 }}>
        {isMobile && (
          <button onClick={onBack}
            style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 8px 4px 0',
              fontSize:'1.1rem', color:'#5C3D1E', lineHeight:1, flexShrink:0 }}>
            ←
          </button>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:'.9rem', color:'#5C3D1E',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {conv.name}
          </div>
          <a href={`/admin/customers/${conv.phone}`}
            style={{ fontSize:'.72rem', color:'#888' }}>
            View profile →
          </a>
        </div>
      </div>
      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex',
        flexDirection:'column', gap:8 }}>
        {(() => {
          let lastDate = null;
          return conv.messages.map((m, i) => {
            const isOut = m.direction === 'out';
            const ts = fmtTime(m.created_at || m.timestamp);
            const dateKey = msgDateKey(m.created_at || m.timestamp);
            const showSep = dateKey && dateKey !== lastDate;
            if (showSep) lastDate = dateKey;
            return (
              <div key={i}>
                {showSep && (
                  <div style={{ textAlign:'center', margin:'8px 0' }}>
                    <span style={{ fontSize:'.68rem', color:'#aaa', background:'#f5f0e8',
                      padding:'2px 10px', borderRadius:20 }}>
                      {dateSeparatorLabel(m.created_at || m.timestamp)}
                    </span>
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', alignItems: isOut ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth:'80%', background: isOut ? '#5C3D1E' : '#f0ede8',
                    color: isOut ? '#fff' : '#1a1a1a',
                    padding:'8px 12px', borderRadius:10, fontSize:'.84rem', lineHeight:1.45 }}>
                    {m.message || m.bot_replied}
                  </div>
                  {ts && (
                    <span style={{ fontSize:'.62rem', color:'#aaa', marginTop:2, paddingLeft:4, paddingRight:4 }}>
                      {ts}
                    </span>
                  )}
                </div>
              </div>
            );
          });
        })()}
        <div ref={bottomRef} />
      </div>
      {/* Reply box */}
      <div style={{ padding:'10px 12px', borderTop:'1px solid #f0ede8', display:'flex', gap:8 }}>
        <input value={reply} onChange={e => setReply(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
          placeholder="Type a reply…"
          style={{ flex:1, padding:'10px 12px', borderRadius:8,
            border:'1.5px solid #e0d8cc', fontSize:'.85rem', outline:'none',
            WebkitAppearance:'none' }} />
        <button onClick={sendReply} disabled={sending || !reply.trim()}
          style={{ padding:'10px 16px', background: sending || !reply.trim() ? '#c4a882' : '#5C3D1E',
            color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:'.82rem',
            cursor: sending ? 'not-allowed' : 'pointer', flexShrink:0 }}>
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

function InboxTab() {
  const isMobile = useIsMobile();
  const [convs,      setConvs]      = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'thread'
  const [reply,      setReply]      = useState('');
  const [sending,    setSending]    = useState(false);
  const bottomRef = useRef();

  const load = () => fetch('/api/wa-inbox').then(r => r.json())
    .then(d => setConvs(d.conversations || [])).catch(() => {});

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [selected]);

  const selectConv = (c) => {
    setSelected(c);
    fetch('/api/wa-inbox', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ phone: c.phone }) }).catch(() => {});
    if (isMobile) setMobileView('thread');
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    await fetch('/api/wa-reply', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ phone: selected.phone, message: reply.trim() }),
    }).catch(() => {});
    setReply(''); setSending(false);
    await load();
  };

  const conv = convs.find(c => c.phone === selected?.phone);

  // ── Mobile layout: full-screen list OR full-screen thread ─────────────────
  if (isMobile) {
    if (mobileView === 'thread' && conv) {
      return (
        <Thread conv={conv} onBack={() => setMobileView('list')} isMobile
          reply={reply} setReply={setReply} sending={sending}
          sendReply={sendReply} bottomRef={bottomRef} />
      );
    }
    return (
      <ConvList convs={convs} selected={selected} onSelect={selectConv} />
    );
  }

  // ── Desktop layout: side by side ──────────────────────────────────────────
  return (
    <div style={{ display:'flex', gap:12, height:'calc(100vh - 160px)', minHeight:400 }}>
      <div style={{ flex:'0 0 240px', overflowY:'auto' }}>
        <ConvList convs={convs} selected={selected} onSelect={selectConv} />
      </div>
      <div style={{ flex:1 }}>
        {!conv ? (
          <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            background:'#fff', borderRadius:12, color:'#ccc', fontSize:'.9rem',
            boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
            Select a conversation
          </div>
        ) : (
          <Thread conv={conv} isMobile={false}
            reply={reply} setReply={setReply} sending={sending}
            sendReply={sendReply} bottomRef={bottomRef} />
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
    }).catch(() => setLoading(false));
  }, [filter]);

  const FILTERS = ['all','pending','confirmed','auto_confirmed','cancelled'];

  return (
    <>
      <div className="admin-filter-bar" style={{ marginBottom:14 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:'.75rem', fontWeight:700,
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
                display:'flex', alignItems:'center', justifyContent:'space-between',
                flexWrap:'wrap', gap:8 }}>
              <div style={{ minWidth:0 }}>
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
            style={{ padding:'9px 18px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab === t ? '#5C3D1E' : '#f0ede8',
              color: tab === t ? '#fff' : '#555', fontSize:'.84rem', fontWeight:700 }}>
            {t === 'inbox' ? '💬 Inbox' : '✅ Confirmations'}
          </button>
        ))}
      </div>
      {tab === 'inbox'         && <InboxTab />}
      {tab === 'verifications' && <VerificationsTab />}
    </AdminLayout>
  );
}
