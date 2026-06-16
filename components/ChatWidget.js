import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

function ContactForm({ sessionId, onSuccess, thankYouText }) {
  const { t } = useTranslation('common');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/chat/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name, phone }),
      });
      if (!res.ok) throw new Error('Failed');
      onSuccess();
    } catch (err) {
      console.error('Contact form error:', err);
      setError('Could not submit. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form className="chat-contact-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder={t('chat.contact.name')}
        value={name}
        onChange={e => setName(e.target.value)}
        required
        disabled={submitting}
      />
      <input
        type="tel"
        placeholder={t('chat.contact.phone')}
        value={phone}
        onChange={e => setPhone(e.target.value)}
        required
        disabled={submitting}
      />
      {error && <div style={{ color: '#c0392b', fontSize: '0.8rem' }}>{error}</div>}
      <button type="submit" disabled={submitting || !name.trim() || !phone.trim()}>
        {submitting ? '…' : t('chat.contact.submit')}
      </button>
    </form>
  );
}

export default function ChatWidget() {
  const { locale } = useRouter();
  const { t } = useTranslation('common');

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactCaptureRequested, setContactCaptureRequested] = useState(false);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [sessionId, setSessionId] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const existing = sessionStorage.getItem('chat_session_id');
    const id = existing || crypto.randomUUID();
    if (!existing) sessionStorage.setItem('chat_session_id', id);
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, contactCaptureRequested]);

  async function sendMessage(text) {
    if (loading || !text.trim()) return;
    const newMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setContactCaptureRequested(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages, locale, sessionId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.contactCaptureRequested) {
        setContactCaptureRequested(true);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: t('chat.error') },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleContactSuccess() {
    setContactSubmitted(true);
    setContactCaptureRequested(false);
    setMessages(prev => [...prev, { role: 'assistant', content: t('chat.contact.thanks') }]);
  }

  const chips = [
    t('chat.chip.track'),
    t('chat.chip.return'),
    t('chat.chip.faq'),
    t('chat.chip.order'),
  ];

  return (
    <>
      {/* Floating button */}
      <button
        className="chat-bubble"
        onClick={() => setOpen(o => !o)}
        aria-label={t('chat.title')}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <span>🌿</span>
            <span className="chat-header-title">{t('chat.title')}</span>
            <button className="chat-header-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && !loading && (
              <div>
                <div className="chat-msg-bot">👋 Hi! How can I help you today? 🌿</div>
                <div className="chat-chips">
                  {chips.map(chip => (
                    <button key={chip} className="chat-chip" onClick={() => sendMessage(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}>
                {m.content}
              </div>
            ))}
            {contactCaptureRequested && !contactSubmitted && (
              <ContactForm
                sessionId={sessionId}
                onSuccess={handleContactSuccess}
                thankYouText={t('chat.contact.thanks')}
              />
            )}
            {loading && (
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input row */}
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              rows={1}
              placeholder={t('chat.placeholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
