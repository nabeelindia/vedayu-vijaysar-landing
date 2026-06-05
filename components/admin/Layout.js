import Head from 'next/head';
import { useRouter } from 'next/router';

const NAV = [
  { href: '/admin',           label: 'Dashboard', icon: '🏠' },
  { href: '/admin/orders',    label: 'Orders',    icon: '📦' },
  { href: '/admin/customers', label: 'Customers', icon: '👥' },
  { href: '/admin/whatsapp',  label: 'WhatsApp',  icon: '💬' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
];

const BROWN = '#5C3D1E';

export default function AdminLayout({ title, children }) {
  const router = useRouter();
  const active = (href) => router.pathname === href || (href !== '/admin' && router.pathname.startsWith(href));

  return (
    <>
      <Head>
        <title>{title ? `${title} — Vedayu Admin` : 'Vedayu Admin'}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ display:'flex', minHeight:'100vh', fontFamily:'system-ui,sans-serif',
        background:'#f5f0e8', color:'#1a1a1a' }}>

        <aside className="admin-sidebar" style={{ width:200, background:BROWN, display:'flex',
          flexDirection:'column', padding:'24px 0', flexShrink:0,
          position:'sticky', top:0, height:'100vh' }}>
          <div style={{ padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,.15)' }}>
            <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#fff' }}>🌿 Vedayu</div>
            <div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.5)', marginTop:2 }}>Admin Panel</div>
          </div>
          <nav style={{ flex:1, padding:'16px 0' }}>
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{
                display:'flex', alignItems:'center', gap:10, padding:'10px 20px',
                color: active(n.href) ? '#fff' : 'rgba(255,255,255,.65)',
                background: active(n.href) ? 'rgba(255,255,255,.15)' : 'transparent',
                textDecoration:'none', fontSize:'.88rem', fontWeight: active(n.href) ? 700 : 400,
                borderLeft: active(n.href) ? '3px solid #C9A84C' : '3px solid transparent',
              }}>
                <span>{n.icon}</span>{n.label}
              </a>
            ))}
          </nav>
          <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,.15)' }}>
            <a href="/api/admin-auth?logout=1" style={{ fontSize:'.75rem',
              color:'rgba(255,255,255,.5)', textDecoration:'none' }}>Sign out</a>
          </div>
        </aside>

        <main className="admin-main" style={{ flex:1, padding:'20px 20px 80px', maxWidth:'100%', overflowX:'hidden' }}>
          {children}
        </main>
      </div>

      <nav className="admin-bottom-nav" style={{ display:'none', position:'fixed', bottom:0,
        left:0, right:0, background:BROWN, borderTop:'1px solid rgba(255,255,255,.15)',
        padding:'8px 0 12px', zIndex:100 }}>
        {NAV.map(n => (
          <a key={n.href} href={n.href} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            flex:1, textDecoration:'none',
            color: active(n.href) ? '#C9A84C' : 'rgba(255,255,255,.6)',
          }}>
            <span style={{ fontSize:'1.2rem' }}>{n.icon}</span>
            <span style={{ fontSize:'.55rem', fontWeight: active(n.href) ? 700 : 400 }}>{n.label}</span>
          </a>
        ))}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-bottom-nav { display: flex !important; }
          .admin-main { padding: 14px 12px 88px !important; }
        }

        /* Stat card grid — 2 columns on mobile */
        .admin-stat-grid { display: flex; gap: 12px; flex-wrap: wrap; }
        @media (max-width: 600px) {
          .admin-stat-grid > * { flex: 0 0 calc(50% - 6px) !important; min-width: 0 !important; }
        }

        /* Filter chips — horizontal scroll on small screens */
        .admin-filter-bar {
          display: flex; gap: 6px; overflow-x: auto;
          padding-bottom: 4px; -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .admin-filter-bar::-webkit-scrollbar { display: none; }
        .admin-filter-bar button { flex-shrink: 0; }

        /* Two-column card layouts stack on mobile */
        .admin-card-row { display: flex; gap: 16px; flex-wrap: wrap; }
        @media (max-width: 600px) {
          .admin-card-row > * { flex: 1 1 100% !important; }
        }

        /* Touch-friendly tap targets */
        @media (max-width: 768px) {
          .admin-bottom-nav a { min-height: 52px; justify-content: center; }
        }
      `}</style>
    </>
  );
}
