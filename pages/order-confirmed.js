import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function OrderConfirmed() {
  const router  = useRouter();
  const { method, pack, price, name } = router.query;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in after mount
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const isCOD     = method === 'cod';
  const priceStr  = price ? '₹' + Number(price).toLocaleString('en-IN') : '';
  const WA_NUM    = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999';

  return (
    <>
      <Head>
        <title>Order Confirmed — Vedayu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="confirm-page" style={{ opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
        <div className="confirm-card">

          <div className="confirm-icon">{isCOD ? '📦' : '🎉'}</div>

          <h1>
            {isCOD ? 'Order Placed!' : 'Payment Successful!'}
          </h1>

          <p>
            {name ? `Thank you, ${name}! ` : 'Thank you! '}
            {isCOD
              ? 'Your Cash on Delivery order has been confirmed. Please keep the payment ready when your order arrives.'
              : 'Your payment was successful. Your Vijaysar Wooden Glass is being prepared for dispatch.'}
          </p>

          <div className="confirm-details">
            {[
              ['Product',   'Vedayu Vijaysar Wooden Glass'],
              ...(pack   ? [['Pack',    pack]]         : []),
              ...(priceStr? [['Amount', isCOD ? `${priceStr} (Pay on delivery)` : `${priceStr} (Paid)`]] : []),
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

          {/* Usage reminder */}
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
              href={`https://wa.me/91${WA_NUM}?text=Hi%20Vedayu%2C%20I%20just%20placed%20an%20order%20for%20the%20Vijaysar%20Wooden%20Glass.%20My%20name%20is%20${encodeURIComponent(name||'')}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-green btn-full"
            >
              💬 WhatsApp Us for Order Updates
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
