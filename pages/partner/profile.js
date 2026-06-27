import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getGpSession } from '../../lib/gp-auth';
import { supabase } from '../../lib/supabase';

const PRIMARY = '#0891B2';
const GREEN = '#059669';
const DARK = '#1e293b';
const PROFESSIONS = ['Doctor', 'Nutritionist', 'Yoga Instructor', 'Influencer', 'Other'];

export default function ProfilePage({ partner: initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name || '');
  const [profession, setProfession] = useState(initial.profession || '');
  const [city, setCity] = useState(initial.city || '');
  const [bankName, setBankName] = useState(initial.bank_name || '');
  const [bankAccount, setBankAccount] = useState(initial.bank_account || '');
  const [bankIfsc, setBankIfsc] = useState(initial.bank_ifsc || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch('/api/partner/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, profession, city, bank_name: bankName, bank_account: bankAccount, bank_ifsc: bankIfsc }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Update failed'); return; }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Edit Profile — Vedayu Partner</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#f0f9ff', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: '80px' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0891B2 0%, #0e7490 100%)', padding: '20px 16px 24px' }}>
          <a href="/partner" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', textDecoration: 'none' }}>← Dashboard</a>
          <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', margin: '8px 0 0' }}>Edit Profile</h1>
        </div>

        <div style={{ padding: '20px 16px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', marginBottom: '16px' }}>
              ✓ Profile updated successfully.
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Account (read-only)</div>
            {[
              { label: 'Mobile', value: initial.mobile },
              { label: 'Handle', value: `@${initial.handle}` },
              { label: 'Email', value: initial.email },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{row.label}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: DARK }}>{row.value}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: DARK, marginBottom: '16px' }}>Personal Details</div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
              </div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Profession</label>
                <select value={profession} onChange={e => setProfession(e.target.value)} required style={inputStyle}>
                  <option value="">Select…</option>
                  {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ ...fieldGroup, marginBottom: 0 }}>
                <label style={labelStyle}>City</label>
                <input value={city} onChange={e => setCity(e.target.value)} required style={inputStyle} />
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: DARK, marginBottom: '16px' }}>Bank Details</div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Bank Name</label>
                <input value={bankName} onChange={e => setBankName(e.target.value)} required style={inputStyle} />
              </div>
              <div style={fieldGroup}>
                <label style={labelStyle}>Account Number</label>
                <input
                  type="text" inputMode="numeric"
                  value={bankAccount}
                  onChange={e => setBankAccount(e.target.value.replace(/\D/g, ''))}
                  required style={inputStyle}
                />
              </div>
              <div style={{ ...fieldGroup, marginBottom: 0 }}>
                <label style={labelStyle}>IFSC Code</label>
                <input
                  value={bankIfsc}
                  onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                  pattern="[A-Z]{4}0[A-Z0-9]{6}"
                  maxLength={11}
                  required style={inputStyle}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              display: 'block', width: '100%',
              background: loading ? '#94a3b8' : PRIMARY,
              color: '#fff', border: 'none', borderRadius: '12px',
              padding: '16px', fontSize: '16px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer', minHeight: '52px',
            }}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <a href="/api/partner/logout" style={{ color: '#dc2626', fontSize: '14px', textDecoration: 'none' }}>
              Sign out of partner account
            </a>
          </div>
        </div>

        {/* Bottom nav */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', zIndex: 100 }}>
          {[
            { href: '/partner', icon: '🏠', label: 'Dashboard' },
            { href: '/partner#earnings', icon: '💰', label: 'Earnings' },
            { href: '/partner/withdraw', icon: '🏦', label: 'Withdraw' },
            { href: '/partner/profile', icon: '👤', label: 'Profile', active: true },
          ].map(t => (
            <a key={t.href} href={t.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 4px 8px', textDecoration: 'none',
              color: t.active ? PRIMARY : '#94a3b8',
              fontSize: '11px', fontWeight: t.active ? '700' : '500', minHeight: '56px', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '20px', marginBottom: '2px' }}>{t.icon}</span>
              {t.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}

const fieldGroup = { marginBottom: '16px' };
const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px' };
const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px',
  fontSize: '15px', color: '#1e293b', outline: 'none',
};

export async function getServerSideProps({ req }) {
  const partnerId = getGpSession(req);
  if (!partnerId) return { redirect: { destination: '/partner/login', permanent: false } };

  const { data: partner } = await supabase
    .from('growth_partners')
    .select('*')
    .eq('id', partnerId)
    .single();

  if (!partner) return { redirect: { destination: '/partner/login', permanent: false } };

  return { props: { partner } };
}
