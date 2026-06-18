import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import ChatWidget from '../components/ChatWidget';

/* Load Razorpay checkout script on demand */
const loadRazorpay = () =>
  new Promise(resolve => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function MiswakCard({ id, miswakState, miswakErr, handleMiswakPayment, setMiswakState, t }) {
  if (miswakState === 'done') {
    return (
      <div id={id} style={{ background: 'linear-gradient(135deg,#F0F9F3,#e6f4ea)', border: '2px solid #4A7C59', borderRadius: 16, padding: '20px 24px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🌿</div>
        <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1.05rem', color: '#2d6b40' }}>{t('order_confirmed.miswak_added_title')}</p>
        <p style={{ margin: 0, fontSize: '.85rem', color: '#4A7C59', lineHeight: 1.6 }}>{t('order_confirmed.miswak_added_desc')}</p>
      </div>
    );
  }
  if (miswakState === 'declined') return null;
  return (
    <div id={id} style={{ background: 'linear-gradient(135deg,#f7fef9,#edf7f0)', border: '2px solid #4A7C59', borderRadius: 16, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(90deg,#2d6b40,#4A7C59)', padding: '10px 20px', textAlign: 'center' }}>
        <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: '.88rem' }}>{t('order_confirmed.special_offer_ribbon')}</p>
      </div>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 auto', width: 120, borderRadius: 12, overflow: 'hidden', border: '1px solid #c6e6cc', background: '#fff' }}>
            <Image src="/images/miswak-product.jpg" alt="Free Premium Miswak" width={120} height={120} style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1rem', color: '#1a5c2a' }}>{t('order_confirmed.miswak_product_title')}</p>
            <p style={{ margin: '0 0 10px', fontSize: '.78rem', color: '#4A7C59' }}>{t('order_confirmed.miswak_product_subtitle')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {[t('order_confirmed.miswak_pill_organic'), t('order_confirmed.miswak_pill_antibacterial'), t('order_confirmed.miswak_pill_fresh'), t('order_confirmed.miswak_pill_sealed')].map(f => (
                <span key={f} style={{ background: '#d4edda', color: '#1a5c2a', padding: '3px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 600 }}>{f}</span>
              ))}
            </div>
            <div style={{ background: '#FFF8E1', border: '1px solid #C9A84C', borderRadius: 8, padding: '8px 12px' }}>
              <p style={{ margin: 0, fontSize: '.78rem', color: '#6D4C00', lineHeight: 1.5 }}>{t('order_confirmed.miswak_shipping_note')}</p>
            </div>
          </div>
        </div>
        {miswakErr && <p style={{ margin: '12px 0 0', fontSize: '.78rem', color: '#e53e3e', textAlign: 'center' }}>⚠️ {miswakErr}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0 20px' }}>
          <button
            onClick={handleMiswakPayment}
            disabled={miswakState === 'paying'}
            style={{ background: miswakState === 'paying' ? '#9CBDA8' : 'linear-gradient(135deg,#2d6b40,#4A7C59)', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: '.95rem', fontWeight: 800, cursor: miswakState === 'paying' ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(45,107,64,.3)', transition: 'all .2s' }}
          >
            {miswakState === 'paying' ? t('order_confirmed.miswak_paying_btn') : t('order_confirmed.miswak_pay_btn')}
          </button>
          <button onClick={() => setMiswakState('declined')} disabled={miswakState === 'paying'} style={{ background: 'transparent', color: '#999', border: 'none', fontSize: '.78rem', cursor: 'pointer', padding: '4px', textDecoration: 'underline' }}>
            {t('order_confirmed.miswak_decline')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferralCard({ id, orderId, refMsg, t }) {
  if (!orderId) return null;
  return (
    <div id={id} style={{ background: '#FFF8E1', border: '2px solid #C9A84C', borderRadius: 14, padding: '18px 20px', marginBottom: 16, textAlign: 'center' }}>
      <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '.95rem', color: '#5C3D1E' }}>{t('order_confirmed.referral_title')}</p>
      <p style={{ margin: '0 0 14px', fontSize: '.78rem', color: '#6D4C00', lineHeight: 1.5 }}>{t('order_confirmed.referral_desc')}</p>
      <a
        href={`https://wa.me/?text=${refMsg}`}
        target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#fff', textDecoration: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: '.88rem' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.122 1.533 5.85L.057 23.927a.5.5 0 0 0 .609.609l6.127-1.476A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.021-1.378l-.36-.214-3.733.899.916-3.635-.235-.374A9.797 9.797 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
        {t('order_confirmed.referral_whatsapp')}
      </a>
    </div>
  );
}

function DeliveryTimeline() {
  const steps = [
    { icon: '✓',  label: 'Confirmed', done: true },
    { icon: '📦', label: 'Packed',    done: false },
    { icon: '🚚', label: 'Shipped',   done: false },
    { icon: '🏠', label: 'Delivered', done: false },
  ];
  return (
    <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: '14px 20px', margin: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', marginBottom: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: s.done ? '.8rem' : '.75rem',
                background: s.done ? '#fff' : 'rgba(255,255,255,.2)',
                color: s.done ? '#2d6b40' : 'rgba(255,255,255,.6)',
                fontWeight: 700,
              }}>
                {s.icon}
              </div>
              <span style={{
                fontSize: '.58rem', fontWeight: 700, textAlign: 'center',
                color: s.done ? '#fff' : 'rgba(255,255,255,.6)',
              }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 18,
                background: s.done ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.2)',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function BottomCTAs({ orderId, t }) {
  return (
    <>
      <a href={`/track?order=${orderId || ''}`} className="oc-track-cta">
        {t('order_confirmed.track_order_cta')}
      </a>
      <p style={{ marginTop: 0, fontSize: '.72rem', color: 'var(--vd-text-light)', lineHeight: 1.6, textAlign: 'center' }}>
        <em>{t('order_confirmed.disclaimer')}</em>
      </p>
    </>
  );
}

export default function OrderConfirmed() {
  const router  = useRouter();
  const { t } = useTranslation('common');
  const { method, pack, price, name, orderId, scheduledShipDate, deliveryEst: deliveryEstRaw } = router.query;

  // Strip leading "by " prefix if present (e.g. "by Tue, 24 Jun" → "Tue, 24 Jun")
  const deliveryEstDisplay = deliveryEstRaw
    ? deliveryEstRaw.replace(/^by\s+/i, '')
    : '';

  const [visible,      setVisible]      = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [miswakState,  setMiswakState]  = useState('idle');   // idle | paying | done | declined
  const [miswakErr,    setMiswakErr]    = useState('');
  const [custMobile,   setCustMobile]   = useState('');
  const [custEmail,    setCustEmail]    = useState('');
  const [notifyState,      setNotifyState]      = useState('idle');   // 'idle' | 'requesting' | 'granted' | 'denied'
  const [showNotifyToggle, setShowNotifyToggle] = useState(false);

  /* Fade in */
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  /* Push notification opt-in */
  useEffect(() => {
    const shouldNotify = sessionStorage.getItem('vedayu_notify_orders');
    if (shouldNotify === '1') {
      requestPushPermission().then(setNotifyState);
    } else {
      // Check if browser has already denied — no point showing the button
      const browserPerm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      if (browserPerm === 'denied') {
        setNotifyState('browser-denied');
      }
      setShowNotifyToggle(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function requestPushPermission() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'denied';
    const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC) {
      console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
      return 'denied';
    }
    try {
      setNotifyState('requesting');
      const reg        = await navigator.serviceWorker.register('/sw.js');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'denied';
      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
      await fetch('/api/subscribe-push', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(sub.toJSON()),
      });
      sessionStorage.removeItem('vedayu_notify_orders');
      return 'granted';
    } catch (e) {
      console.error('[Push] Permission request failed:', e);
      return 'denied';
    }
  }

  /* Read customer context (mobile/email) from sessionStorage */
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem('vc_upsell_ctx') || '{}');
      if (d.mobile) { setCustMobile(d.mobile); setCustEmail(d.email || ''); }
    } catch (_) {}
  }, []);

  /* Analytics — Purchase events (fires once query params are available) */
  useEffect(() => {
    if (!price || !orderId) return;

    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Purchase', {
        value: Number(price),
        currency: 'INR',
        content_name: 'Vijaysar Wooden Glass',
        content_ids: ['vijaysar-glass'],
        content_type: 'product',
        order_id: orderId,
      }, { eventID: orderId });
    }

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'purchase', {
        transaction_id: orderId,
        value: Number(price),
        currency: 'INR',
        payment_type: method === 'cod' ? 'Cash on Delivery' : 'Prepaid (Razorpay)',
        items: [{
          item_id: 'vijaysar-glass',
          item_name: 'Vedayu Vijaysar Wooden Glass',
          item_category: 'Ayurvedic Wellness',
          price: Number(price),
          quantity: 1,
        }],
      });
    }
  }, [price, orderId, method]);

  /* ── Miswak upsell payment ── */
  const handleMiswakPayment = async () => {
    setMiswakState('paying');
    setMiswakErr('');
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Payment gateway failed to load.');

      const res  = await fetch('/api/miswak-upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, name, mobile: custMobile, email: custEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create order');

      const rzp = new window.Razorpay({
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount:      5000, // ₹50 in paise
        currency:    'INR',
        order_id:    data.razorpayOrderId,
        name:        'Vedayu',
        description: 'FREE Miswak — ₹50 shipping charge',
        image:       '/images/logo.png',
        prefill: {
          name:    name   || '',
          contact: custMobile ? `+91${custMobile}` : '',
          email:   custEmail  || '',
        },
        theme: { color: '#2d6b40' },
        handler: async (response) => {
          try {
            const vRes = await fetch('/api/verify-miswak', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                orderId, name, mobile: custMobile, email: custEmail,
              }),
            });
            if (!vRes.ok) throw new Error('Verification failed');
          } catch (_) { /* non-blocking */ }
          setMiswakState('done');
        },
        modal: {
          ondismiss: () => {
            setMiswakState('idle');
            setMiswakErr('Payment cancelled — you can try again or skip.');
          },
        },
      });
      rzp.open();
    } catch (e) {
      setMiswakState('idle');
      setMiswakErr(e.message || 'Something went wrong. Please try again.');
    }
  };

  const isCOD    = method === 'cod';
  const priceStr = price ? '₹' + Number(price).toLocaleString('en-IN') : '';
  const PACK_KEY_MAP = { 'Pack of 1': 'order_confirmed.pack_of_1', 'Pack of 2': 'order_confirmed.pack_of_2', 'Pack of 5': 'order_confirmed.pack_of_5' };
  const packDisplay = pack ? t(PACK_KEY_MAP[pack] || 'order_confirmed.pack_of_1') : pack;
  const dispatchValue = scheduledShipDate
    ? t('order_confirmed.dispatch_scheduled', { date: new Date(scheduledShipDate + 'T00:00:00+05:30').toLocaleDateString(router.locale === 'hi' ? 'hi-IN' : router.locale === 'ta' ? 'ta-IN' : router.locale === 'te' ? 'te-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) })
    : t('order_confirmed.dispatch_value');
  const WA_NUM   = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999';

  const copyOrderId = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const waMessage = `Hi Vedayu! I just placed an order.%0AOrder ID: ${orderId || 'N/A'}%0AName: ${encodeURIComponent(name || '')}%0AProduct: Vijaysar Wooden Glass`;

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const refMsg = encodeURIComponent(
    `Hey! I just ordered a Vijaysar Wooden Glass from Vedayu — it's amazing for blood sugar & diabetes care! 🌿\n\nYou'll get ₹50 off automatically with my link:\nhttps://vedayulife.com/?ref=${orderId}`
  );

  return (
    <>
      <Head>
        <title>{t('order_confirmed.page_title')}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {/* ── STICKY HEADER ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
        background: '#fff', borderBottom: '1px solid #e8d5b0',
        boxShadow: '0 2px 8px rgba(92,61,30,.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
      }}>
        <a href="/" style={{ fontWeight: 800, fontSize: '1rem', color: '#5C3D1E', textDecoration: 'none', letterSpacing: -.3 }}>
          🌿 Vedayu
        </a>
        {orderId && (
          <span style={{ fontSize: '.78rem', color: '#8a7060', fontFamily: 'monospace', fontWeight: 600 }}>
            {orderId}
          </span>
        )}
        <a href="/" style={{ fontSize: '.82rem', fontWeight: 700, color: '#5C3D1E', textDecoration: 'none', background: '#fdf6ec', border: '1px solid #e8d5b0', borderRadius: 20, padding: '5px 14px' }}>
          {t('order_confirmed.back_home')}
        </a>
      </header>
      <div style={{ height: 52 }} aria-hidden="true" />

      {/* ── SUCCESS BANNER ── */}
      <div className="oc-banner" style={{ opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
        <div className="oc-banner-icon">{isCOD ? '📦' : '🎉'}</div>
        <h1>{isCOD ? t('order_confirmed.order_placed_title') : t('order_confirmed.payment_success_title')}</h1>
        <p>{t('order_confirmed.banner_subtitle', { name: name || '' })}</p>
        <DeliveryTimeline />
        {orderId && (
          <div className="oc-order-pill">
            <span className="oc-order-pill-label">{t('order_confirmed.order_id_label')}</span>
            <span className="oc-order-pill-id">{orderId}</span>
            <button className="oc-copy-btn" onClick={copyOrderId}>
              {copied ? t('order_confirmed.copied') : t('order_confirmed.copy_order_id')}
            </button>
          </div>
        )}
      </div>

      {/* ── DELIVERY DATE BAND ── */}
      <div style={{
        background: '#fff', borderBottom: '3px solid #2d6b40',
        padding: '12px 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '.82rem', color: '#555' }}>📦 Free shipping · Est. delivery</span>
        {deliveryEstDisplay ? (
          <strong style={{ fontSize: '1rem', color: '#2d6b40' }}>{deliveryEstDisplay}</strong>
        ) : (
          <strong style={{ fontSize: '.9rem', color: '#2d6b40' }}>3–5 business days</strong>
        )}
      </div>

      {/* ── GRID BODY ── */}
      <div className="oc-grid" style={{ opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div className="oc-left">

          {/* Order Summary card */}
          <div className="oc-card">
            <div className="oc-card-header">🧾 {t('order_confirmed.order_summary_header')}</div>
            <div className="oc-card-body">
              {[
                [t('order_confirmed.product_label'), t('order_confirmed.product_name'), false, false],
                ...(pack     ? [[t('order_confirmed.pack_label'),   packDisplay, false, false]] : []),
                ...(priceStr ? [[t('order_confirmed.amount_label'), isCOD ? t('order_confirmed.amount_cod', { price: priceStr }) : t('order_confirmed.amount_prepaid', { price: priceStr }), false, false]] : []),
                [t('order_confirmed.delivery_label'), t('order_confirmed.delivery_value'), false, false],
                ...(deliveryEstDisplay ? [[t('order_confirmed.est_delivery_label'), deliveryEstDisplay, false, true]] : []),
                [t('order_confirmed.dispatch_label'), dispatchValue, true, false],
                [t('order_confirmed.support_label'),  t('order_confirmed.support_value'),  false, false],
              ].map(([k, v, isBadge, isEta]) => (
                <div className="oc-detail-row" key={k}>
                  <span className="oc-detail-label">{k}</span>
                  <span className="oc-detail-value">
                    {isBadge ? <span className="oc-dispatch-badge">🚚 {v}</span>
                     : isEta  ? <span style={{ background: '#fff3e0', color: '#8B4513', borderRadius: 20, padding: '3px 10px', fontSize: '.75rem', fontWeight: 700 }}>📅 {v}</span>
                     : v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isCOD && (
            <p className="oc-cod-call-note" style={{ padding: '0 20px 14px' }}>
              📞 {t('order_confirmed.cod_call_note')}
            </p>
          )}

          {/* Notification opt-in card — only for users who did NOT opt in at checkout */}
          {showNotifyToggle && notifyState !== 'granted' && (
            <div className="oc-notify-card">
              <div className="oc-notify-card-text">
                <p className="oc-notify-card-title">🔔 {t('order_confirmed.notify_card_title')}</p>
                {notifyState === 'browser-denied' ? (
                  <p className="oc-notify-card-desc" style={{ color: '#c0392b' }}>
                    {t('order_confirmed.notify_blocked_msg')}
                  </p>
                ) : (
                  <>
                    <p className="oc-notify-card-desc">{t('order_confirmed.notify_card_desc')}</p>
                    {notifyState === 'denied' && (
                      <p className="oc-notify-card-msg" style={{ color: '#c0392b' }}>{t('order_confirmed.notify_denied_msg')}</p>
                    )}
                  </>
                )}
              </div>
              {notifyState !== 'denied' && notifyState !== 'browser-denied' && (
                <button
                  onClick={() => requestPushPermission().then(setNotifyState)}
                  disabled={notifyState === 'requesting'}
                  style={{
                    flexShrink: 0, padding: '9px 16px', background: 'var(--vd-brown)',
                    color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700,
                    fontSize: '.8rem', cursor: notifyState === 'requesting' ? 'not-allowed' : 'pointer',
                    opacity: notifyState === 'requesting' ? .7 : 1,
                  }}
                >
                  {notifyState === 'requesting' ? '...' : t('order_confirmed.notify_enable_btn')}
                </button>
              )}
            </div>
          )}

          {/* Mobile-only: teaser rows */}
          {miswakState !== 'done' && miswakState !== 'declined' && (
            <div className="oc-teaser oc-teaser-green oc-mobile-only" onClick={() => scrollTo('miswak-upsell-mobile')}>
              <span className="oc-teaser-icon">🎁</span>
              <div className="oc-teaser-text">
                <strong>{t('order_confirmed.miswak_teaser_title')}</strong>
                <span>{t('order_confirmed.miswak_teaser_subtitle')}</span>
              </div>
              <span className="oc-teaser-chevron">↓</span>
            </div>
          )}
          {orderId && (
            <div className="oc-teaser oc-teaser-gold oc-mobile-only" onClick={() => scrollTo('referral-share-mobile')}>
              <span className="oc-teaser-icon">🤝</span>
              <div className="oc-teaser-text">
                <strong>{t('order_confirmed.referral_teaser_title')}</strong>
                <span>{t('order_confirmed.referral_teaser_subtitle')}</span>
              </div>
              <span className="oc-teaser-chevron">↓</span>
            </div>
          )}

          {/* Mobile-only: full offer cards */}
          <div className="oc-mobile-only">
            <MiswakCard id="miswak-upsell-mobile" miswakState={miswakState} miswakErr={miswakErr} handleMiswakPayment={handleMiswakPayment} setMiswakState={setMiswakState} t={t} />
            <ReferralCard id="referral-share-mobile" orderId={orderId} refMsg={refMsg} t={t} />
          </div>

          {/* How to Use card */}
          <div className="oc-card">
            <div className="oc-card-header">{t('order_confirmed.usage_title')}</div>
            <div className="oc-card-body">
              <ul className="oc-step-list">
                {[1, 2, 3, 4].map(n => (
                  <li key={n}>
                    <span className="oc-step-num">{n}</span>
                    {t(`order_confirmed.usage_step${n}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA buttons + disclaimer — below How to Use, always in left column */}
          <BottomCTAs orderId={orderId} t={t} />

        </div>

        {/* ═══ RIGHT COLUMN (desktop only, sticky) ═══ */}
        <div className="oc-right">
          <MiswakCard id="miswak-upsell-desktop" miswakState={miswakState} miswakErr={miswakErr} handleMiswakPayment={handleMiswakPayment} setMiswakState={setMiswakState} t={t} />
          <ReferralCard id="referral-share-desktop" orderId={orderId} refMsg={refMsg} t={t} />
        </div>

      </div>

      <ChatWidget />

      {/* ── STICKY BOTTOM BAR (mobile only) ── */}
      {miswakState !== 'done' && miswakState !== 'declined' && (
        <div className="oc-sticky-bar" onClick={() => scrollTo('miswak-upsell-mobile')}>
          <div className="oc-sticky-bar-text">
            <strong>{t('order_confirmed.miswak_teaser_title')}</strong>
            <span>{t('order_confirmed.miswak_teaser_subtitle')}</span>
          </div>
          <button className="oc-sticky-bar-btn">{t('order_confirmed.miswak_claim_btn')}</button>
        </div>
      )}
    </>
  );
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}
