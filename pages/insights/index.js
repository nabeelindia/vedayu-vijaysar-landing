import React, { useState, useEffect } from 'react';
import Head from 'next/head';

const fmt = (n) => Number(n).toLocaleString('en-IN');
const pct = (n) => `${Number(n).toFixed(1)}%`;

function Card({ title, badge, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:'.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.8px', color:'#888' }}>{title}</h3>
        {badge && <span style={{ fontSize:'.65rem', fontWeight:700, background:'#e8f5e9', color:'#4A7C59', padding:'2px 7px', borderRadius:20 }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ textAlign:'center', flex:1 }}>
      <div style={{ fontSize:'1.8rem', fontWeight:800, color:color||'#1a1a1a', lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:'.75rem', fontWeight:600, color:'#555', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:'.7rem', color:'#aaa', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ label, count, max, color, sub }) {
  const width = max ? `${(+count / +max) * 100}%` : '0%';
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.78rem', marginBottom:3 }}>
        <span style={{ color:'#333', fontWeight:500 }}>{label}</span>
        <span style={{ color:'#888', fontWeight:600 }}>{fmt(count)}{sub ? ` · ${sub}` : ''}</span>
      </div>
      <div style={{ background:'#f0f0f0', borderRadius:4, height:7 }}>
        <div style={{ width, background:color||'#4A7C59', borderRadius:4, height:'100%', transition:'width .5s' }} />
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:'.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', color:'#aaa', margin:'24px 0 10px', paddingLeft:2 }}>{children}</div>
  );
}

function useScrollToBottom(dep) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

function WaInbox() {
  const [conversations, setConversations] = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [reply,         setReply]         = useState('');
  const [sending,       setSending]       = useState(false);
  const [sendError,     setSendError]     = useState('');

  const activeConv = conversations.find(c => c.phone === selected);
  const chatRef = useScrollToBottom(activeConv?.messages?.length);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/wa-inbox');
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || res.statusText); }
      const { conversations: convs } = await res.json();
      setConversations(convs || []);
      if (convs?.length && !selected) setSelected(convs[0].phone);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const markRead = async (phone) => {
    await fetch('/api/wa-inbox', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ phone }) });
    setConversations(prev => prev.map(c =>
      c.phone === phone ? { ...c, unread:0, messages: c.messages.map(m => ({ ...m, read_at: m.read_at || new Date().toISOString() })) } : c
    ));
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !selected || sending) return;
    setSending(true); setSendError('');
    try {
      const res = await fetch('/api/wa-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selected, message: reply.trim() }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Send failed'); }
      // Optimistically add the message to the conversation
      const newMsg = { id: Date.now(), direction:'out', message: reply.trim(), created_at: new Date().toISOString(), sent_at: new Date().toISOString() };
      setConversations(prev => prev.map(c =>
        c.phone === selected ? { ...c, messages: [...c.messages, newMsg], lastAt: newMsg.created_at } : c
      ));
      setReply('');
    } catch (e) { setSendError(e.message); }
    finally { setSending(false); }
  };

  useEffect(() => { load(); }, []);

  const fmtTime = (iso) => {
    const d = new Date(iso);
    const diffDays = Math.floor((new Date() - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  };

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading conversations...</div>;
  if (error) return (
    <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:10, padding:'20px 24px' }}>
      <p style={{ margin:0, fontWeight:700, color:'#5a3e2b' }}>WhatsApp Inbox unavailable</p>
      <p style={{ margin:'6px 0 0', color:'#888', fontSize:'.82rem' }}>{error}</p>
    </div>
  );
  if (!conversations.length) return (
    <div style={{ textAlign:'center', padding:60, color:'#aaa' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:10 }}>💬</div>
      <p style={{ margin:0, fontWeight:600 }}>No messages yet</p>
      <p style={{ margin:'6px 0 0', fontSize:'.8rem' }}>Messages from customers will appear here once they contact your WhatsApp number.</p>
    </div>
  );

  return (
    <div style={{ display:'flex', height:640, border:'1px solid #e8e8e8', borderRadius:12, overflow:'hidden', background:'#fff' }}>

      {/* ── Sidebar ── */}
      <div style={{ width:280, flexShrink:0, borderRight:'1px solid #f0f0f0', overflowY:'auto', background:'#fafafa', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f0f0f0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontWeight:800, fontSize:'.85rem', color:'#1a1a1a' }}>Conversations</span>
          <button onClick={load} style={{ background:'none', border:'none', cursor:'pointer', color:'#4A7C59', fontWeight:700, fontSize:'.9rem', padding:'2px 6px' }}>↻</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {conversations.map(c => {
            const lastMsg = c.messages[c.messages.length - 1];
            const preview = lastMsg?.direction === 'out' ? `You: ${lastMsg.message}` : (lastMsg?.message || '');
            return (
              <div key={c.phone} onClick={() => { setSelected(c.phone); if (c.unread) markRead(c.phone); }} style={{
                padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f0f0f0',
                background: selected === c.phone ? '#e8f5e9' : 'transparent', transition:'background .15s',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight: c.unread ? 800 : 600, fontSize:'.85rem', color:'#1a1a1a', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize:'.68rem', color:'#aaa', flexShrink:0 }}>{fmtTime(c.lastAt)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:3 }}>
                  <span style={{ fontSize:'.75rem', color:'#888', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{preview}</span>
                  {c.unread > 0 && <span style={{ background:'#25d366', color:'#fff', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:10, flexShrink:0 }}>{c.unread}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Chat pane ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {activeConv ? (
          <>
            {/* Header */}
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #f0f0f0', background:'#fff', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:'.9rem', color:'#1a1a1a' }}>{activeConv.name}</div>
                <div style={{ fontSize:'.72rem', color:'#888' }}>{activeConv.phone}</div>
              </div>
              <a href={`https://wa.me/${activeConv.phone}`} target="_blank" rel="noreferrer"
                style={{ fontSize:'.75rem', background:'#25d366', color:'#fff', padding:'5px 12px', borderRadius:8, fontWeight:700, textDecoration:'none' }}>
                Open in WA ↗
              </a>
            </div>

            {/* Messages */}
            <div ref={chatRef} style={{ flex:1, overflowY:'auto', padding:'16px 20px', background:'#ece5dd', display:'flex', flexDirection:'column', gap:8 }}>
              {activeConv.messages.map((msg, i) => {
                const isOut = msg.direction === 'out';
                const isBot = !isOut && msg.bot_replied;
                return (
                  <React.Fragment key={msg.id || i}>
                    {/* Inbound customer message */}
                    {!isOut && (
                      <div style={{ display:'flex', justifyContent:'flex-start' }}>
                        <div style={{ maxWidth:'72%', background:'#fff', borderRadius:'12px 12px 12px 2px', padding:'8px 12px', boxShadow:'0 1px 2px rgba(0,0,0,.08)' }}>
                          <div style={{ fontSize:'.85rem', color:'#1a1a1a', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{msg.message}</div>
                          <div style={{ fontSize:'.63rem', color:'#aaa', marginTop:3, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                        </div>
                      </div>
                    )}
                    {/* Bot auto-reply (shown after inbound if exists) */}
                    {isBot && (
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <div style={{ maxWidth:'72%', background:'#d9f7be', borderRadius:'12px 12px 2px 12px', padding:'8px 12px', boxShadow:'0 1px 2px rgba(0,0,0,.08)' }}>
                          <div style={{ fontSize:'.63rem', color:'#888', marginBottom:3, fontWeight:600 }}>🤖 Bot</div>
                          <div style={{ fontSize:'.85rem', color:'#1a1a1a', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{msg.bot_replied}</div>
                          <div style={{ fontSize:'.63rem', color:'#888', marginTop:3, textAlign:'right' }}>✓✓</div>
                        </div>
                      </div>
                    )}
                    {/* Outbound human reply */}
                    {isOut && (
                      <div style={{ display:'flex', justifyContent:'flex-end' }}>
                        <div style={{ maxWidth:'72%', background:'#dcf8c6', borderRadius:'12px 12px 2px 12px', padding:'8px 12px', boxShadow:'0 1px 2px rgba(0,0,0,.08)' }}>
                          <div style={{ fontSize:'.63rem', color:'#4A7C59', marginBottom:3, fontWeight:700 }}>You</div>
                          <div style={{ fontSize:'.85rem', color:'#1a1a1a', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{msg.message}</div>
                          <div style={{ fontSize:'.63rem', color:'#888', marginTop:3, textAlign:'right' }}>{fmtTime(msg.created_at)} ✓✓</div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Reply input */}
            <form onSubmit={sendReply} style={{ padding:'12px 16px', borderTop:'1px solid #f0f0f0', background:'#f8f8f8', display:'flex', gap:8, alignItems:'flex-end', flexShrink:0 }}>
              <div style={{ flex:1 }}>
                <textarea
                  value={reply}
                  onChange={e => { setReply(e.target.value); setSendError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(e); } }}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  style={{
                    width:'100%', boxSizing:'border-box', resize:'none',
                    border:`1.5px solid ${sendError ? '#e57373' : '#e0e0e0'}`,
                    borderRadius:10, padding:'9px 12px', fontSize:'.85rem',
                    fontFamily:'system-ui,sans-serif', outline:'none', lineHeight:1.5,
                  }}
                />
                {sendError && <div style={{ fontSize:'.72rem', color:'#c62828', marginTop:3 }}>{sendError}</div>}
              </div>
              <button type="submit" disabled={!reply.trim() || sending} style={{
                background: !reply.trim() || sending ? '#a5c4ae' : '#4A7C59',
                color:'#fff', border:'none', borderRadius:10,
                padding:'10px 18px', fontWeight:700, fontSize:'.85rem',
                cursor: !reply.trim() || sending ? 'not-allowed' : 'pointer',
                flexShrink:0, height:40,
              }}>
                {sending ? '…' : 'Send ↑'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:'2rem' }}>💬</div>
            <div>Select a conversation</div>
          </div>
        )}
      </div>

    </div>
  );
}

export default function Insights() {
  const [clarity,    setClarity]    = useState(null);
  const [ga,         setGa]         = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastUpdated,setLastUpdated]= useState(null);
  const [tab,        setTab]        = useState('ga'); // 'ga' | 'clarity' | 'wa'

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cRes, gRes] = await Promise.all([
        fetch('/api/clarity-insights'),
        fetch('/api/ga-insights'),
      ]);
      if (cRes.ok) setClarity(await cRes.json());
      if (gRes.ok) setGa(await gRes.json());
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Clarity
  const traffic    = clarity?.Traffic?.[0] || {};
  const engagement = clarity?.EngagementTime?.[0] || {};
  const scroll     = clarity?.ScrollDepth?.[0] || {};
  const browsers   = clarity?.Browser || [];
  const devices    = clarity?.Device || [];
  const os         = clarity?.OS || [];
  const countries  = clarity?.Country || [];
  const pages      = clarity?.PopularPages || [];
  const referrers  = clarity?.ReferrerUrl || [];
  const deadClick  = clarity?.DeadClickCount?.[0] || {};
  const rageClick  = clarity?.RageClickCount?.[0] || {};
  const quickBack  = clarity?.QuickbackClick?.[0] || {};
  const exScroll   = clarity?.ExcessiveScroll?.[0] || {};
  const maxBrowser = Math.max(...browsers.map(b => +b.sessionsCount), 1);
  const maxDevice  = Math.max(...devices.map(d => +d.sessionsCount), 1);
  const maxPage    = Math.max(...pages.map(p => +p.visitsCount), 1);
  const maxRef     = Math.max(...referrers.map(r => +r.sessionsCount), 1);

  // GA
  const ov       = ga?.overview || {};
  const topPages = ga?.topPages || [];
  const channels = ga?.channels || [];
  const gaDevices= ga?.devices  || [];
  const gaCountries = ga?.countries || [];
  const maxCh    = Math.max(...channels.map(c => +c.sessions), 1);
  const maxTP    = Math.max(...topPages.map(p => +p.views), 1);
  const maxGADev = Math.max(...gaDevices.map(d => +d.sessions), 1);
  const maxGACo  = Math.max(...gaCountries.map(c => +c.sessions), 1);

  const btnStyle = (active) => ({
    padding:'8px 18px', borderRadius:8, border:'none', fontWeight:700, fontSize:'.82rem', cursor:'pointer',
    background: active ? '#4A7C59' : '#e8e8e8',
    color: active ? '#fff' : '#555',
  });

  return (
    <>
      <Head>
        <title>Insights — Vedayu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{ minHeight:'100vh', background:'#f5f5f5', fontFamily:'system-ui,sans-serif', padding:'32px 16px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:20 }}>
            <div>
              <h1 style={{ margin:0, fontSize:'1.5rem', fontWeight:800, color:'#1a1a1a' }}>📊 Vedayu Insights</h1>
              <p style={{ margin:'4px 0 0', color:'#888', fontSize:'.8rem' }}>
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN')}` : 'Loading...'}
              </p>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <button style={btnStyle(tab==='ga')}      onClick={() => setTab('ga')}>Google Analytics</button>
              <button style={btnStyle(tab==='clarity')} onClick={() => setTab('clarity')}>Clarity</button>
              <button style={btnStyle(tab==='wa')}      onClick={() => setTab('wa')}>💬 WhatsApp</button>
              <button onClick={load} disabled={loading} style={{ background:'#4A7C59', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:'.82rem', fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?.6:1 }}>
                {loading ? '⟳' : '⟳ Refresh'}
              </button>
              <a href="/api/insights-auth?logout=1" style={{ padding:'8px 14px', borderRadius:8, border:'none', fontWeight:700, fontSize:'.82rem', cursor:'pointer', background:'#f0f0f0', color:'#888', textDecoration:'none' }}>
                Logout
              </a>
            </div>
          </div>

          {error && tab !== 'wa' && <div style={{ background:'#fee', border:'1px solid #fcc', borderRadius:8, padding:'12px 16px', color:'#c00', marginBottom:20 }}>Error: {error}</div>}
          {loading && !ga && !clarity && tab !== 'wa' && <div style={{ textAlign:'center', padding:80, color:'#888' }}>Loading insights...</div>}

          {/* ── GOOGLE ANALYTICS TAB ── */}
          {tab === 'ga' && ga && (
            <div style={{ display:'grid', gap:16 }}>

              <Card title="Last 30 Days — Overview" badge="Google Analytics">
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <Stat label="Sessions"       value={fmt(ov.sessions)}           color="#1a1a1a" />
                  <Stat label="Active Users"   value={fmt(ov.activeUsers)}        color="#4A7C59" />
                  <Stat label="New Users"      value={fmt(ov.newUsers)}           color="#7c4a7c" />
                  <Stat label="Conversions"    value={fmt(ov.conversions)}        color="#e07b39" />
                  <Stat label="Revenue"        value={`₹${fmt(ov.revenue)}`}      color="#4A7C59" />
                </div>
              </Card>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Card title="Engagement">
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <Stat label="Bounce Rate"       value={pct(ov.bounceRate)}          color={+ov.bounceRate > 70 ? '#c00' : '#4A7C59'} />
                    <Stat label="Avg Session"       value={ov.avgSessionDuration}       />
                    <Stat label="Pages/Session"     value={ov.pagesPerSession}          />
                  </div>
                </Card>
                <Card title="Traffic Channels">
                  {channels.map(c => <Bar key={c.channel} label={c.channel} count={c.sessions} max={maxCh} color="#4A7C59" sub={`${c.conversions} conv`} />)}
                </Card>
              </div>

              <Card title="Top Pages">
                {topPages.map(p => <Bar key={p.page} label={p.page||'/'} count={p.views} max={maxTP} color="#7c4a7c" sub={`${p.bounceRate}% bounce`} />)}
              </Card>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Card title="Devices">
                  {gaDevices.map(d => <Bar key={d.device} label={d.device} count={d.sessions} max={maxGADev} color="#4A7C59" sub={`${d.bounceRate}% bounce`} />)}
                </Card>
                <Card title="Countries">
                  {gaCountries.map(c => <Bar key={c.country} label={c.country} count={c.sessions} max={maxGACo} color="#e07b39" />)}
                </Card>
              </div>

            </div>
          )}

          {/* ── WHATSAPP INBOX TAB ── */}
          {tab === 'wa' && <WaInbox />}

          {/* ── CLARITY TAB ── */}
          {tab === 'clarity' && clarity && (
            <div style={{ display:'grid', gap:16 }}>

              <Card title="Traffic Overview" badge="Clarity">
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <Stat label="Sessions"       value={fmt(traffic.totalSessionCount||0)} />
                  <Stat label="Unique Users"   value={fmt(traffic.distinctUserCount||0)}    color="#4A7C59" />
                  <Stat label="Bot Sessions"   value={fmt(traffic.totalBotSessionCount||0)} color="#e07b39" />
                  <Stat label="Pages/Session"  value={(+(traffic.pagesPerSessionPercentage||0)).toFixed(2)} />
                </div>
              </Card>

              <Card title="Engagement">
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <Stat label="Total Time (min)"  value={fmt(engagement.totalTime||0)} />
                  <Stat label="Active Time (min)" value={fmt(engagement.activeTime||0)} color="#4A7C59" />
                  <Stat label="Avg Scroll Depth"  value={pct(scroll.averageScrollDepth||0)} color="#7c4a7c" />
                </div>
              </Card>

              <Card title="UX Signals">
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <Stat label="Dead Clicks"  value={pct(deadClick.sessionsWithMetricPercentage||0)} sub={`${deadClick.subTotal||0} clicks`}  color={+(deadClick.sessionsWithMetricPercentage||0)>20?'#c00':'#e07b39'} />
                  <Stat label="Rage Clicks"  value={pct(rageClick.sessionsWithMetricPercentage||0)} sub={`${rageClick.subTotal||0} clicks`}  color={+(rageClick.sessionsWithMetricPercentage||0)>5?'#c00':'#4A7C59'} />
                  <Stat label="Quick Backs"  value={pct(quickBack.sessionsWithMetricPercentage||0)} sub={`${quickBack.subTotal||0} events`}  color={+(quickBack.sessionsWithMetricPercentage||0)>15?'#c00':'#e07b39'} />
                  <Stat label="Excess Scroll" value={pct(exScroll.sessionsWithMetricPercentage||0)} sub={`${exScroll.subTotal||0} events`}  color="#888" />
                </div>
              </Card>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Card title="Devices">
                  {devices.map(d => <Bar key={d.name} label={d.name} count={+d.sessionsCount} max={maxDevice} color="#4A7C59" />)}
                </Card>
                <Card title="Browsers">
                  {browsers.map(b => <Bar key={b.name} label={b.name} count={+b.sessionsCount} max={maxBrowser} color="#7c4a7c" />)}
                </Card>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <Card title="OS">
                  {os.map(o => <Bar key={o.name} label={o.name} count={+o.sessionsCount} max={Math.max(...os.map(x=>+x.sessionsCount),1)} color="#e07b39" />)}
                </Card>
                <Card title="Countries">
                  {countries.map(c => <Bar key={c.name} label={c.name} count={+c.sessionsCount} max={Math.max(...countries.map(x=>+x.sessionsCount),1)} color="#4A7C59" />)}
                </Card>
              </div>

              <Card title="Popular Pages">
                {pages.map(p => <Bar key={p.url} label={p.url.replace(/https?:\/\/(www\.)?vedayulife\.com/,'')||'/'} count={+p.visitsCount} max={maxPage} color="#4A7C59" />)}
              </Card>

              <Card title="Traffic Sources">
                {referrers.map((r,i) => <Bar key={i} label={r.name||'Direct'} count={+r.sessionsCount} max={maxRef} color="#7c4a7c" />)}
              </Card>

            </div>
          )}

        </div>
      </div>
    </>
  );
}
