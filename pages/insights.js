import { useState, useEffect } from 'react';
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

function WaInbox() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wa-inbox');
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || res.statusText); }
      const { conversations } = await res.json();
      setConversations(conversations || []);
      if (conversations?.length && !selected) setSelected(conversations[0].phone);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (phone) => {
    await fetch('/api/wa-inbox', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    setConversations(prev => prev.map(c =>
      c.phone === phone ? { ...c, unread: 0, messages: c.messages.map(m => ({ ...m, read_at: m.read_at || new Date().toISOString() })) } : c
    ));
  };

  useEffect(() => { load(); }, []);

  const activeConv = conversations.find(c => c.phone === selected);

  const fmtTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading conversations...</div>;
  if (error) return (
    <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:10, padding:'20px 24px' }}>
      <p style={{ margin:0, fontWeight:700, color:'#5a3e2b' }}>WhatsApp Inbox unavailable</p>
      <p style={{ margin:'6px 0 0', color:'#888', fontSize:'.82rem' }}>{error}</p>
      <p style={{ margin:'10px 0 0', color:'#888', fontSize:'.78rem' }}>
        Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_KEY</code> in your environment variables and run the migration in <code>supabase/migrations/001_wa_inbox.sql</code>.
      </p>
    </div>
  );
  if (!conversations.length) return (
    <div style={{ textAlign:'center', padding:60, color:'#aaa' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:10 }}>💬</div>
      <p style={{ margin:0, fontWeight:600 }}>No messages yet</p>
      <p style={{ margin:'6px 0 0', fontSize:'.8rem' }}>Messages from customers will appear here once they message your WhatsApp number.</p>
    </div>
  );

  return (
    <div style={{ display:'flex', height:600, border:'1px solid #e8e8e8', borderRadius:12, overflow:'hidden', background:'#fff' }}>

      {/* Sidebar */}
      <div style={{ width:280, flexShrink:0, borderRight:'1px solid #f0f0f0', overflowY:'auto', background:'#fafafa' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f0f0f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontWeight:800, fontSize:'.85rem', color:'#1a1a1a' }}>Conversations</span>
          <button onClick={load} style={{ background:'none', border:'none', cursor:'pointer', color:'#4A7C59', fontWeight:700, fontSize:'.8rem', padding:'2px 6px' }}>↻</button>
        </div>
        {conversations.map(c => (
          <div
            key={c.phone}
            onClick={() => { setSelected(c.phone); if (c.unread) markRead(c.phone); }}
            style={{
              padding:'12px 16px', cursor:'pointer', borderBottom:'1px solid #f0f0f0',
              background: selected === c.phone ? '#e8f5e9' : 'transparent',
              transition:'background .15s',
            }}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight: c.unread ? 800 : 600, fontSize:'.85rem', color:'#1a1a1a', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {c.name}
              </span>
              <span style={{ fontSize:'.68rem', color:'#aaa', flexShrink:0 }}>{fmtTime(c.lastAt)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:3 }}>
              <span style={{ fontSize:'.75rem', color:'#888', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {c.messages[0]?.message}
              </span>
              {c.unread > 0 && (
                <span style={{ background:'#25d366', color:'#fff', fontSize:'.65rem', fontWeight:800, padding:'1px 6px', borderRadius:10, flexShrink:0 }}>
                  {c.unread}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Chat pane */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {activeConv ? (
          <>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #f0f0f0', background:'#fff' }}>
              <div style={{ fontWeight:800, fontSize:'.9rem', color:'#1a1a1a' }}>{activeConv.name}</div>
              <div style={{ fontSize:'.75rem', color:'#888' }}>{activeConv.phone}</div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', background:'#f0f0f0', display:'flex', flexDirection:'column', gap:10 }}>
              {[...activeConv.messages].reverse().map(msg => (
                <div key={msg.id}>
                  {/* Customer message */}
                  <div style={{ display:'flex', justifyContent:'flex-start', marginBottom:4 }}>
                    <div style={{ maxWidth:'72%', background:'#fff', borderRadius:'12px 12px 12px 2px', padding:'8px 12px', boxShadow:'0 1px 2px rgba(0,0,0,.08)' }}>
                      <div style={{ fontSize:'.85rem', color:'#1a1a1a', lineHeight:1.5 }}>{msg.message}</div>
                      <div style={{ fontSize:'.65rem', color:'#aaa', marginTop:3, textAlign:'right' }}>{fmtTime(msg.created_at)}</div>
                    </div>
                  </div>
                  {/* Bot reply */}
                  {msg.bot_replied && (
                    <div style={{ display:'flex', justifyContent:'flex-end' }}>
                      <div style={{ maxWidth:'72%', background:'#dcf8c6', borderRadius:'12px 12px 2px 12px', padding:'8px 12px', boxShadow:'0 1px 2px rgba(0,0,0,.08)' }}>
                        <div style={{ fontSize:'.85rem', color:'#1a1a1a', lineHeight:1.5 }}>{msg.bot_replied}</div>
                        <div style={{ fontSize:'.65rem', color:'#888', marginTop:3, textAlign:'right' }}>Bot ✓✓</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#bbb' }}>
            Select a conversation
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
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button style={btnStyle(tab==='ga')}      onClick={() => setTab('ga')}>Google Analytics</button>
              <button style={btnStyle(tab==='clarity')} onClick={() => setTab('clarity')}>Clarity</button>
              <button style={btnStyle(tab==='wa')}      onClick={() => setTab('wa')}>💬 WhatsApp</button>
              <button onClick={load} disabled={loading} style={{ background:'#4A7C59', color:'#fff', border:'none', borderRadius:8, padding:'8px 14px', fontSize:'.82rem', fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?.6:1 }}>
                {loading ? '⟳' : '⟳ Refresh'}
              </button>
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
