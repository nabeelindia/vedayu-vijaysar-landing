import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';
import { supabaseClient } from '../../lib/supabaseClient';

const BROWN = '#5C3D1E';
const BLUE  = '#1565c0';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';

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

const LOCALE_FLAG  = { en: '🇬🇧', hi: '🇮🇳', ta: '🇮🇳', te: '🇮🇳' };
const LOCALE_LABEL = { en: 'EN',   hi: 'HI',  ta: 'TA',  te: 'TE'  };

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

function firstUserMessage(messages) {
  if (!Array.isArray(messages)) return '';
  const msg = messages.find(m => m.role === 'user');
  return msg ? (msg.content || '').slice(0, 60) : '';
}

function SessionList({ sessions, selected, onSelect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {sessions.length === 0 && (
        <p style={{ color: '#aaa', fontSize: '.82rem', padding: 8 }}>No chat sessions yet.</p>
      )}
      {sessions.map(s => {
        const isSelected = selected?.id === s.id;
        const preview    = firstUserMessage(s.messages);
        return (
          <div key={s.id} onClick={() => onSelect(s)}
            style={{
              background:  isSelected ? BROWN : '#fff',
              color:       isSelected ? '#fff' : '#1a1a1a',
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.07)', userSelect: 'none',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: '.78rem', opacity: .7 }}>
                {LOCALE_FLAG[s.locale] || '🌐'} {LOCALE_LABEL[s.locale] || s.locale?.toUpperCase()}
              </span>
              {s.admin_active && (
                <span style={{
                  background: BLUE, color: '#fff',
                  fontSize: '.6rem', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 20,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%',
                    display: 'inline-block', animation: 'livePulse 1.5s infinite' }} />
                  LIVE
                </span>
              )}
              <span style={{ fontSize: '.72rem', opacity: .6, marginLeft: 'auto' }}>{fmtD(s.created_at)}</span>
            </div>
            <div style={{
              fontSize: '.82rem', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5,
            }}>
              {preview || <span style={{ opacity: .45 }}>(no messages)</span>}
            </div>
            {s.contact_name ? (
              <span style={{
                background: isSelected ? 'rgba(255,255,255,.22)' : '#e6f4ea',
                color:      isSelected ? '#fff' : '#2e7d32',
                fontSize: '.65rem', fontWeight: 700,
                padding: '2px 8px', borderRadius: 20, display: 'inline-block',
              }}>📞 {s.contact_name}</span>
            ) : (
              <span style={{
                background: isSelected ? 'rgba(255,255,255,.15)' : '#f0ede8',
                color:      isSelected ? 'rgba(255,255,255,.7)' : '#aaa',
                fontSize: '.65rem', fontWeight: 600,
                padding: '2px 8px', borderRadius: 20, display: 'inline-block',
              }}>No contact</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SessionDetail({
  session, onBack, isMobile,
  adminInput, setAdminInput, sending,
  onTakeover, onRelease, onSendAdminMessage,
}) {
  const messages    = Array.isArray(session.messages) ? session.messages : [];
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', background: '#fff',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)',
      height: isMobile ? 'calc(100vh - 200px)' : '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #f0ede8',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        {isMobile && (
          <button onClick={onBack}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px 4px 0', fontSize: '1.1rem',
              color: BROWN, lineHeight: 1, flexShrink: 0,
            }}>
            ←
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: BROWN }}>
            Session — {LOCALE_LABEL[session.locale] || session.locale} — {fmtD(session.created_at)}
          </div>
          {session.contact_name && (
            <div style={{ fontSize: '.75rem', color: '#555', marginTop: 3 }}>
              📞 {session.contact_name}{session.contact_phone ? ` · ${session.contact_phone}` : ''}
            </div>
          )}
          {/* Takeover controls */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!session.admin_active ? (
              <button
                onClick={() => onTakeover(session.session_id)}
                style={{
                  background: BLUE, color: '#fff', border: 'none',
                  borderRadius: 6, padding: '5px 14px', fontSize: '.78rem',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                Take Over
              </button>
            ) : (
              <>
                <span style={{
                  background: '#e3f2fd', color: BLUE,
                  fontSize: '.75rem', fontWeight: 700,
                  padding: '4px 10px', borderRadius: 6,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 7, height: 7, background: BLUE, borderRadius: '50%',
                    display: 'inline-block', animation: 'livePulse 1.5s infinite' }} />
                  Admin Active{session.admin_name ? ` — ${session.admin_name}` : ''}
                </span>
                <button
                  onClick={() => onRelease(session.session_id)}
                  style={{
                    background: '#fff', color: '#c62828', border: '1.5px solid #c62828',
                    borderRadius: 6, padding: '4px 12px', fontSize: '.78rem',
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Release to AI
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages thread */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 12,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#ccc', fontSize: '.85rem', textAlign: 'center', marginTop: 20 }}>
            No messages in this session.
          </p>
        )}
        {(() => {
          let lastDate = null;
          return messages.map((m, i) => {
            const isUser  = m.role === 'user';
            const isAdmin = m.role === 'admin';
            const ts      = fmtTime(m.timestamp || m.created_at);
            const dateKey = msgDateKey(m.timestamp || m.created_at);
            const showSep = dateKey && dateKey !== lastDate;
            if (showSep) lastDate = dateKey;
            return (
              <div key={i}>
                {showSep && (
                  <div style={{ textAlign: 'center', margin: '8px 0' }}>
                    <span style={{ fontSize: '.68rem', color: '#aaa', background: '#f5f0e8',
                      padding: '2px 10px', borderRadius: 20 }}>
                      {dateSeparatorLabel(m.timestamp || m.created_at)}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  {isAdmin && (
                    <span style={{ fontSize: '.65rem', color: BLUE, fontWeight: 600, marginBottom: 2 }}>
                      Support Agent
                    </span>
                  )}
                  <div style={{
                    maxWidth: '80%',
                    background: isUser ? BROWN : (isAdmin ? BLUE : '#f5f0e8'),
                    color: (isUser || isAdmin) ? '#fff' : '#1a1a1a',
                    padding: '8px 12px', borderRadius: 10,
                    fontSize: '.84rem', lineHeight: 1.45,
                  }}>
                    {m.content || ''}
                  </div>
                  {ts && (
                    <span style={{ fontSize: '.62rem', color: '#aaa', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
                      {ts}
                    </span>
                  )}
                </div>
              </div>
            );
          });
        })()}
        <div ref={messagesEnd} />
      </div>

      {/* Admin input bar — only shown when admin has taken over */}
      {session.admin_active && (
        <div style={{
          padding: '10px 12px', borderTop: '1px solid #e3f2fd',
          background: '#f0f7ff', display: 'flex', gap: 8,
        }}>
          <textarea
            rows={2}
            placeholder="Type a message to the customer…"
            value={adminInput}
            onChange={e => setAdminInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendAdminMessage(session.session_id, adminInput);
              }
            }}
            style={{
              flex: 1, resize: 'none', borderRadius: 6,
              border: '1.5px solid #90caf9', padding: '8px 10px',
              fontSize: '.84rem', fontFamily: 'inherit', outline: 'none',
            }}
            disabled={sending}
          />
          <button
            onClick={() => onSendAdminMessage(session.session_id, adminInput)}
            disabled={sending || !adminInput.trim()}
            style={{
              background: BLUE, color: '#fff', border: 'none',
              borderRadius: 6, padding: '0 16px', fontWeight: 700,
              cursor: adminInput.trim() ? 'pointer' : 'default',
              fontSize: '.84rem', alignSelf: 'stretch',
              opacity: adminInput.trim() ? 1 : 0.5,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminChats() {
  const isMobile   = useIsMobile();
  const [sessions, setSessions]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [mobileView, setMobileView]   = useState('list');
  const [loading, setLoading]         = useState(true);
  const [adminInput, setAdminInput]   = useState('');
  const [sending, setSending]         = useState(false);

  // Initial fetch
  useEffect(() => {
    fetch('/api/admin/chats')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Supabase Realtime subscription — live updates for all sessions
  useEffect(() => {
    if (!supabaseClient) return;

    const channel = supabaseClient
      .channel('admin_chat_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, payload => {
        const updated = payload.new;
        if (!updated) return;
        setSessions(prev => {
          const exists = prev.find(s => s.id === updated.id);
          const next   = exists
            ? prev.map(s => s.id === updated.id ? updated : s)
            : [updated, ...prev];
          return next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
        setSelected(prev => prev?.id === updated.id ? updated : prev);
      })
      .subscribe();

    return () => supabaseClient.removeChannel(channel);
  }, []);

  const selectSession = (s) => {
    setSelected(s);
    setAdminInput('');
    if (isMobile) setMobileView('detail');
  };

  async function handleTakeover(sessionId) {
    await fetch('/api/admin/chats/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'takeover', adminName: 'Admin' }),
    });
  }

  async function handleRelease(sessionId) {
    await fetch('/api/admin/chats/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'release' }),
    });
  }

  async function handleSendAdminMessage(sessionId, content) {
    if (!content.trim()) return;
    setSending(true);
    setAdminInput('');
    await fetch('/api/admin/chats/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, content: content.trim() }),
    });
    setSending(false);
    // Realtime updates the selected session's messages automatically
  }

  const detailProps = {
    adminInput, setAdminInput, sending,
    onTakeover: handleTakeover,
    onRelease:  handleRelease,
    onSendAdminMessage: handleSendAdminMessage,
  };

  // Mobile: show either list or detail
  if (isMobile) {
    if (mobileView === 'detail' && selected) {
      return (
        <AdminLayout title="AI Chats">
          <PageHeader title="AI Chat Sessions" subtitle={`${sessions.length} sessions`} />
          <SessionDetail session={selected} onBack={() => setMobileView('list')} isMobile {...detailProps} />
        </AdminLayout>
      );
    }
    return (
      <AdminLayout title="AI Chats">
        <PageHeader title="AI Chat Sessions" subtitle={`${sessions.length} sessions`} />
        {loading ? (
          <p style={{ padding: 24, color: '#888' }}>Loading...</p>
        ) : (
          <SessionList sessions={sessions} selected={selected} onSelect={selectSession} />
        )}
      </AdminLayout>
    );
  }

  // Desktop: 2-column layout
  return (
    <AdminLayout title="AI Chats">
      <PageHeader title="AI Chat Sessions" subtitle={`${sessions.length} sessions`} />
      {loading ? (
        <p style={{ padding: 24, color: '#888' }}>Loading...</p>
      ) : (
        <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 160px)', minHeight: 400 }}>
          <div style={{ flex: '0 0 300px', overflowY: 'auto' }}>
            <SessionList sessions={sessions} selected={selected} onSelect={selectSession} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {!selected ? (
              <div style={{
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', borderRadius: 12, color: '#ccc', fontSize: '.9rem',
                boxShadow: '0 1px 3px rgba(0,0,0,.07)',
              }}>
                Select a session to view the conversation
              </div>
            ) : (
              <SessionDetail session={selected} isMobile={false} {...detailProps} />
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
