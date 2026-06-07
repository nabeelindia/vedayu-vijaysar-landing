import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import StatCard from '../../components/admin/StatCard';
import PageHeader from '../../components/admin/PageHeader';

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmtN  = n  => Number(n || 0).toLocaleString('en-IN');
const fmtRs = n  => `₹${fmtN(n)}`;
const pct   = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : '—';
const pctN  = n  => `${Number(n || 0).toFixed(1)}%`;

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Card({ title, badge, children }) {
  return (
    <div style={{ background:'#fff', borderRadius:12, padding:'16px 18px',
      boxShadow:'0 1px 4px rgba(0,0,0,.07)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <h3 style={{ margin:0, fontSize:'.75rem', fontWeight:700, textTransform:'uppercase',
          letterSpacing:'.8px', color:'#888' }}>{title}</h3>
        {badge && <span style={{ fontSize:'.62rem', fontWeight:700, background:'#e8f5e9',
          color:'#4A7C59', padding:'2px 7px', borderRadius:20 }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ textAlign:'center', flex:'1 1 80px', minWidth:0 }}>
      <div style={{ fontSize:'1.5rem', fontWeight:800, color:color||'#1a1a1a', lineHeight:1,
        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{value}</div>
      <div style={{ fontSize:'.7rem', fontWeight:600, color:'#555', marginTop:4 }}>{label}</div>
      {sub && <div style={{ fontSize:'.65rem', color:'#aaa', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function Bar({ label, count, max, color, sub }) {
  const width = max ? `${(+count / +max) * 100}%` : '0%';
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.75rem', marginBottom:3 }}>
        <span style={{ color:'#333', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis',
          whiteSpace:'nowrap', maxWidth:'60%' }}>{label}</span>
        <span style={{ color:'#888', fontWeight:600, flexShrink:0 }}>
          {fmtN(count)}{sub ? ` · ${sub}` : ''}
        </span>
      </div>
      <div style={{ background:'#f0f0f0', borderRadius:4, height:6 }}>
        <div style={{ width, background:color||'#4A7C59', borderRadius:4, height:'100%', transition:'width .5s' }} />
      </div>
    </div>
  );
}

// ── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics').then(r => r.json()).then(d => {
      setData(d); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color:'#888', padding:'20px 0' }}>Loading…</p>;
  if (!data)   return <p style={{ color:'#e57373' }}>Failed to load order analytics.</p>;

  const { totalRevenue, totalOrders, revenueByDay, codCount, prepaidCount, verification } = data;
  const confirmRate = pct((verification.confirmed + verification.autoConfirmed), codCount);
  const cancelRate  = pct(verification.cancelled, codCount);
  const days   = Object.entries(revenueByDay || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
  const maxRev = Math.max(...days.map(d => d[1]), 1);

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div className="admin-stat-grid">
        <StatCard label="Total Revenue (30d)"  value={fmtRs(totalRevenue)} color="#5C3D1E" />
        <StatCard label="Total Orders (30d)"   value={totalOrders} />
        <StatCard label="COD Orders"           value={codCount}
          sub={`${pct(codCount, totalOrders)} of total`} />
        <StatCard label="Prepaid Orders"       value={prepaidCount}
          sub={`${pct(prepaidCount, totalOrders)} of total`} color="#4A7C59" />
      </div>

      <Card title="Revenue — Last 14 Days">
        {days.length === 0
          ? <p style={{ color:'#aaa', fontSize:'.85rem', margin:0 }}>No revenue data yet.</p>
          : <>
              <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80 }}>
                {days.map(([day, rev]) => (
                  <div key={day} title={`${day}: ${fmtRs(rev)}`}
                    style={{ flex:1, background:'#5C3D1E', borderRadius:'3px 3px 0 0', minWidth:0,
                      height:`${(rev / maxRev) * 80}px`, opacity:.85 }} />
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.6rem', color:'#aaa', marginTop:4 }}>
                <span>{days[0]?.[0]?.slice(5)}</span>
                <span>{days[days.length-1]?.[0]?.slice(5)}</span>
              </div>
            </>
        }
      </Card>

      <Card title="WhatsApp Confirmation — COD Orders">
        <div className="admin-stat-grid" style={{ marginBottom:12 }}>
          <StatCard label="Customer confirmed"    value={verification.confirmed}
            sub={pct(verification.confirmed, codCount)} color="#2E7D32" />
          <StatCard label="Auto-confirmed"        value={verification.autoConfirmed}
            sub={pct(verification.autoConfirmed, codCount)} color="#1565C0" />
          <StatCard label="Cancelled by customer" value={verification.cancelled}
            sub={cancelRate} color="#C62828" />
          <StatCard label="Pending reply"         value={verification.pending} color="#E65100" />
        </div>
        <div style={{ padding:'10px 14px', background:'#f5f0e8', borderRadius:8, fontSize:'.78rem', color:'#5C3D1E' }}>
          <b>Confirmation rate:</b> {confirmRate} &nbsp;·&nbsp; <b>Cancel rate:</b> {cancelRate}
        </div>
      </Card>
    </div>
  );
}

// ── Google Analytics tab ──────────────────────────────────────────────────────
function GATab() {
  const [ga,      setGa]      = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch('/api/ga-insights')
      .then(r => r.ok ? r.json() : r.json().then(j => { throw new Error(j.error || 'Failed'); }))
      .then(d => { setGa(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p style={{ color:'#888', padding:'20px 0' }}>Loading Google Analytics…</p>;
  if (error)   return <div style={{ background:'#fff8e1', borderRadius:8, padding:'12px 16px', color:'#6D4C00', fontSize:'.85rem' }}>⚠️ {error}</div>;

  const ov          = ga?.overview    || {};
  const topPages    = ga?.topPages    || [];
  const channels    = ga?.channels    || [];
  const gaDevices   = ga?.devices     || [];
  const gaCountries = ga?.countries   || [];
  const maxCh    = Math.max(...channels.map(c => +c.sessions), 1);
  const maxTP    = Math.max(...topPages.map(p => +p.views), 1);
  const maxGADev = Math.max(...gaDevices.map(d => +d.sessions), 1);
  const maxGACo  = Math.max(...gaCountries.map(c => +c.sessions), 1);

  return (
    <div style={{ display:'grid', gap:12 }}>
      <Card title="Last 30 Days — Overview" badge="Google Analytics">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))', gap:12 }}>
          <Stat label="Sessions"     value={fmtN(ov.sessions)}      color="#1a1a1a" />
          <Stat label="Active Users" value={fmtN(ov.activeUsers)}   color="#4A7C59" />
          <Stat label="New Users"    value={fmtN(ov.newUsers)}      color="#7c4a7c" />
          <Stat label="Conversions"  value={fmtN(ov.conversions)}   color="#e07b39" />
          <Stat label="Revenue"      value={fmtRs(ov.revenue)}      color="#4A7C59" />
        </div>
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:12 }}>
        <Card title="Engagement">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            <Stat label="Bounce Rate"   value={pctN(ov.bounceRate)}
              color={+ov.bounceRate > 70 ? '#c00' : '#4A7C59'} />
            <Stat label="Avg Session"   value={ov.avgSessionDuration} />
            <Stat label="Pages/Session" value={ov.pagesPerSession} />
          </div>
        </Card>
        <Card title="Traffic Channels">
          {channels.map(c => <Bar key={c.channel} label={c.channel} count={c.sessions}
            max={maxCh} color="#4A7C59" sub={`${c.conversions} conv`} />)}
        </Card>
      </div>

      <Card title="Top Pages">
        {topPages.map(p => <Bar key={p.page} label={p.page||'/'}
          count={p.views} max={maxTP} color="#7c4a7c" sub={`${p.bounceRate}% bounce`} />)}
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:12 }}>
        <Card title="Devices">
          {gaDevices.map(d => <Bar key={d.device} label={d.device}
            count={d.sessions} max={maxGADev} color="#4A7C59" sub={`${d.bounceRate}% bounce`} />)}
        </Card>
        <Card title="Countries">
          {gaCountries.map(c => <Bar key={c.country} label={c.country}
            count={c.sessions} max={maxGACo} color="#e07b39" />)}
        </Card>
      </div>
    </div>
  );
}

// ── Clarity tab ───────────────────────────────────────────────────────────────
function ClarityTab() {
  const [clarity, setClarity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch('/api/clarity-insights')
      .then(r => r.ok ? r.json() : r.json().then(j => { throw new Error(j.error || 'Failed'); }))
      .then(d => { setClarity(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p style={{ color:'#888', padding:'20px 0' }}>Loading Clarity…</p>;
  if (error)   return <div style={{ background:'#fff8e1', borderRadius:8, padding:'12px 16px', color:'#6D4C00', fontSize:'.85rem' }}>⚠️ {error}</div>;

  const traffic    = clarity?.Traffic?.[0]          || {};
  const engagement = clarity?.EngagementTime?.[0]   || {};
  const scroll     = clarity?.ScrollDepth?.[0]      || {};
  const browsers   = clarity?.Browser               || [];
  const devices    = clarity?.Device                || [];
  const os         = clarity?.OS                    || [];
  const countries  = clarity?.Country               || [];
  const pages      = clarity?.PopularPages          || [];
  const referrers  = clarity?.ReferrerUrl           || [];
  const deadClick  = clarity?.DeadClickCount?.[0]   || {};
  const rageClick  = clarity?.RageClickCount?.[0]   || {};
  const quickBack  = clarity?.QuickbackClick?.[0]   || {};
  const exScroll   = clarity?.ExcessiveScroll?.[0]  || {};
  const maxBrowser = Math.max(...browsers.map(b => +b.sessionsCount), 1);
  const maxDevice  = Math.max(...devices.map(d => +d.sessionsCount), 1);
  const maxPage    = Math.max(...pages.map(p => +p.visitsCount), 1);
  const maxRef     = Math.max(...referrers.map(r => +r.sessionsCount), 1);

  return (
    <div style={{ display:'grid', gap:12 }}>
      <Card title="Traffic Overview" badge="Clarity">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))', gap:12 }}>
          <Stat label="Sessions"      value={fmtN(traffic.totalSessionCount||0)} />
          <Stat label="Unique Users"  value={fmtN(traffic.distinctUserCount||0)}    color="#4A7C59" />
          <Stat label="Bot Sessions"  value={fmtN(traffic.totalBotSessionCount||0)} color="#e07b39" />
          <Stat label="Pages/Session" value={(+(traffic.pagesPerSessionPercentage||0)).toFixed(2)} />
        </div>
      </Card>

      <Card title="Engagement">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))', gap:12 }}>
          <Stat label="Total Time (min)"  value={fmtN(engagement.totalTime||0)} />
          <Stat label="Active Time (min)" value={fmtN(engagement.activeTime||0)} color="#4A7C59" />
          <Stat label="Avg Scroll Depth"  value={pctN(scroll.averageScrollDepth||0)} color="#7c4a7c" />
        </div>
      </Card>

      <Card title="UX Signals — Frustration Indicators">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(80px, 1fr))', gap:12 }}>
          <Stat label="Dead Clicks"   value={pctN(deadClick.sessionsWithMetricPercentage||0)}
            sub={`${deadClick.subTotal||0} clicks`}
            color={+(deadClick.sessionsWithMetricPercentage||0)>20?'#c00':'#e07b39'} />
          <Stat label="Rage Clicks"   value={pctN(rageClick.sessionsWithMetricPercentage||0)}
            sub={`${rageClick.subTotal||0} clicks`}
            color={+(rageClick.sessionsWithMetricPercentage||0)>5?'#c00':'#4A7C59'} />
          <Stat label="Quick Backs"   value={pctN(quickBack.sessionsWithMetricPercentage||0)}
            sub={`${quickBack.subTotal||0} events`}
            color={+(quickBack.sessionsWithMetricPercentage||0)>15?'#c00':'#e07b39'} />
          <Stat label="Excess Scroll" value={pctN(exScroll.sessionsWithMetricPercentage||0)}
            sub={`${exScroll.subTotal||0} events`} color="#888" />
        </div>
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:12 }}>
        <Card title="Devices">
          {devices.map(d => <Bar key={d.name} label={d.name}
            count={+d.sessionsCount} max={maxDevice} color="#4A7C59" />)}
        </Card>
        <Card title="Browsers">
          {browsers.map(b => <Bar key={b.name} label={b.name}
            count={+b.sessionsCount} max={maxBrowser} color="#7c4a7c" />)}
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px,1fr))', gap:12 }}>
        <Card title="OS">
          {os.map(o => <Bar key={o.name} label={o.name}
            count={+o.sessionsCount}
            max={Math.max(...os.map(x=>+x.sessionsCount),1)} color="#e07b39" />)}
        </Card>
        <Card title="Countries">
          {countries.map(c => <Bar key={c.name} label={c.name}
            count={+c.sessionsCount}
            max={Math.max(...countries.map(x=>+x.sessionsCount),1)} color="#4A7C59" />)}
        </Card>
      </div>

      <Card title="Popular Pages">
        {pages.map(p => <Bar key={p.url}
          label={p.url.replace(/https?:\/\/(www\.)?vedayulife\.com/,'')||'/'}
          count={+p.visitsCount} max={maxPage} color="#4A7C59" />)}
      </Card>

      <Card title="Traffic Sources">
        {referrers.map((r,i) => <Bar key={i} label={r.name||'Direct'}
          count={+r.sessionsCount} max={maxRef} color="#7c4a7c" />)}
      </Card>
    </div>
  );
}

// ── Language Analytics tab ────────────────────────────────────────────────────
const LOCALE_COLORS = { en:'#4A7C59', hi:'#e07b39', ta:'#7c4a7c', te:'#1565C0' };
const LOCALE_FLAGS  = { en:'🇬🇧', hi:'🇮🇳', ta:'🌿', te:'🌸' };

function LangTab() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    fetch('/api/admin/lang-analytics')
      .then(r => r.ok ? r.json() : r.json().then(j => { throw new Error(j.error || 'Failed'); }))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return <p style={{ color:'#888', padding:'20px 0' }}>Loading language data…</p>;
  if (error)   return <div style={{ background:'#fff8e1', borderRadius:8, padding:'12px 16px', color:'#6D4C00', fontSize:'.85rem' }}>⚠️ {error}</div>;

  const total     = data?.total   || [];
  const daily     = data?.daily   || [];
  const grandTotal = total.reduce((s, r) => s + r.count, 0) || 1;
  const maxCount  = Math.max(...total.map(r => r.count), 1);

  // Build stacked daily chart data
  const locales = ['en','hi','ta','te'];

  return (
    <div style={{ display:'grid', gap:12 }}>
      {/* All-time summary cards */}
      <div className="admin-stat-grid">
        {total.map(r => (
          <StatCard key={r.locale}
            label={`${LOCALE_FLAGS[r.locale] || ''} ${r.label}`}
            value={fmtN(r.count)}
            sub={`${((r.count / grandTotal) * 100).toFixed(1)}% of total`}
            color={LOCALE_COLORS[r.locale]} />
        ))}
      </div>

      {/* Bar chart — all-time */}
      <Card title="All-time Language Distribution" badge={`${fmtN(grandTotal)} total sessions`}>
        {total.map(r => (
          <Bar key={r.locale}
            label={`${LOCALE_FLAGS[r.locale] || ''} ${r.label}`}
            count={r.count} max={maxCount}
            color={LOCALE_COLORS[r.locale]}
            sub={`${((r.count / grandTotal) * 100).toFixed(1)}%`} />
        ))}
      </Card>

      {/* Last 14 days daily line */}
      <Card title="Daily Language Sessions — Last 14 Days">
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.75rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left', padding:'4px 8px', color:'#888', fontWeight:600 }}>Date</th>
                {locales.map(loc => (
                  <th key={loc} style={{ textAlign:'center', padding:'4px 8px',
                    color:LOCALE_COLORS[loc], fontWeight:700 }}>
                    {LOCALE_FLAGS[loc]} {loc.toUpperCase()}
                  </th>
                ))}
                <th style={{ textAlign:'right', padding:'4px 8px', color:'#888', fontWeight:600 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {daily.map(({ day, counts }) => {
                const rowTotal = locales.reduce((s, l) => s + Number(counts[l] || 0), 0);
                return (
                  <tr key={day} style={{ borderTop:'1px solid #f0f0f0' }}>
                    <td style={{ padding:'5px 8px', color:'#555' }}>{day.slice(5)}</td>
                    {locales.map(loc => (
                      <td key={loc} style={{ textAlign:'center', padding:'5px 8px',
                        color: counts[loc] ? LOCALE_COLORS[loc] : '#ccc', fontWeight: counts[loc] ? 700 : 400 }}>
                        {counts[loc] ? fmtN(counts[loc]) : '–'}
                      </td>
                    ))}
                    <td style={{ textAlign:'right', padding:'5px 8px', color:'#333', fontWeight:700 }}>
                      {rowTotal || '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key:'orders',  label:'📦 Orders'  },
  { key:'ga',      label:'📈 Google Analytics' },
  { key:'clarity', label:'🖱 Clarity' },
  { key:'lang',    label:'🌐 Languages' },
];

export default function AdminAnalytics() {
  const [tab, setTab] = useState('orders');

  return (
    <AdminLayout title="Analytics">
      <PageHeader title="Analytics" />

      {/* Tab bar */}
      <div className="admin-filter-bar" style={{ marginBottom:16 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab === t.key ? '#5C3D1E' : '#f0ede8',
              color: tab === t.key ? '#fff' : '#555',
              fontSize:'.82rem', fontWeight:700, whiteSpace:'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'orders'  && <OrdersTab />}
      {tab === 'ga'      && <GATab />}
      {tab === 'clarity' && <ClarityTab />}
      {tab === 'lang'    && <LangTab />}
    </AdminLayout>
  );
}
