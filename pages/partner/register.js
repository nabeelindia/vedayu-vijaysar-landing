import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getGpSession } from '../../lib/gp-auth';

const PRIMARY = '#0891B2';
const DARK = '#1e293b';
const LIGHT_BG = '#f0f9ff';
const PROFESSIONS = ['Doctor', 'Nutritionist', 'Yoga Instructor', 'Influencer', 'Other'];

function suggestHandle(name) {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
    .slice(0, 30) || '';
}

export default function PartnerRegister() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(2); // starts at step 2 (step 1 = login)
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const storedMobile = sessionStorage.getItem('gp_verify_mobile') || '';
    const storedEmail = sessionStorage.getItem('gp_verify_email') || '';
    const storedToken = sessionStorage.getItem('gp_verify_token') || '';
    if (!storedMobile || !storedToken) {
      router.replace('/partner/login');
      return;
    }
    setMobile(storedMobile);
    setEmail(storedEmail);
    setVerifyToken(storedToken);
    setReady(true);
  }, []);
  const [handle, setHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [profession, setProfession] = useState('');
  const [city, setCity] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleNameChange(val) {
    setName(val);
    if (!handleEdited) setHandle(suggestHandle(val));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (step === 2) { setStep(3); return; }
    // step 3: submit
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile, email, verifyToken,
          name, handle, profession, city,
          bank_name: bankName, bank_account: bankAccount, bank_ifsc: bankIfsc,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }
      sessionStorage.removeItem('gp_verify_token');
      sessionStorage.removeItem('gp_verify_mobile');
      sessionStorage.removeItem('gp_verify_email');
      router.replace('/partner');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <>
      <Head>
        <title>Partner Registration — Vedayu</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100vh', background: LIGHT_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: '700', color: DARK }}>Vedayu</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Growth Partner Program</div>
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '440px', boxShadow: '0 4px 24px rgba(8,145,178,0.08)' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{
                flex: 1, height: '4px', borderRadius: '2px',
                background: s <= step - 1 ? PRIMARY : '#e2e8f0',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px', textAlign: 'right' }}>
            Step {step - 1} of 2
          </p>

          <h1 style={{ fontSize: '20px', fontWeight: '700', color: DARK, margin: '0 0 6px' }}>
            {step === 2 ? 'Your profile' : 'Bank details'}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>
            {step === 2 ? 'Tell us about yourself.' : 'For receiving your earnings. This is stored securely.'}
          </p>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 2 && (
              <>
                <div style={fieldGroup}>
                  <label style={labelStyle}>WhatsApp Number</label>
                  <input value={mobile} readOnly style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Email</label>
                  <input value={email} readOnly style={{ ...inputStyle, background: '#f8fafc', color: '#94a3b8' }} />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    value={name} onChange={e => handleNameChange(e.target.value)}
                    placeholder="Dr. Arjun Sharma" required style={inputStyle}
                  />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Handle <span style={{ color: '#94a3b8', fontWeight: 400 }}>(your unique ID)</span></label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '15px' }}>@</span>
                    <input
                      value={handle}
                      onChange={e => { setHandle(e.target.value); setHandleEdited(true); }}
                      placeholder="DrArjun"
                      required
                      pattern="[a-zA-Z0-9][a-zA-Z0-9-]{2,49}"
                      style={{ ...inputStyle, paddingLeft: '28px' }}
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>3–50 chars, letters/numbers/hyphens only</p>
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Profession</label>
                  <select value={profession} onChange={e => setProfession(e.target.value)} required style={inputStyle}>
                    <option value="">Select…</option>
                    {PROFESSIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>City</label>
                  <input
                    value={city} onChange={e => setCity(e.target.value)}
                    placeholder="Mumbai" required style={inputStyle}
                  />
                </div>
                <button type="submit" style={btnStyle(false)}>
                  Continue →
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Bank Name</label>
                  <input
                    value={bankName} onChange={e => setBankName(e.target.value)}
                    placeholder="State Bank of India" required style={inputStyle}
                  />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Account Number</label>
                  <input
                    type="text" inputMode="numeric"
                    value={bankAccount} onChange={e => setBankAccount(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234567890" required style={inputStyle}
                  />
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>IFSC Code</label>
                  <input
                    value={bankIfsc} onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                    placeholder="SBIN0001234"
                    pattern="[A-Z]{4}0[A-Z0-9]{6}"
                    maxLength={11}
                    required style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                  <button
                    type="button"
                    onClick={() => { setStep(2); setError(''); }}
                    style={{ flex: 1, background: 'none', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', color: '#64748b', cursor: 'pointer', minHeight: '48px' }}
                  >
                    ← Back
                  </button>
                  <button type="submit" disabled={loading} style={{ ...btnStyle(loading), flex: 2, marginTop: 0 }}>
                    {loading ? 'Registering…' : 'Create account'}
                  </button>
                </div>
              </>
            )}
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '20px', marginBottom: 0 }}>
            Already have an account?{' '}
            <a href="/partner/login" style={{ color: PRIMARY, fontWeight: '600', textDecoration: 'none' }}>
              Sign in
            </a>
          </p>
        </div>
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

function btnStyle(disabled) {
  return {
    display: 'block', width: '100%', marginTop: '8px',
    background: disabled ? '#94a3b8' : '#0891B2',
    color: '#fff', border: 'none', borderRadius: '10px',
    padding: '14px', fontSize: '15px', fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer', minHeight: '48px',
  };
}

export async function getServerSideProps({ req }) {
  const partnerId = getGpSession(req);
  if (partnerId) return { redirect: { destination: '/partner', permanent: false } };
  return { props: {} };
}
