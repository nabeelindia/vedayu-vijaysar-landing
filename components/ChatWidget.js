import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  if (!text) return '';
  // Sanitize: strip script/iframe tags and on* event attributes
  let s = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '');

  // Process lists line-by-line
  const lines = s.split('\n');
  const out = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    if (/^- (.+)/.test(line)) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      if (inOl)  { out.push('</ol>'); inOl = false; }
      out.push(`<li>${escapeHtml(line.replace(/^- /, ''))}</li>`);
    } else if (/^\d+\. (.+)/.test(line)) {
      if (!inOl) { out.push('<ol>'); inOl = true; }
      if (inUl)  { out.push('</ul>'); inUl = false; }
      out.push(`<li>${escapeHtml(line.replace(/^\d+\. /, ''))}</li>`);
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
      out.push(escapeHtml(line));
    }
  }
  if (inUl) out.push('</ul>');
  if (inOl) out.push('</ol>');

  let result = out.join('\n');

  // Inline formatting (bold before italic to avoid double-processing)
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Line breaks (double newline = paragraph break)
  result = result.replace(/\n\n/g, '<br><br>');
  result = result.replace(/\n/g, '<br>');

  return result;
}

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
      onSuccess(name, phone);
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
  const [captureForOrderRequested, setCaptureForOrderRequested] = useState(false);
  const [captureForOrderSubmitted, setCaptureForOrderSubmitted] = useState(false);
  const [scrollToOrderIndex, setScrollToOrderIndex] = useState(null);
  const [packSelectionIndex, setPackSelectionIndex] = useState(null);
  const [selectedPackId, setSelectedPackId] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [csatShown, setCsatShown] = useState(false);
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [humanHandoffRequested, setHumanHandoffRequested] = useState(false);

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
  }, [messages, loading, contactCaptureRequested, captureForOrderRequested]);

  async function sendMessage(text) {
    if (loading || !text.trim()) return;
    const newMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);
    setContactCaptureRequested(false);
    setCaptureForOrderRequested(false);

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
      if (data.captureForOrderRequested) {
        setCaptureForOrderRequested(true);
      }
      if (data.scrollToOrderRequested) {
        setScrollToOrderIndex(updatedMessages.length);
        if (!csatShown) {
          setCsatShown(true);
        }
      }
      if (data.packSelectionRequested) {
        setPackSelectionIndex(updatedMessages.length);
      }
      if (data.humanHandoffRequested) {
        setHumanHandoffRequested(true);
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

  function handleContactSuccess(name, phone) {  // receives but ignores args
    setContactSubmitted(true);
    setContactCaptureRequested(false);
    setMessages(prev => [...prev, { role: 'assistant', content: t('chat.contact.thanks') }]);
  }

  function handleCaptureForOrderSuccess(name, phone) {
    setCaptureForOrderSubmitted(true);
    setCaptureForOrderRequested(false);
    sendMessage(`My name is ${name} and my phone is ${phone}`);
  }

  async function handleCsatRate(rating) {
    setCsatSubmitted(true);
    try {
      await fetch('/api/chat/csat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rating }),
      });
    } catch (err) {
      console.error('CSAT submit error:', err);
    }
  }

  const chips = [
    { label: t('chat.chip.track'),  message: 'Track my order' },
    { label: t('chat.chip.order'),  message: 'I want to place an order' },
    { label: t('chat.chip.return'), message: 'I want to return or replace my product' },
    { label: t('chat.chip.late'),   message: 'My delivery is late' },
    { label: t('chat.chip.faq'),    message: 'Tell me about the product' },
    { label: t('chat.chip.human'),  message: 'I want to speak to a human agent' },
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
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            <circle cx="8" cy="11" r="1.3" fill="#7C5C3E"/>
            <circle cx="12" cy="11" r="1.3" fill="#7C5C3E"/>
            <circle cx="16" cy="11" r="1.3" fill="#7C5C3E"/>
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
                    <button key={chip.label} className="chat-chip" onClick={() => sendMessage(chip.message)}>
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'chat-row-user' : 'chat-row-bot'}>
                {m.role === 'assistant' && (
                  <div className="chat-avatar-bot" aria-hidden="true">
                    <svg viewBox="0 0 40 40" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                      {/* background circle */}
                      <circle cx="20" cy="20" r="20" fill="#FDE8D8"/>
                      {/* body / kurta */}
                      <ellipse cx="20" cy="36" rx="13" ry="10" fill="#7C5C3E"/>
                      {/* neck */}
                      <rect x="17" y="26" width="6" height="5" rx="2" fill="#C8855A"/>
                      {/* face */}
                      <ellipse cx="20" cy="20" rx="9" ry="10" fill="#C8855A"/>
                      {/* hair — long sides */}
                      <ellipse cx="11" cy="20" rx="3.5" ry="8" fill="#1A0A00"/>
                      <ellipse cx="29" cy="20" rx="3.5" ry="8" fill="#1A0A00"/>
                      {/* hair top */}
                      <ellipse cx="20" cy="11" rx="9" ry="6" fill="#1A0A00"/>
                      {/* hair bun */}
                      <circle cx="20" cy="6" r="4" fill="#1A0A00"/>
                      {/* hair bun highlight / flower */}
                      <circle cx="20" cy="6" r="2" fill="#C0392B"/>
                      <circle cx="20" cy="6" r="1" fill="#F0A500"/>
                      {/* bindi */}
                      <circle cx="20" cy="17" r="1.3" fill="#C0392B"/>
                      {/* eyes */}
                      <ellipse cx="16.5" cy="20.5" rx="2" ry="1.5" fill="#1A0A00"/>
                      <ellipse cx="23.5" cy="20.5" rx="2" ry="1.5" fill="#1A0A00"/>
                      {/* eye shine */}
                      <circle cx="17.2" cy="20" r="0.5" fill="white"/>
                      <circle cx="24.2" cy="20" r="0.5" fill="white"/>
                      {/* smile */}
                      <path d="M16.5 24 Q20 27 23.5 24" stroke="#8B4513" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                      {/* earrings */}
                      <circle cx="11.5" cy="23" r="1.2" fill="#F0A500"/>
                      <circle cx="28.5" cy="23" r="1.2" fill="#F0A500"/>
                    </svg>
                  </div>
                )}
                <div className="chat-bubble-wrap">
                  <div
                    className={m.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}
                    {...(m.role === 'assistant'
                      ? { dangerouslySetInnerHTML: { __html: renderMarkdown(m.content) } }
                      : {})}
                  >
                    {m.role === 'user' ? m.content : null}
                  </div>
                  {m.role === 'assistant' && packSelectionIndex === i && (
                    <div className="chat-pack-buttons">
                      {[
                        { label: 'Pack of 1', price: '₹499', packId: 1 },
                        { label: 'Pack of 2', price: '₹899', badge: '⭐ Popular', packId: 2 },
                        { label: 'Pack of 5', price: '₹1,999', badge: '🏆 Best Value', packId: 5 },
                      ].map(pack => (
                        <button
                          key={pack.label}
                          className="chat-pack-btn"
                          onClick={() => {
                            setPackSelectionIndex(null);
                            setSelectedPackId(pack.packId);
                            sendMessage(pack.label);
                          }}
                        >
                          <span className="chat-pack-name">{pack.label}</span>
                          {pack.badge && <span className="chat-pack-badge">{pack.badge}</span>}
                          <span className="chat-pack-price">{pack.price}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' && scrollToOrderIndex === i && (
                    <button
                      className="chat-scroll-to-order"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('vedayu:selectPack', { detail: selectedPackId || 1 }));
                        setOpen(false);
                      }}
                    >
                      {t('chat.cta.scrollToOrder')}
                    </button>
                  )}
                </div>
                {m.role === 'user' && (
                  <div className="chat-avatar-user" aria-hidden="true">U</div>
                )}
              </div>
            ))}
            {humanHandoffRequested && (
              <div className="chat-msg-bot" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                {t('chat.handoff.message')}
              </div>
            )}
            {csatShown && (
              <div className="chat-csat">
                {csatSubmitted ? (
                  <span>{t('chat.csat.thanks')}</span>
                ) : (
                  <>
                    <span>{t('chat.csat.prompt')}</span>
                    <div className="chat-csat-buttons">
                      <button onClick={() => handleCsatRate('up')}>👍</button>
                      <button onClick={() => handleCsatRate('down')}>👎</button>
                    </div>
                  </>
                )}
              </div>
            )}
            {contactCaptureRequested && !contactSubmitted && (
              <ContactForm
                sessionId={sessionId}
                onSuccess={handleContactSuccess}
                thankYouText={t('chat.contact.thanks')}
              />
            )}
            {captureForOrderRequested && !captureForOrderSubmitted && (
              <ContactForm
                sessionId={sessionId}
                onSuccess={handleCaptureForOrderSuccess}
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
              disabled={loading || humanHandoffRequested}
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || humanHandoffRequested || !input.trim()}
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
