import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getGpSession } from '../../lib/gp-auth';

const PRIMARY = '#0891B2';
const DARK = '#1e293b';
const LIGHT_BG = '#f0f9ff';

export default function PartnerLogin() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return; }
      setStep(2);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid OTP'); return; }
      if (data.registered) {
        router.replace('/partner');
      } else {
        router.replace(`/partner/register?mobile=${encodeURIComponent(mobile)}&email=${encodeURIComponent(email)}&verifyToken=${encodeURIComponent(data.verifyToken)}`);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Partner Login — Vedayu</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: LIGHT_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        {/* Logo */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: '700', color: DARK }}>Vedayu</div>
          <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Growth Partner Program</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 24px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(8,145,178,0.08)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: DARK, margin: '0 0 8px' }}>
            {step === 1 ? 'Sign in' : 'Enter OTP'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px' }}>
            {step === 1
              ? 'Enter your mobile number and email to receive an OTP.'
              : `We sent a 6-digit OTP to ${email}`}
          </p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp}>
              <label style={labelStyle}>Mobile Number</label>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                required
                style={inputStyle}
              />
              <label style={{ ...labelStyle, marginTop: '16px' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
              />
              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <label style={labelStyle}>6-digit OTP</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                style={{ ...inputStyle, fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }}
              />
              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(''); setError(''); }}
                style={{ display: 'block', width: '100%', marginTop: '8px', background: 'none', border: 'none', color: PRIMARY, fontSize: '14px', cursor: 'pointer', padding: '10px' }}
              >
                ← Change mobile / email
              </button>
            </form>
          )}

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '24px', marginBottom: 0 }}>
            Don't have an account?{' '}
            <a href="/partner/register" style={{ color: PRIMARY, fontWeight: '600', textDecoration: 'none' }}>
              Register
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px',
};

const inputStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px',
  fontSize: '16px', color: '#1e293b', outline: 'none',
  transition: 'border-color 0.15s',
};

function btnStyle(disabled) {
  return {
    display: 'block', width: '100%', marginTop: '24px',
    background: disabled ? '#94a3b8' : '#0891B2',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '14px', fontSize: '16px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    minHeight: '48px',
  };
}

export async function getServerSideProps({ req }) {
  const partnerId = getGpSession(req);
  if (partnerId) return { redirect: { destination: '/partner', permanent: false } };
  return { props: {} };
}
