import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/Layout';
import { supabaseClient } from '../../lib/supabaseClient';

const BROWN  = '#5C3D1E';
const BLUE   = '#1565c0';
const BORDER = '1px solid #e8e2d9';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
}

function fmtFull(iso) {
  return iso ? new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
  }) : '—';
}

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit',
  }) : '';
}

function msgDateKey(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null;
}

function dateSepLabel(iso) {
  if (!iso) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const d     = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === today) return 'Today';
  const yest = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === yest) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
}

function firstUserMsg(messages) {
  if (!Array.isArray(messages)) return '';
  const m = messages.find(m => m.role === 'user');
  return m ? (m.content || '').slice(0, 60) : '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderMarkdown(text) {
  if (!text) return '';
  let s = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '');
  const lines = s.split('\n');
  const out = []; let inUl = false, inOl = false;
  for (const line of lines) {
    if (/^- (.+)/.test(line))     { if (!inUl) { out.push('<ul>'); inUl=true; } out.push(`<li>${escapeHtml(line.replace(/^- /,''))}</li>`); }
    else if (/^\d+\. (.+)/.test(line)) { if (!inOl) { out.push('<ol>'); inOl=true; } out.push(`<li>${escapeHtml(line.replace(/^\d+\. /,''))}</li>`); }
    else { if (inUl) { out.push('</ul>'); inUl=false; } if (inOl) { out.push('</ol>'); inOl=false; } out.push(escapeHtml(line)); }
  }
  if (inUl) out.push('</ul>'); if (inOl) out.push('</ol>');
  let r = out.join('\n');
  r = r.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  r = r.replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
  return r;
}

const LOCALE_FLAG = { en:'🇬🇧', hi:'🇮🇳', ta:'🇮🇳', te:'🇮🇳' };

function StatusPill({ session }) {
  if (session.archived)     return <Pill color="#6b7280" bg="#f3f4f6">ARCHIVED</Pill>;
  if (session.admin_active) return <Pill color={BLUE} bg="#eff6ff" dot>LIVE</Pill>;
  if (session.escalated)    return <Pill color="#b45309" bg="#fffbeb">ESCALATED</Pill>;
  return null;
}

function Pill({ color, bg, children, dot }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, fontSize: '.6rem', fontWeight: 700,
      letterSpacing: '.04em', padding: '2px 7px', borderRadius: 10,
    }}>
      {dot && <span style={{ width:6, height:6, borderRadius:'50%', background:color, animation:'livePulse 1.5s infinite' }}/>}
      {children}
    </span>
  );
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return m;
}

// ─── Session List ─────────────────────────────────────────────────────────────

function SessionList({ sessions, selected, onSelect, tab, onTabChange, search, onSearch }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#fff', borderRight: BORDER }}>
      {/* Tabs */}
      <div style={{ display:'flex', borderBottom: BORDER, flexShrink:0 }}>
        {['all','active','archived'].map(t => (
          <button key={t} onClick={() => onTabChange(t)} style={{
            flex:1, padding:'10px 4px', background:'none', border:'none',
            borderBottom: tab===t ? `2px solid ${BROWN}` : '2px solid transparent',
            color: tab===t ? BROWN : '#888', fontSize:'.75rem', fontWeight:700,
            cursor:'pointer', textTransform:'uppercase', letterSpacing:'.04em',
          }}>
            {t === 'all' ? 'All' : t === 'active' ? '⚡ Live' : '📦 Archived'}
          </button>
        ))}
      </div>
      {/* Search */}
      <div style={{ padding:'8px 10px', borderBottom: BORDER, flexShrink:0 }}>
        <div style={{ position:'relative' }}>
          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#bbb', fontSize:'.85rem', pointerEvents:'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search by name, phone, message…"
            style={{
              width:'100%', boxSizing:'border-box',
              padding:'7px 8px 7px 28px',
              border: BORDER, borderRadius:8,
              fontSize:'.78rem', outline:'none', background:'#faf8f5',
            }}
          />
        </div>
      </div>
      {/* List */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {sessions.length === 0 && (
          <div style={{ padding:24, color:'#bbb', fontSize:'.82rem', textAlign:'center' }}>
            {tab === 'archived' ? 'No archived conversations.' : tab === 'active' ? 'No live sessions.' : 'No conversations yet.'}
          </div>
        )}
        {sessions.map(s => {
          const isSel   = selected?.id === s.id;
          const preview = firstUserMsg(s.messages);
          const name    = s.contact_name || 'Anonymous';
          return (
            <div key={s.id} onClick={() => onSelect(s)} style={{
              padding:'12px 14px', cursor:'pointer', borderBottom: BORDER,
              background: isSel ? BROWN : 'transparent',
              color: isSel ? '#fff' : '#1a1a1a',
              transition: 'background .12s',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                <span style={{ fontWeight:700, fontSize:'.84rem', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {LOCALE_FLAG[s.locale] || '🌐'} {name}
                </span>
                <span style={{ fontSize:'.68rem', opacity:.65, flexShrink:0 }}>{relativeTime(s.updated_at || s.created_at)}</span>
              </div>
              <div style={{ fontSize:'.78rem', opacity:.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>
                {preview || <em>No messages</em>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                <StatusPill session={s} />
                {s.csat === 'up'   && <span style={{ fontSize:'.72rem' }}>👍</span>}
                {s.csat === 'down' && <span style={{ fontSize:'.72rem' }}>👎</span>}
                {s.contact_phone && (
                  <span style={{ fontSize:'.65rem', opacity:.6 }}>📞 {s.contact_phone}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Chat Thread ──────────────────────────────────────────────────────────────

function ChatThread({ session, adminInput, setAdminInput, sending, onTakeover, onRelease, onSendAdminMessage, onArchive }) {
  const messages    = Array.isArray(session.messages) ? session.messages : [];
  const messagesEnd = useRef(null);
  const [kebabOpen, setKebabOpen] = useState(false);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const name = session.contact_name || 'Anonymous';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#faf8f5' }}>
      {/* Thread header */}
      <div style={{
        padding:'12px 16px', background:'#fff', borderBottom: BORDER,
        display:'flex', alignItems:'center', gap:10, flexShrink:0,
      }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontWeight:700, fontSize:'.92rem', color: BROWN }}>{name}</span>
            <StatusPill session={session} />
          </div>
          <div style={{ fontSize:'.72rem', color:'#888', marginTop:2 }}>
            {LOCALE_FLAG[session.locale]} {session.locale?.toUpperCase()} · {fmtFull(session.created_at)}
          </div>
        </div>
        {/* Kebab menu */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setKebabOpen(o => !o)} style={{
            background:'none', border: BORDER, borderRadius:6,
            padding:'4px 8px', cursor:'pointer', fontSize:'.9rem', color:'#666',
          }}>⋮</button>
          {kebabOpen && (
            <div onClick={() => setKebabOpen(false)} style={{
              position:'absolute', right:0, top:'110%', background:'#fff',
              border: BORDER, borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,.1)',
              zIndex:100, minWidth:160, overflow:'hidden',
            }}>
              {!session.archived ? (
                <button onClick={() => onArchive(session.session_id, 'archive')} style={menuItemStyle}>
                  📦 Archive conversation
                </button>
              ) : (
                <button onClick={() => onArchive(session.session_id, 'unarchive')} style={menuItemStyle}>
                  📤 Unarchive
                </button>
              )}
              {session.admin_active && (
                <button onClick={() => onRelease(session.session_id)} style={{ ...menuItemStyle, color:'#c62828' }}>
                  🤖 Release to AI
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
        {messages.length === 0 && (
          <div style={{ color:'#ccc', textAlign:'center', marginTop:40, fontSize:'.85rem' }}>No messages yet.</div>
        )}
        {(() => {
          let lastDate = null;
          return messages.map((m, i) => {
            const isUser  = m.role === 'user';
            const isAdmin = m.role === 'admin';
            const ts      = fmtTime(m.timestamp || m.created_at);
            const dk      = msgDateKey(m.timestamp || m.created_at);
            const showSep = dk && dk !== lastDate;
            if (showSep) lastDate = dk;
            return (
              <div key={i}>
                {showSep && (
                  <div style={{ textAlign:'center', margin:'8px 0' }}>
                    <span style={{ fontSize:'.66rem', color:'#aaa', background:'#ece8e1', padding:'2px 10px', borderRadius:20 }}>
                      {dateSepLabel(m.timestamp || m.created_at)}
                    </span>
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  {isAdmin && <span style={{ fontSize:'.62rem', color: BLUE, fontWeight:600, marginBottom:2 }}>Support Agent</span>}
                  <div style={{
                    maxWidth:'78%', padding:'8px 12px', borderRadius:12,
                    fontSize:'.84rem', lineHeight:1.5,
                    background: isUser ? BROWN : (isAdmin ? BLUE : '#fff'),
                    color: (isUser || isAdmin) ? '#fff' : '#1a1a1a',
                    boxShadow: '0 1px 2px rgba(0,0,0,.06)',
                  }}
                    {...(!isUser && !isAdmin ? { dangerouslySetInnerHTML: { __html: renderMarkdown(m.content) } } : {})}
                  >
                    {(isUser || isAdmin) ? m.content : null}
                  </div>
                  {ts && <span style={{ fontSize:'.6rem', color:'#aaa', marginTop:2 }}>{ts}</span>}
                </div>
              </div>
            );
          });
        })()}
        <div ref={messagesEnd} />
      </div>

      {/* Action bar */}
      <div style={{ flexShrink:0, borderTop: BORDER, background:'#fff' }}>
        {!session.admin_active ? (
          <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:'.78rem', color:'#999', flex:1 }}>🤖 AI is handling this conversation</span>
            <button onClick={() => onTakeover(session.session_id)} style={{
              background: BLUE, color:'#fff', border:'none', borderRadius:8,
              padding:'8px 18px', fontSize:'.82rem', fontWeight:700, cursor:'pointer',
            }}>Take Over</button>
          </div>
        ) : (
          <div style={{ padding:'10px 12px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ fontSize:'.72rem', color: BLUE, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background: BLUE, display:'inline-block', animation:'livePulse 1.5s infinite' }}/>
                Admin Active
              </span>
              <button onClick={() => onRelease(session.session_id)} style={{
                background:'none', color:'#c62828', border:'1px solid #fca5a5',
                borderRadius:6, padding:'3px 10px', fontSize:'.72rem', fontWeight:600, cursor:'pointer',
              }}>Release to AI</button>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <textarea
                rows={2}
                placeholder="Type a message to the customer… (Enter to send)"
                value={adminInput}
                onChange={e => setAdminInput(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); onSendAdminMessage(session.session_id, adminInput); } }}
                disabled={sending}
                style={{
                  flex:1, resize:'none', border: BORDER, borderRadius:8,
                  padding:'8px 10px', fontSize:'.84rem', fontFamily:'inherit', outline:'none',
                  background: sending ? '#faf8f5' : '#fff',
                }}
              />
              <button
                onClick={() => onSendAdminMessage(session.session_id, adminInput)}
                disabled={sending || !adminInput.trim()}
                style={{
                  background: adminInput.trim() ? BLUE : '#e0e7ff',
                  color: adminInput.trim() ? '#fff' : '#a0aec0',
                  border:'none', borderRadius:8, padding:'0 18px',
                  fontWeight:700, cursor: adminInput.trim() ? 'pointer' : 'default',
                  fontSize:'.84rem', alignSelf:'stretch', transition:'background .15s',
                }}
              >Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const menuItemStyle = {
  display:'block', width:'100%', padding:'10px 14px', background:'none', border:'none',
  textAlign:'left', cursor:'pointer', fontSize:'.82rem', color:'#1a1a1a',
};

// ─── Customer Info Panel ──────────────────────────────────────────────────────

function InfoPanel({ session, onArchive, onRelease }) {
  const hasContact = session.contact_name || session.contact_phone;
  return (
    <div style={{
      width:240, flexShrink:0, display:'flex', flexDirection:'column',
      borderLeft: BORDER, background:'#fff', overflowY:'auto',
    }}>
      {/* Customer */}
      <div style={{ padding:'16px 14px', borderBottom: BORDER }}>
        <div style={{ fontSize:'.65rem', fontWeight:700, color:'#aaa', letterSpacing:'.06em', marginBottom:10, textTransform:'uppercase' }}>Customer</div>
        {hasContact ? (
          <>
            <div style={{ fontWeight:700, fontSize:'.88rem', color:'#1a1a1a', marginBottom:4 }}>
              {session.contact_name || '—'}
            </div>
            {session.contact_phone && (
              <a href={`tel:+91${session.contact_phone}`} style={{ display:'block', fontSize:'.78rem', color: BLUE, textDecoration:'none', marginBottom:2 }}>
                📞 +91 {session.contact_phone}
              </a>
            )}
          </>
        ) : (
          <div style={{ fontSize:'.78rem', color:'#bbb' }}>No contact info captured</div>
        )}
      </div>

      {/* Session metadata */}
      <div style={{ padding:'14px', borderBottom: BORDER }}>
        <div style={{ fontSize:'.65rem', fontWeight:700, color:'#aaa', letterSpacing:'.06em', marginBottom:10, textTransform:'uppercase' }}>Session</div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <Row label="Started" value={fmtFull(session.created_at)} />
          <Row label="Locale"  value={`${LOCALE_FLAG[session.locale]} ${session.locale?.toUpperCase()}`} />
          {session.csat && <Row label="CSAT" value={session.csat === 'up' ? '👍 Positive' : '👎 Negative'} />}
          <Row label="Status" value={
            session.archived     ? '📦 Archived'   :
            session.admin_active ? '⚡ Admin Active' :
            session.escalated    ? '🚨 Escalated'   : '🤖 AI Handling'
          } />
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding:'14px', display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ fontSize:'.65rem', fontWeight:700, color:'#aaa', letterSpacing:'.06em', marginBottom:2, textTransform:'uppercase' }}>Actions</div>
        {session.contact_phone && (
          <a href={`/admin/orders?search=${session.contact_phone}`} target="_blank" rel="noreferrer" style={{
            display:'block', padding:'8px 12px', background:'#f7f5f2', border: BORDER,
            borderRadius:8, fontSize:'.78rem', color: BROWN, fontWeight:600, textDecoration:'none', textAlign:'center',
          }}>
            View Orders ↗
          </a>
        )}
        {!session.archived ? (
          <button onClick={() => onArchive(session.session_id, 'archive')} style={actionBtnStyle('#f3f4f6', '#4b5563')}>
            📦 Archive Conversation
          </button>
        ) : (
          <button onClick={() => onArchive(session.session_id, 'unarchive')} style={actionBtnStyle('#eff6ff', BLUE)}>
            📤 Unarchive
          </button>
        )}
        {session.admin_active && (
          <button onClick={() => onRelease(session.session_id)} style={actionBtnStyle('#fef2f2', '#c62828')}>
            🤖 Release to AI
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
      <span style={{ fontSize:'.72rem', color:'#999' }}>{label}</span>
      <span style={{ fontSize:'.72rem', color:'#1a1a1a', fontWeight:500, textAlign:'right' }}>{value}</span>
    </div>
  );
}

const actionBtnStyle = (bg, color) => ({
  padding:'8px 12px', background: bg, border: BORDER,
  borderRadius:8, fontSize:'.78rem', color, fontWeight:600,
  cursor:'pointer', textAlign:'center', width:'100%',
});

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminChats() {
  const isMobile = useIsMobile();
  const [sessions, setSessions]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [tab, setTab]               = useState('all');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [adminInput, setAdminInput] = useState('');
  const [sending, setSending]       = useState(false);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'thread'

  // Fetch sessions when tab changes
  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/chats?tab=${tab}`)
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tab]);

  // Supabase Realtime — live updates
  useEffect(() => {
    if (!supabaseClient) return;
    const channel = supabaseClient
      .channel('admin_inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, payload => {
        const updated = payload.new;
        if (!updated) return;
        setSessions(prev => {
          const exists = prev.find(s => s.id === updated.id);
          // If not in current tab view, don't add it
          if (!exists) {
            // Only prepend if it belongs to current tab
            const inTab = (
              (tab === 'all'      && !updated.archived) ||
              (tab === 'active'   && updated.admin_active && !updated.archived) ||
              (tab === 'archived' && updated.archived)
            );
            if (!inTab) return prev;
            return [updated, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          }
          // If session no longer belongs to this tab, remove it
          const stillInTab = (
            (tab === 'all'      && !updated.archived) ||
            (tab === 'active'   && updated.admin_active && !updated.archived) ||
            (tab === 'archived' && updated.archived)
          );
          if (!stillInTab) {
            if (selected?.id === updated.id) setSelected(null);
            return prev.filter(s => s.id !== updated.id);
          }
          return prev.map(s => s.id === updated.id ? updated : s)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
        setSelected(prev => prev?.id === updated.id ? { ...prev, ...updated } : prev);
      })
      .subscribe();
    return () => supabaseClient.removeChannel(channel);
  }, [tab]);

  // Client-side search filter
  const filtered = sessions.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.contact_name  || '').toLowerCase().includes(q) ||
      (s.contact_phone || '').includes(q) ||
      firstUserMsg(s.messages).toLowerCase().includes(q)
    );
  });

  // ── Optimistic helpers ──────────────────────────────────────────────────────
  function patchSession(sessionId, patch) {
    setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, ...patch } : s));
    setSelected(prev => prev?.session_id === sessionId ? { ...prev, ...patch } : prev);
  }

  async function handleTakeover(sessionId) {
    patchSession(sessionId, { admin_active: true, admin_name: 'Admin' });
    await fetch('/api/admin/chats/takeover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'takeover', adminName: 'Admin' }),
    });
  }

  async function handleRelease(sessionId) {
    patchSession(sessionId, { admin_active: false, admin_name: null });
    await fetch('/api/admin/chats/takeover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'release' }),
    });
  }

  async function handleArchive(sessionId, action) {
    const isArchiving = action === 'archive';
    patchSession(sessionId, { archived: isArchiving });
    if (isArchiving && selected?.session_id === sessionId) setSelected(null);
    await fetch('/api/admin/chats/takeover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action }),
    });
  }

  async function handleSendAdminMessage(sessionId, content) {
    if (!content.trim()) return;
    setSending(true);
    setAdminInput('');
    const newMsg = { role: 'admin', content: content.trim(), timestamp: new Date().toISOString() };
    patchSession(sessionId, { messages: [...(selected?.messages || []), newMsg] });
    await fetch('/api/admin/chats/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, content: content.trim() }),
    });
    setSending(false);
  }

  function selectSession(s) {
    setSelected(s);
    setAdminInput('');
    if (isMobile) setMobileView('thread');
  }

  const detailProps = {
    adminInput, setAdminInput, sending,
    onTakeover: handleTakeover,
    onRelease:  handleRelease,
    onArchive:  handleArchive,
    onSendAdminMessage: handleSendAdminMessage,
  };

  // ── Mobile layout ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <AdminLayout title="Support Inbox">
        <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          {mobileView === 'list' || !selected ? (
            <SessionList
              sessions={filtered} selected={selected} onSelect={selectSession}
              tab={tab} onTabChange={t => { setTab(t); setSelected(null); }}
              search={search} onSearch={setSearch}
            />
          ) : (
            <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{ padding:'8px 12px', borderBottom: BORDER, background:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                <button onClick={() => setMobileView('list')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color: BROWN }}>←</button>
                <span style={{ fontWeight:700, fontSize:'.88rem', color: BROWN }}>{selected.contact_name || 'Anonymous'}</span>
              </div>
              <div style={{ flex:1, overflow:'hidden' }}>
                <ChatThread session={selected} {...detailProps} />
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    );
  }

  // ── Desktop layout ──────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Support Inbox">
      <div style={{ display:'flex', height:'calc(100vh - 120px)', borderRadius:12, overflow:'hidden', border: BORDER, boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
        {/* Left: session list */}
        <div style={{ width:260, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'12px 14px', borderBottom: BORDER, background:'#fff' }}>
            <div style={{ fontWeight:800, fontSize:'.95rem', color: BROWN }}>Support Inbox</div>
            {!loading && <div style={{ fontSize:'.7rem', color:'#aaa', marginTop:1 }}>{filtered.length} conversation{filtered.length !== 1 ? 's' : ''}</div>}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <SessionList
              sessions={filtered} selected={selected} onSelect={selectSession}
              tab={tab} onTabChange={t => { setTab(t); setSelected(null); }}
              search={search} onSearch={setSearch}
            />
          </div>
        </div>

        {/* Center: chat thread */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {loading ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb', fontSize:'.85rem' }}>
              Loading…
            </div>
          ) : !selected ? (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#ccc', gap:8 }}>
              <div style={{ fontSize:'2rem' }}>💬</div>
              <div style={{ fontSize:'.88rem' }}>Select a conversation to get started</div>
            </div>
          ) : (
            <ChatThread session={selected} {...detailProps} />
          )}
        </div>

        {/* Right: customer info */}
        {selected && (
          <InfoPanel session={selected} onArchive={handleArchive} onRelease={handleRelease} />
        )}
      </div>
    </AdminLayout>
  );
}
