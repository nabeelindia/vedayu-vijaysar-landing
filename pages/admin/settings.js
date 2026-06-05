// pages/admin/settings.js
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

export default function AdminSettings() {
  const [subbed,  setSubbed]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState('');
  const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(s => setSubbed(!!s))
    );
  }, []);

  const subscribe = async () => {
    setLoading(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC,
      });
      const { endpoint, keys } = sub.toJSON();
      await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });
      setSubbed(true); setMsg('Subscribed! You will receive push notifications.');
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubbed(false); setMsg('Unsubscribed.');
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const testPush = async () => {
    setLoading(true); setMsg('');
    await fetch('/api/admin/push-test', { method: 'POST' });
    setMsg('Test notification sent!');
    setLoading(false);
  };

  return (
    <AdminLayout title="Settings">
      <PageHeader title="Settings" />
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', maxWidth:480 }}>
        <h3 style={{ margin:'0 0 6px', fontSize:'.85rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>
          Push Notifications
        </h3>
        <p style={{ margin:'0 0 16px', fontSize:'.85rem', color:'#555' }}>
          Receive a browser notification when a new order arrives or an RTO is triggered.
          {!VAPID_PUBLIC && <span style={{ color:'#c00' }}> NEXT_PUBLIC_VAPID_PUBLIC_KEY not set.</span>}
        </p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {!subbed
            ? <button onClick={subscribe} disabled={loading || !VAPID_PUBLIC}
                style={{ padding:'9px 18px', background:'#5C3D1E', color:'#fff',
                  border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
                {loading ? '…' : '🔔 Enable notifications'}
              </button>
            : <button onClick={unsubscribe} disabled={loading}
                style={{ padding:'9px 18px', background:'#fff', color:'#C62828',
                  border:'1.5px solid #C62828', borderRadius:8, fontSize:'.82rem',
                  fontWeight:700, cursor:'pointer' }}>
                {loading ? '…' : 'Disable'}
              </button>
          }
          {subbed && (
            <button onClick={testPush} disabled={loading}
              style={{ padding:'9px 18px', background:'#f0ede8', color:'#5C3D1E',
                border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
              {loading ? '…' : 'Send test'}
            </button>
          )}
        </div>
        {msg && <p style={{ marginTop:12, fontSize:'.82rem', color:'#4A7C59' }}>{msg}</p>}
      </div>
    </AdminLayout>
  );
}
