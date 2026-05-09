import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function OrderConfirmed() {
  const router  = useRouter();
  const { method, pack, price, name, orderId } = router.query;
  const [visible, setVisible] = useState(false);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  /* Meta Pixel — Purchase event (fires once query params are available) */
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
      }, { eventID: orderId }); // eventID deduplicates with server-side CAPI event
    }
  }, [price, orderId]);

  const isCOD    = method === 'cod';
  const priceStr = price ? '₹' + Number(price).toLocaleString('en-IN') : '';
  const WA_NUM   = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999';

  const copyOrderId = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const waMessage = `Hi Vedayu! I just placed an order.%0AOrder ID: ${orderId || 'N/A'}%0AName: ${encodeURIComponent(name || '')}%0AProduct: Vijaysar Wooden Glass`;

  return (
    <>
      <Head>
        <title>Order Confirmed — Vedayu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="confirm-page" style={{ opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
        <div className="confirm-card">

          <div className="confirm-icon">{isCOD ? '📦' : '🎉'}</div>

          <h1>{isCOD ? 'Order Placed!' : 'Payment Successful!'}</h1>

          <p>
            {name ? `Thank you, ${name}! ` : 'Thank you! '}
            {isCOD
              ? 'Your Cash on Delivery order has been confirmed. Please keep the payment ready when your order arrives.'
              : 'Your payment was successful. Your Vijaysar Wooden Glass is being prepared for dispatch.'}
          </p>

          {/* ── ORDER ID BOX ── */}
          {orderId && (
            <div style={{
              background: '#FFF8E1', border: '2px solid #C9A84C',
              borderRadius: 12, padding: '16px 20px', margin: '4px 0 20px',
              textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '.78rem', fontWeight: 700, color: '#6D4C00', textTransform: 'uppercase', letterSpacing: 1 }}>
                📋 Your Order ID
              </p>
              <p style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#5C3D1E', fontFamily: 'monospace', letterSpacing: 1.5, wordBreak: 'break-all' }}>
                {orderId}
              </p>
              <button
                onClick={copyOrderId}
                style={{
                  background: copied ? '#4A7C59' : '#5C3D1E', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '7px 20px',
                  fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'background .2s',
                }}
              >
                {copied ? '✅ Copied!' : '📋 Copy Order ID'}
              </button>
              <p style={{ margin: '10px 0 0', fontSize: '.72rem', color: '#6D4C00' }}>
                Save this ID — share it on WhatsApp for quick order tracking
              </p>
            </div>
          )}

          {/* ── ORDER DETAILS ── */}
          <div className="confirm-details">
            {[
              ['Product',   'Vedayu Vijaysar Wooden Glass'],
              ...(pack    ? [['Pack',    pack]]    : []),
              ...(priceStr? [['Amount',  isCOD ? `${priceStr} (Pay on delivery)` : `${priceStr} (Paid)`]] : []),
              ['Delivery',  'Free — All over India'],
              ['Dispatch',  '1–2 business days'],
              ['Support',   'WhatsApp us anytime'],
            ].map(([k, v]) => (
              <div className="confirm-row" key={k}>
                <span style={{ fontWeight: 600, color: 'var(--vd-dark-brown)' }}>{k}</span>
                <span style={{ color: 'var(--vd-text-light)' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* ── USAGE REMINDER ── */}
          <div style={{ background: '#F0F9F3', border: '1px solid #4A7C59', borderRadius: 10, padding: '14px 18px', textAlign: 'left', marginBottom: 24, fontSize: '.84rem', color: '#2d6b40' }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>📋 Quick Reminder — How to Use</strong>
            <ol style={{ paddingLeft: 18, lineHeight: 2 }}>
              <li>Fill with room temperature water</li>
              <li>Keep overnight (6–8 hours)</li>
              <li>Drink the infused water each morning</li>
              <li>Rinse with plain water &amp; dry after each use</li>
            </ol>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href={`https://wa.me/91${WA_NUM}?text=${waMessage}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-green btn-full"
            >
              💬 WhatsApp Us — Share Order ID for Tracking
            </a>
            <a href="/" className="btn btn-outline btn-full">← Back to Home</a>
          </div>

          <p style={{ marginTop: 20, fontSize: '.72rem', color: 'var(--vd-text-light)', lineHeight: 1.6 }}>
            ⚠️ <em>This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease.</em>
          </p>

        </div>
      </div>
    </>
  );
}
