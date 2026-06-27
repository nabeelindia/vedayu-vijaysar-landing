import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getGpSession } from '../../lib/gp-auth';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#0891B2';
const GREEN = '#059669';
const AMBER = '#d97706';
const DARK = '#1e293b';

function fmtINR(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function StatusBadge({ status }) {
  const map = {
    earned: { label: 'Earned', bg: '#d1fae5', color: GREEN },
    in_transit: { label: 'In Transit', bg: '#fef3c7', color: AMBER },
    pending: { label: 'Pending', bg: '#f1f5f9', color: '#64748b' },
    paid: { label: 'Paid', bg: '#d1fae5', color: GREEN },
    processing: { label: 'Processing', bg: '#fef3c7', color: AMBER },
    rejected: { label: 'Rejected', bg: '#fee2e2', color: '#dc2626' },
  };
  const s = map[status] || { label: status, bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: '6px', padding: '2px 8px', fontSize: '12px', fontWeight: '600' }}>
      {s.label}
    </span>
  );
}

function BottomNav({ active }) {
  const tabs = [
    { href: '/partner', icon: '🏠', label: 'Dashboard', key: 'dashboard' },
    { href: '/partner#earnings', icon: '💰', label: 'Earnings', key: 'earnings' },
    { href: '/partner/withdraw', icon: '🏦', label: 'Withdraw', key: 'withdraw' },
    { href: '/partner/profile', icon: '👤', label: 'Profile', key: 'profile' },
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #e2e8f0',
      display: 'flex', zIndex: 100,
    }}>
      {tabs.map(t => (
        <a key={t.key} href={t.href} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '10px 4px 8px', textDecoration: 'none',
          color: t.key === active ? PRIMARY : '#94a3b8',
          fontSize: '11px', fontWeight: t.key === active ? '700' : '500',
          minHeight: '56px', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '20px', marginBottom: '2px' }}>{t.icon}</span>
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export default function PartnerDashboard({ partner, earnings, withdrawals, wallet, stats }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showAllEarnings, setShowAllEarnings] = useState(false);

  const affiliateUrl = `https://vedayulife.com/${partner.handle}`;

  function copyLink() {
    navigator.clipboard?.writeText(affiliateUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const waText = encodeURIComponent(`🌿 Get authentic Ayurvedic supplements from Vedayu! Use my link: ${affiliateUrl}`);
  const canWithdraw = partner.kyc_verified && wallet.available >= 500;

  const displayEarnings = showAllEarnings ? earnings : earnings.slice(0, 10);

  return (
    <>
      <Head>
        <title>Partner Dashboard — Vedayu</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ background: '#f0f9ff', minHeight: '100vh', paddingBottom: '80px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0891B2 0%, #0e7490 100%)',
          padding: '24px 16px 80px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{partner.name}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>@{partner.handle}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              {partner.kyc_verified
                ? <span style={{ background: '#d1fae5', color: GREEN, borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>✓ KYC Verified</span>
                : <span style={{ background: '#fef3c7', color: AMBER, borderRadius: '8px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>⏳ KYC Pending</span>
              }
              <a href="/api/partner/logout" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', textDecoration: 'none' }}>Sign out</a>
            </div>
          </div>
        </div>

        {/* Wallet card (overlaps header) */}
        <div style={{ margin: '-56px 16px 0', position: 'relative', zIndex: 10 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 8px 32px rgba(8,145,178,0.15)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available to Withdraw</div>
            <div style={{ fontSize: '36px', fontWeight: '800', color: DARK, margin: '4px 0 12px' }}>{fmtINR(wallet.available)}</div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>In Transit</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: AMBER }}>{fmtINR(wallet.locked)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Pending</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#64748b' }}>{fmtINR(wallet.pending)}</div>
              </div>
            </div>
            <a
              href={canWithdraw ? '/partner/withdraw' : undefined}
              style={{
                display: 'block', textAlign: 'center',
                background: canWithdraw ? GREEN : '#e2e8f0',
                color: canWithdraw ? '#fff' : '#94a3b8',
                borderRadius: '10px', padding: '13px',
                fontSize: '15px', fontWeight: '700',
                textDecoration: 'none',
                cursor: canWithdraw ? 'pointer' : 'not-allowed',
                minHeight: '48px', lineHeight: '22px',
              }}
            >
              {canWithdraw ? `Withdraw ${fmtINR(wallet.available)}` : (
                !partner.kyc_verified ? 'Complete KYC to Withdraw' : 'Min ₹500 required'
              )}
            </a>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: 'Orders\nReferred', value: stats.ordersAll, sub: `${stats.ordersMonth} this month` },
              { label: 'Earned\nThis Month', value: fmtINR(stats.earnedMonth), sub: null },
              { label: 'Total\nEarned', value: fmtINR(stats.earnedAll), sub: 'all time' },
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '14px 10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: DARK }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', whiteSpace: 'pre-line', lineHeight: 1.3 }}>{s.label}</div>
                {s.sub && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Affiliate link card */}
          <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: DARK, marginBottom: '10px' }}>Your Affiliate Link</div>
            <div style={{
              background: '#f0f9ff', borderRadius: '8px', padding: '10px 12px',
              fontSize: '13px', color: PRIMARY, fontWeight: '600',
              wordBreak: 'break-all', marginBottom: '12px',
            }}>
              {affiliateUrl}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={copyLink} style={{
                flex: 1, background: copied ? '#d1fae5' : PRIMARY,
                color: copied ? GREEN : '#fff', border: 'none',
                borderRadius: '8px', padding: '10px',
                fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '44px',
              }}>
                {copied ? '✓ Copied!' : '📋 Copy Link'}
              </button>
              <a
                href={`https://wa.me/?text=${waText}`}
                target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, background: '#25D366', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '600', textAlign: 'center', textDecoration: 'none', minHeight: '44px', lineHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                📲 WhatsApp
              </a>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  onClick={() => navigator.share({ title: 'Vedayu', url: affiliateUrl })}
                  style={{ flex: 1, background: '#f1f5f9', color: DARK, border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', minHeight: '44px' }}
                >
                  ↗ Share
                </button>
              )}
            </div>
          </div>

          {/* Earnings history */}
          <div id="earnings" style={{ background: '#fff', borderRadius: '14px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: DARK, marginBottom: '14px' }}>Earnings History</div>
            {earnings.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No earnings yet. Share your link to get started!</p>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {['Date', 'Amount', 'Status'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayEarnings.map((e, i) => (
                        <tr key={e.id || i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '10px 8px', color: '#64748b' }}>
                            {new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: '700', color: DARK }}>{fmtINR(e.amount)}</td>
                          <td style={{ padding: '10px 8px' }}><StatusBadge status={e.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {earnings.length > 10 && (
                  <button
                    onClick={() => setShowAllEarnings(v => !v)}
                    style={{ display: 'block', width: '100%', marginTop: '12px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', fontSize: '13px', color: PRIMARY, fontWeight: '600', cursor: 'pointer' }}
                  >
                    {showAllEarnings ? 'Show Less' : `View All (${earnings.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Withdrawal history */}
          {withdrawals.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: DARK, marginBottom: '14px' }}>Withdrawal History</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {['Date', 'Amount', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((w, i) => (
                      <tr key={w.id || i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '10px 8px', color: '#64748b' }}>
                          {new Date(w.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </td>
                        <td style={{ padding: '10px 8px', fontWeight: '700', color: DARK }}>{fmtINR(w.amount)}</td>
                        <td style={{ padding: '10px 8px' }}><StatusBadge status={w.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav active="dashboard" />
    </>
  );
}

export async function getServerSideProps({ req }) {
  const partnerId = getGpSession(req);
  if (!partnerId) return { redirect: { destination: '/partner/login', permanent: false } };

  const [{ data: partner }, { data: earnings }, { data: withdrawals }] = await Promise.all([
    supabase.from('growth_partners').select('*').eq('id', partnerId).single(),
    supabase.from('gp_earnings').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false }),
    supabase.from('gp_withdrawals').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false }),
  ]);

  if (!partner) return { redirect: { destination: '/partner/login', permanent: false } };

  const sum = (arr, status) =>
    (arr || []).filter(e => e.status === status).reduce((acc, e) => acc + (e.amount || 0), 0);

  const wallet = {
    available: sum(earnings, 'earned'),
    locked: sum(earnings, 'in_transit'),
    pending: sum(earnings, 'pending'),
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth = (earnings || []).filter(e => e.created_at >= monthStart);
  const stats = {
    ordersAll: (earnings || []).length,
    ordersMonth: thisMonth.length,
    earnedAll: (earnings || []).reduce((acc, e) => acc + (e.amount || 0), 0),
    earnedMonth: thisMonth.reduce((acc, e) => acc + (e.amount || 0), 0),
  };

  return {
    props: {
      partner,
      earnings: earnings || [],
      withdrawals: withdrawals || [],
      wallet,
      stats,
    },
  };
}
