import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(router.query.from || '/admin');
      } else {
        const j = await res.json();
        setError(j.error || 'Wrong password');
        setPassword('');
      }
    } catch { setError('Something went wrong. Try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      <Head>
        <title>Admin — Vedayu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{ minHeight:'100vh', background:'#f5f0e8', display:'flex',
        alignItems:'center', justifyContent:'center', fontFamily:'system-ui, sans-serif', padding:24 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:'40px 36px',
          boxShadow:'0 4px 24px rgba(0,0,0,.08)', width:'100%', maxWidth:380, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'#5C3D1E',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 16px', fontSize:'1.6rem' }}>🌿</div>
          <h1 style={{ margin:'0 0 4px', fontSize:'1.3rem', fontWeight:800, color:'#1a1a1a' }}>
            Vedayu Admin
          </h1>
          <p style={{ margin:'0 0 28px', fontSize:'.82rem', color:'#888' }}>
            Enter your admin password to continue
          </p>
          <form onSubmit={submit}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Admin password" autoFocus required
              style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px',
                fontSize:'.95rem', border:`1.5px solid ${error ? '#e57373' : '#e0e0e0'}`,
                borderRadius:10, outline:'none', marginBottom: error ? 8 : 16 }} />
            {error && <p style={{ margin:'0 0 12px', fontSize:'.78rem', color:'#c62828', fontWeight:600 }}>{error}</p>}
            <button type="submit" disabled={loading || !password}
              style={{ width:'100%', padding:12, background: loading || !password ? '#c4a882' : '#5C3D1E',
                color:'#fff', border:'none', borderRadius:10, fontSize:'.95rem', fontWeight:700,
                cursor: loading || !password ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Checking…' : 'Unlock →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
