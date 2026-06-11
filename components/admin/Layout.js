import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const NAV = [
  { href: '/admin',            label: 'Dashboard', icon: '🏠' },
  { href: '/admin/orders',     label: 'Orders',    icon: '📦' },
  { href: '/admin/customers',  label: 'Customers', icon: '👥' },
  { href: '/admin/whatsapp',   label: 'WhatsApp',  icon: '💬' },
  { href: '/admin/analytics',  label: 'Analytics', icon: '📊' },
  { href: '/admin/referrals',  label: 'Referrals', icon: '🎁' },
  { href: '/admin/abandoned',  label: 'Abandoned', icon: '🛒' },
  { href: '/admin/settings',   label: 'Settings',  icon: '⚙️' },
];

// Items shown in the mobile bottom bar (the rest go in the More drawer)
const MOBILE_PRIMARY = ['/admin', '/admin/orders', '/admin/whatsapp', '/admin/abandoned'];

const BROWN = '#5C3D1E';

export default function AdminLayout({ title, children }) {
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const active = (href) =>
    router.pathname === href || (href !== '/admin' && router.pathname.startsWith(href));

  const primaryNav  = NAV.filter(n => MOBILE_PRIMARY.includes(n.href));
  const overflowNav = NAV.filter(n => !MOBILE_PRIMARY.includes(n.href));

  return (
    <>
      <Head>
        <title>{title ? `${title} — Vedayu Admin` : 'Vedayu Admin'}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui,sans-serif',
        background: '#f5f0e8', color: '#1a1a1a' }}>

        {/* ── Desktop sidebar ── */}
        <aside className="admin-sidebar" style={{ width: 200, background: BROWN, display: 'flex',
          flexDirection: 'column', padding: '24px 0', flexShrink: 0,
          position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,.15)' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>🌿 Vedayu</div>
            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.5)', marginTop: 2 }}>Admin Panel</div>
          </div>
          <nav style={{ flex: 1, padding: '16px 0' }}>
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                color:      active(n.href) ? '#fff' : 'rgba(255,255,255,.65)',
                background: active(n.href) ? 'rgba(255,255,255,.15)' : 'transparent',
                textDecoration: 'none', fontSize: '.88rem',
                fontWeight: active(n.href) ? 700 : 400,
                borderLeft: active(n.href) ? '3px solid #C9A84C' : '3px solid transparent',
              }}>
                <span>{n.icon}</span>{n.label}
              </a>
            ))}
          </nav>
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,.15)' }}>
            <a href="/api/admin-auth?logout=1" style={{ fontSize: '.75rem',
              color: 'rgba(255,255,255,.5)', textDecoration: 'none' }}>Sign out</a>
          </div>
        </aside>

        <main className="admin-main" style={{ flex: 1, padding: '20px 20px 80px',
          maxWidth: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="admin-bottom-nav" style={{ display: 'none', position: 'fixed', bottom: 0,
        left: 0, right: 0, background: BROWN,
        borderTop: '1px solid rgba(255,255,255,.15)',
        padding: '8px 0 12px', zIndex: 100 }}>

        {primaryNav.map(n => (
          <a key={n.href} href={n.href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            flex: 1, textDecoration: 'none',
            color: active(n.href) ? '#C9A84C' : 'rgba(255,255,255,.6)',
          }}>
            <span style={{ fontSize: '1.2rem' }}>{n.icon}</span>
            <span style={{ fontSize: '.55rem', fontWeight: active(n.href) ? 700 : 400 }}>
              {n.label}
            </span>
          </a>
        ))}

        {/* More button */}
        <button onClick={() => setMoreOpen(true)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: overflowNav.some(n => active(n.href)) ? '#C9A84C' : 'rgba(255,255,255,.6)',
        }}>
          <span style={{ fontSize: '1.2rem' }}>☰</span>
          <span style={{ fontSize: '.55rem', fontWeight: overflowNav.some(n => active(n.href)) ? 700 : 400 }}>
            More
          </span>
        </button>
      </nav>

      {/* ── More drawer (mobile) ── */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div onClick={() => setMoreOpen(false)} style={{
            display: 'none', position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.45)', zIndex: 200,
          }} className="admin-more-backdrop" />

          {/* Sheet */}
          <div className="admin-more-sheet" style={{
            display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#fff', borderRadius: '16px 16px 0 0',
            padding: '12px 0 32px', zIndex: 201,
            boxShadow: '0 -4px 24px rgba(0,0,0,.15)',
          }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: '#e0dbd4', borderRadius: 2,
              margin: '0 auto 16px' }} />

            {overflowNav.map(n => (
              <a key={n.href} href={n.href} onClick={() => setMoreOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 24px', textDecoration: 'none',
                color: active(n.href) ? BROWN : '#444',
                fontWeight: active(n.href) ? 700 : 400,
                fontSize: '.92rem',
                background: active(n.href) ? '#f5f0e8' : 'transparent',
                borderLeft: active(n.href) ? `3px solid ${BROWN}` : '3px solid transparent',
              }}>
                <span style={{ fontSize: '1.1rem' }}>{n.icon}</span>
                {n.label}
              </a>
            ))}

            <div style={{ borderTop: '1px solid #f0ede8', marginTop: 8, padding: '12px 24px 0' }}>
              <a href="/api/admin-auth?logout=1" style={{ fontSize: '.85rem',
                color: '#aaa', textDecoration: 'none' }}>Sign out</a>
            </div>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .admin-sidebar        { display: none !important; }
          .admin-bottom-nav     { display: flex !important; }
          .admin-main           { padding: 14px 12px 88px !important; }
          .admin-more-backdrop  { display: block !important; }
          .admin-more-sheet     { display: block !important; }
        }

        .admin-bottom-nav a,
        .admin-bottom-nav button { min-height: 52px; justify-content: center; }

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
      ` }} />
    </>
  );
}
