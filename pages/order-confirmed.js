import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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

export default function OrderConfirmed() {
  const router  = useRouter();
  const { method, pack, price, name, orderId } = router.query;

  const [visible,      setVisible]      = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [miswakState,  setMiswakState]  = useState('idle');   // idle | paying | done | declined
  const [miswakErr,    setMiswakErr]    = useState('');
  const [custMobile,   setCustMobile]   = useState('');
  const [custEmail,    setCustEmail]    = useState('');

  /* Fade in */
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

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

          {/* ── MISWAK GIFT TEASER (above the fold) ── */}
          {miswakState !== 'done' && miswakState !== 'declined' && (
            <div
              onClick={() => document.getElementById('miswak-upsell')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'linear-gradient(90deg, #2d6b40, #4A7C59)',
                borderRadius: 12, padding: '12px 18px', margin: '4px 0 20px',
                cursor: 'pointer', userSelect: 'none',
                animation: 'miswakPulse 2s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: '1.4rem' }}>🎁</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: '.88rem', lineHeight: 1.3 }}>
                  A free gift is waiting for you!
                </p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,.8)', fontSize: '.75rem' }}>
                  FREE Miswak with your order — tap to claim ↓
                </p>
              </div>
              <span style={{ color: 'rgba(255,255,255,.7)', fontSize: '1.1rem', marginLeft: 'auto' }}>↓</span>
            </div>
          )}

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

          {/* ──────────────────────────────────────────── */}
          {/*   MISWAK POST-PURCHASE UPSELL               */}
          {/* ──────────────────────────────────────────── */}

          {miswakState === 'done' ? (
            /* ── Success state ── */
            <div id="miswak-upsell" style={{
              background: 'linear-gradient(135deg, #F0F9F3 0%, #e6f4ea 100%)',
              border: '2px solid #4A7C59', borderRadius: 16,
              padding: '20px 24px', margin: '24px 0', textAlign: 'center',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🌿</div>
              <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1.05rem', color: '#2d6b40' }}>
                Miswak Added to Your Order!
              </p>
              <p style={{ margin: 0, fontSize: '.85rem', color: '#4A7C59', lineHeight: 1.6 }}>
                A FREE Premium Miswak has been packed into your box.<br />
                You'll receive a separate email confirmation shortly.
              </p>
            </div>

          ) : miswakState !== 'declined' && (
            /* ── Offer card ── */
            <div id="miswak-upsell" style={{
              background: 'linear-gradient(135deg, #f7fef9 0%, #edf7f0 100%)',
              border: '2px solid #4A7C59', borderRadius: 16,
              margin: '24px 0', overflow: 'hidden',
            }}>
              {/* Header ribbon */}
              <div style={{
                background: 'linear-gradient(90deg, #2d6b40, #4A7C59)',
                padding: '10px 20px', textAlign: 'center',
              }}>
                <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: '.88rem', letterSpacing: .5 }}>
                  🎁 SPECIAL ONE-TIME OFFER — Just For You!
                </p>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 20px 0' }}>

                {/* Product image + copy */}
                <div style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}>
                  {/* Image */}
                  <div style={{
                    flex: '0 0 auto', width: 120, borderRadius: 12, overflow: 'hidden',
                    border: '1px solid #c6e6cc', background: '#fff',
                  }}>
                    <Image
                      src="/images/miswak-product.jpg"
                      alt="Free Premium Miswak"
                      width={120}
                      height={120}
                      style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Copy */}
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1rem', color: '#1a5c2a' }}>
                      FREE Premium Miswak Stick
                    </p>
                    <p style={{ margin: '0 0 10px', fontSize: '.78rem', color: '#4A7C59' }}>
                      Ancient natural toothbrush — trusted for centuries
                    </p>

                    {/* Feature pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {['🌿 100% Organic', '🦷 Antibacterial', '💨 Freshens Breath', '🔒 Individually Sealed'].map(f => (
                        <span key={f} style={{
                          background: '#d4edda', color: '#1a5c2a',
                          padding: '3px 10px', borderRadius: 20,
                          fontSize: '.7rem', fontWeight: 600,
                        }}>{f}</span>
                      ))}
                    </div>

                    {/* Shipping note */}
                    <div style={{
                      background: '#FFF8E1', border: '1px solid #C9A84C',
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <p style={{ margin: 0, fontSize: '.78rem', color: '#6D4C00', lineHeight: 1.5 }}>
                        Just pay <strong>₹50 shipping</strong> — that&apos;s it.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {miswakErr && (
                  <p style={{ margin: '12px 0 0', fontSize: '.78rem', color: '#e53e3e', textAlign: 'center' }}>
                    ⚠️ {miswakErr}
                  </p>
                )}

                {/* CTAs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 0 20px' }}>
                  <button
                    onClick={handleMiswakPayment}
                    disabled={miswakState === 'paying'}
                    style={{
                      background: miswakState === 'paying' ? '#9CBDA8' : 'linear-gradient(135deg, #2d6b40, #4A7C59)',
                      color: '#fff', border: 'none', borderRadius: 10,
                      padding: '14px 20px', fontSize: '.95rem', fontWeight: 800,
                      cursor: miswakState === 'paying' ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(45,107,64,.3)',
                      transition: 'all .2s',
                    }}
                  >
                    {miswakState === 'paying' ? '⏳ Opening Payment…' : '✅ Yes! Add Free Miswak — Pay ₹50 Shipping'}
                  </button>

                  <button
                    onClick={() => setMiswakState('declined')}
                    disabled={miswakState === 'paying'}
                    style={{
                      background: 'transparent', color: '#999',
                      border: 'none', fontSize: '.78rem',
                      cursor: 'pointer', padding: '4px',
                      textDecoration: 'underline',
                    }}
                  >
                    No thanks, I don&apos;t want the free miswak
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── USAGE REMINDER ── */}
          <div style={{ background: '#F0F9F3', border: '1px solid #4A7C59', borderRadius: 10, padding: '14px 18px', textAlign: 'left', marginBottom: 24, fontSize: '.84rem', color: '#2d6b40' }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>📋 Quick Reminder — How to Use Your Vijaysar Glass</strong>
            <ol style={{ paddingLeft: 18, lineHeight: 2 }}>
              <li>Fill with room temperature water</li>
              <li>Keep overnight (6–8 hours)</li>
              <li>Drink the infused water each morning</li>
              <li>Rinse with plain water &amp; dry after each use</li>
            </ol>
          </div>

          {/* ── Referral share ── */}
          {orderId && (
            <div style={{
              background: '#FFF8E1', border: '2px solid #C9A84C',
              borderRadius: 14, padding: '18px 20px', marginBottom: 16, textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '.95rem', color: '#5C3D1E' }}>
                🎁 Give ₹50 off to a friend!
              </p>
              <p style={{ margin: '0 0 14px', fontSize: '.78rem', color: '#6D4C00', lineHeight: 1.5 }}>
                Share your link — they get ₹50 off automatically when they order.
              </p>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hey! I just ordered a Vijaysar Wooden Glass from Vedayu — it's amazing for blood sugar & diabetes care! 🌿\n\nYou'll get ₹50 off automatically with my link:\nhttps://vedayulife.com/?ref=${orderId}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#25D366', color: '#fff', textDecoration: 'none',
                  padding: '11px 22px', borderRadius: 10,
                  fontWeight: 700, fontSize: '.88rem',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.122 1.533 5.85L.057 23.927a.5.5 0 0 0 .609.609l6.127-1.476A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.805 9.805 0 0 1-5.021-1.378l-.36-.214-3.733.899.916-3.635-.235-.374A9.797 9.797 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
                Share on WhatsApp
              </a>
            </div>
          )}

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
