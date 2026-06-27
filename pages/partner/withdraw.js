import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getGpSession } from '../../lib/gp-auth';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#0891B2';
const GREEN = '#059669';
const DARK = '#1e293b';

function maskAccount(acc) {
  if (!acc || acc.length < 4) return acc;
  return '••••' + acc.slice(-4);
}

export default function WithdrawPage({ partner, available }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/withdraw', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Withdrawal failed'); return; }
      router.replace('/partner?withdrawn=1');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Withdraw Earnings — Vedayu Partner</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0891B2 0%, #0e7490 100%)', padding: '20px 16px' }}>
          <a href="/partner" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', textDecoration: 'none' }}>← Dashboard</a>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: '8px 0 0' }}>Withdraw Earnings</h1>
        </div>

        <div style={{ padding: '24px 16px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {/* Amount card */}
          <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', marginBottom: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>Withdrawal Amount</div>
            <div style={{ fontSize: '42px', fontWeight: '800', color: DARK }}>₹{Number(available).toLocaleString('en-IN')}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>All available earnings</div>
          </div>

          {/* Bank details card */}
          <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: DARK, marginBottom: '14px' }}>Sending to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { label: 'Bank', value: partner.bank_name },
                { label: 'Account', value: maskAccount(partner.bank_account) },
                { label: 'IFSC', value: partner.bank_ifsc },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{row.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: DARK }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fef3c7', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#92400e' }}>
            Withdrawals are processed within 3–5 business days.
          </div>

          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              display: 'block', width: '100%',
              background: loading ? '#94a3b8' : GREEN,
              color: '#fff', border: 'none', borderRadius: '12px',
              padding: '16px', fontSize: '16px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer', minHeight: '52px',
            }}
          >
            {loading ? 'Submitting…' : 'Confirm Withdrawal'}
          </button>

          <a href="/partner" style={{ display: 'block', textAlign: 'center', marginTop: '14px', color: '#64748b', fontSize: '14px', textDecoration: 'none' }}>
            Cancel
          </a>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps({ req }) {
  const partnerId = getGpSession(req);
  if (!partnerId) return { redirect: { destination: '/partner/login', permanent: false } };

  const [{ data: partner }, { data: earnings }] = await Promise.all([
    supabase.from('growth_partners').select('id, name, bank_name, bank_account, bank_ifsc, kyc_verified').eq('id', partnerId).single(),
    supabase.from('gp_earnings').select('amount').eq('partner_id', partnerId).eq('status', 'earned'),
  ]);

  if (!partner) return { redirect: { destination: '/partner/login', permanent: false } };

  const available = (earnings || []).reduce((acc, e) => acc + (e.amount || 0), 0);

  if (available < 500 || !partner.kyc_verified) {
    return { redirect: { destination: '/partner', permanent: false } };
  }

  return { props: { partner, available } };
}
