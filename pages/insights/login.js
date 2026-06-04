import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function InsightsLogin() {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/insights-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const dest = router.query.from || '/insights';
        router.replace(dest);
      } else {
        const j = await res.json();
        setError(j.error || 'Wrong password');
        setPassword('');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Insights — Vedayu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{
        minHeight: '100vh',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        padding: '24px',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 16,
          padding: '40px 36px',
          boxShadow: '0 4px 24px rgba(0,0,0,.08)',
          width: '100%',
          maxWidth: 380,
          textAlign: 'center',
        }}>
          {/* Logo mark */}
          <div style={{
            width: 56, height: 56,
            borderRadius: 14,
            background: '#4A7C59',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '1.6rem',
          }}>
            🌿
          </div>

          <h1 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800, color: '#1a1a1a' }}>
            Vedayu Insights
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: '.82rem', color: '#888' }}>
            Enter your password to continue
          </p>

          <form onSubmit={submit}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                fontSize: '.95rem',
                border: `1.5px solid ${error ? '#e57373' : '#e0e0e0'}`,
                borderRadius: 10,
                outline: 'none',
                marginBottom: error ? 8 : 16,
                transition: 'border-color .15s',
              }}
            />

            {error && (
              <p style={{ margin: '0 0 12px', fontSize: '.78rem', color: '#c62828', fontWeight: 600 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                width: '100%',
                padding: '12px',
                background: loading || !password ? '#a5c4ae' : '#4A7C59',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: '.95rem',
                fontWeight: 700,
                cursor: loading || !password ? 'not-allowed' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {loading ? 'Checking…' : 'Unlock →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
