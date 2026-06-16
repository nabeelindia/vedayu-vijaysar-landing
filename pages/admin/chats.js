import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

const BROWN = '#5C3D1E';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : '—';

const LOCALE_FLAG = { en: '🇬🇧', hi: '🇮🇳', ta: '🇮🇳', te: '🇮🇳' };
const LOCALE_LABEL = { en: 'EN', hi: 'HI', ta: 'TA', te: 'TE' };

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
        const preview = firstUserMessage(s.messages);
        return (
          <div key={s.id} onClick={() => onSelect(s)}
            style={{
              background: isSelected ? BROWN : '#fff',
              color: isSelected ? '#fff' : '#1a1a1a',
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,.07)', userSelect: 'none',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: '.78rem', opacity: .7 }}>
                {LOCALE_FLAG[s.locale] || '🌐'} {LOCALE_LABEL[s.locale] || s.locale?.toUpperCase()}
              </span>
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
                color: isSelected ? '#fff' : '#2e7d32',
                fontSize: '.65rem', fontWeight: 700,
                padding: '2px 8px', borderRadius: 20, display: 'inline-block',
              }}>📞 {s.contact_name}</span>
            ) : (
              <span style={{
                background: isSelected ? 'rgba(255,255,255,.15)' : '#f0ede8',
                color: isSelected ? 'rgba(255,255,255,.7)' : '#aaa',
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

function SessionDetail({ session, onBack, isMobile }) {
  const messages = Array.isArray(session.messages) ? session.messages : [];

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
        display: 'flex', alignItems: 'center', gap: 10,
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
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '80%',
                background: isUser ? BROWN : '#f5f0e8',
                color: isUser ? '#fff' : '#1a1a1a',
                padding: '8px 12px', borderRadius: 10,
                fontSize: '.84rem', lineHeight: 1.45,
              }}>
                {m.content || ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminChats() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'detail'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/chats')
      .then(r => r.json())
      .then(d => { setSessions(d.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const selectSession = (s) => {
    setSelected(s);
    if (isMobile) setMobileView('detail');
  };

  // Mobile: show either list or detail
  if (isMobile) {
    if (mobileView === 'detail' && selected) {
      return (
        <AdminLayout title="AI Chats">
          <PageHeader title="AI Chat Sessions" subtitle={`${sessions.length} sessions`} />
          <SessionDetail session={selected} onBack={() => setMobileView('list')} isMobile />
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
              <SessionDetail session={selected} isMobile={false} />
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
