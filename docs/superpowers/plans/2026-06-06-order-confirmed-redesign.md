# Order Confirmation Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow centred card with a responsive two-column desktop layout and a mobile-first single-column layout that keeps offers visible via sticky bar + teaser rows.

**Architecture:** Full rewrite of the JSX return in `pages/order-confirmed.js`. New `.oc-*` CSS classes added to `styles/globals.css` handle the grid, sticky bar, and mobile/desktop visibility toggling. Locale files get three new keys. All existing state, analytics, and payment logic is untouched.

**Tech Stack:** Next.js 14 Pages Router, next-i18next, inline styles (existing pattern) + new CSS classes in globals.css.

---

## File Map

| File | Change |
|---|---|
| `public/locales/{en,hi,ta,te}/common.json` | Add 3 new i18n keys |
| `styles/globals.css` | Replace old `.confirm-*` classes with `.oc-*` layout classes |
| `pages/order-confirmed.js` | Full JSX rewrite of the return statement |

---

## Task 1 — Add i18n keys

**Files:**
- Modify: `public/locales/en/common.json`
- Modify: `public/locales/hi/common.json`
- Modify: `public/locales/ta/common.json`
- Modify: `public/locales/te/common.json`

- [ ] **Step 1: Add keys to all 4 locale files**

Run this script:

```bash
python3 << 'EOF'
import json

updates = {
  'en': {
    "order_confirmed.banner_subtitle": "Your order is confirmed and being prepared.",
    "order_confirmed.order_summary_header": "Order Summary",
    "order_confirmed.miswak_claim_btn": "Claim ↓",
  },
  'hi': {
    "order_confirmed.banner_subtitle": "आपका ऑर्डर कन्फर्म हो गया है और तैयार किया जा रहा है।",
    "order_confirmed.order_summary_header": "ऑर्डर सारांश",
    "order_confirmed.miswak_claim_btn": "क्लेम करें ↓",
  },
  'ta': {
    "order_confirmed.banner_subtitle": "உங்கள் ஆர்டர் உறுதிப்படுத்தப்பட்டு தயாரிக்கப்படுகிறது.",
    "order_confirmed.order_summary_header": "ஆர்டர் சுருக்கம்",
    "order_confirmed.miswak_claim_btn": "கோர ↓",
  },
  'te': {
    "order_confirmed.banner_subtitle": "మీ ఆర్డర్ నిర్ధారించబడింది మరియు సిద్ధం చేయబడుతోంది.",
    "order_confirmed.order_summary_header": "ఆర్డర్ సారాంశం",
    "order_confirmed.miswak_claim_btn": "క్లెయిమ్ చేయండి ↓",
  },
}

for locale, keys in updates.items():
    path = f'public/locales/{locale}/common.json'
    with open(path) as f:
        d = json.load(f)
    d.update(keys)
    with open(path, 'w') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
    print(f'{locale}: ok')
EOF
```

- [ ] **Step 2: Verify all locales are in sync**

```bash
python3 -c "
import json
with open('public/locales/en/common.json') as f: en = set(json.load(f).keys())
for loc in ['hi','ta','te']:
    d = set(json.load(open(f'public/locales/{loc}/common.json')).keys())
    missing = en - d
    if missing: print(f'{loc} MISSING: {sorted(missing)}')
    else: print(f'{loc}: ok')
"
```

Expected: all three lines print `ok`.

- [ ] **Step 3: Commit**

```bash
git add public/locales/en/common.json public/locales/hi/common.json public/locales/ta/common.json public/locales/te/common.json
git commit -m "feat: add order-confirmed redesign i18n keys"
```

---

## Task 2 — CSS classes in globals.css

**Files:**
- Modify: `styles/globals.css` (around line 659 — the `CONFIRMATION PAGE` section)

- [ ] **Step 1: Replace the old confirmation CSS block**

Find the block that starts with `/* CONFIRMATION PAGE */` (around line 657 in globals.css) and ends before `/* TOAST NOTIFICATION */`. Replace the entire block with the following:

```css
/* ====================================================
   CONFIRMATION PAGE
   ==================================================== */

/* Banner — full-width green gradient */
.oc-banner {
  background: linear-gradient(135deg, #2d6b40 0%, #4A7C59 100%);
  color: #fff; text-align: center; padding: 24px 20px 28px;
}
.oc-banner h1 { font-size: 1.45rem; font-weight: 800; margin-bottom: 6px; color: #fff; }
.oc-banner > p { font-size: .9rem; opacity: .88; line-height: 1.5; margin-bottom: 0; }
.oc-banner-icon { font-size: 2.8rem; margin-bottom: 8px; }
.oc-order-pill {
  display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
  background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3);
  border-radius: 40px; padding: 8px 18px; margin-top: 14px;
  font-size: .82rem; font-weight: 700;
}
.oc-order-pill-label { opacity: .8; }
.oc-order-pill-id { font-family: monospace; font-size: .95rem; letter-spacing: 1px; }
.oc-copy-btn {
  background: rgba(255,255,255,.25); border: none; color: #fff;
  border-radius: 20px; padding: 4px 12px; font-size: .72rem;
  font-weight: 600; cursor: pointer;
}

/* Info strip — white bar below banner */
.oc-info-strip {
  background: #fff; border-bottom: 1px solid #e8e0d5;
  padding: 11px 20px;
  display: flex; align-items: center; justify-content: center;
  gap: 20px; flex-wrap: wrap; font-size: .78rem; color: #8a7060;
}
.oc-info-strip span { display: flex; align-items: center; gap: 5px; }
.oc-info-strip strong { color: #3d2b1f; }

/* Grid — single column mobile, two column desktop */
.oc-grid {
  max-width: 1100px; margin: 0 auto;
  padding: 24px 16px 90px; /* 90px bottom clears sticky bar on mobile */
  display: grid; grid-template-columns: 1fr; gap: 14px;
}

/* Card */
.oc-card {
  background: #fff; border-radius: 14px; overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,.06); margin-bottom: 14px;
}
.oc-card:last-child { margin-bottom: 0; }
.oc-card-header {
  padding: 13px 20px; border-bottom: 1px solid #f0ebe3;
  font-size: .75rem; font-weight: 800;
  color: #5C3D1E; text-transform: uppercase; letter-spacing: .6px;
}
.oc-card-body { padding: 20px; }

/* Detail rows inside Order Summary card */
.oc-detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 11px 0; border-bottom: 1px solid #f5f0e8;
  font-size: .88rem; gap: 12px;
}
.oc-detail-row:last-child { border-bottom: none; padding-bottom: 0; }
.oc-detail-row:first-child { padding-top: 0; }
.oc-detail-label { color: #8a7060; font-weight: 500; white-space: nowrap; }
.oc-detail-value { color: #3d2b1f; font-weight: 600; text-align: right; }
.oc-dispatch-badge {
  display: inline-flex; align-items: center; gap: 4px;
  background: #e8f5e9; color: #2d6b40;
  border-radius: 20px; padding: 3px 10px; font-size: .78rem; font-weight: 700;
}

/* Numbered steps — How to Use */
.oc-step-list { list-style: none; padding: 0; margin: 0; }
.oc-step-list li {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 0; border-bottom: 1px solid #f5f0e8;
  font-size: .88rem; color: #3d2b1f; line-height: 1.4;
}
.oc-step-list li:last-child { border-bottom: none; padding-bottom: 0; }
.oc-step-list li:first-child { padding-top: 0; }
.oc-step-num {
  width: 24px; height: 24px; flex-shrink: 0;
  background: #2d6b40; color: #fff; border-radius: 50%;
  font-size: .72rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

/* Teaser rows — mobile only inline anchors */
.oc-teaser {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-radius: 12px;
  margin-bottom: 14px; cursor: pointer; user-select: none;
}
.oc-teaser-green { background: linear-gradient(90deg,#f0f9f4,#e4f5ea); border: 1.5px solid #4A7C59; }
.oc-teaser-gold  { background: linear-gradient(90deg,#fffbf0,#fff3d0); border: 1.5px solid #C9A84C; }
.oc-teaser-icon  { font-size: 1.3rem; }
.oc-teaser-text  { flex: 1; }
.oc-teaser-text strong { display: block; font-size: .82rem; margin-bottom: 1px; }
.oc-teaser-green .oc-teaser-text strong { color: #1a5c2a; }
.oc-teaser-gold  .oc-teaser-text strong { color: #5C3D1E; }
.oc-teaser-text span { font-size: .72rem; }
.oc-teaser-green .oc-teaser-text span { color: #4A7C59; }
.oc-teaser-gold  .oc-teaser-text span { color: #8a6500; }
.oc-teaser-chevron { font-size: 1rem; flex-shrink: 0; }
.oc-teaser-green .oc-teaser-chevron { color: #4A7C59; }
.oc-teaser-gold  .oc-teaser-chevron { color: #C9A84C; }

/* Sticky bottom bar — mobile only */
.oc-sticky-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: linear-gradient(135deg, #2d6b40, #4A7C59);
  color: #fff; padding: 12px 18px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  box-shadow: 0 -4px 20px rgba(45,107,64,.35);
  z-index: 100; cursor: pointer;
}
.oc-sticky-bar-text strong { display: block; font-size: .85rem; font-weight: 800; }
.oc-sticky-bar-text span   { font-size: .72rem; opacity: .85; }
.oc-sticky-bar-btn {
  background: #fff; color: #2d6b40; border: none;
  border-radius: 20px; padding: 8px 16px;
  font-size: .78rem; font-weight: 800; cursor: pointer; white-space: nowrap; flex-shrink: 0;
}

/* CTA strip */
.oc-cta-strip { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }

/* ── Desktop layout (≥ 768px) ── */
@media (min-width: 768px) {
  .oc-grid {
    grid-template-columns: 1fr 380px;
    align-items: start;
    padding: 32px 24px 60px;
    gap: 20px;
  }
  .oc-right        { position: sticky; top: 24px; align-self: start; }
  .oc-mobile-only  { display: none !important; }
  .oc-sticky-bar   { display: none !important; }
}

/* ── Mobile (< 768px) ── */
@media (max-width: 767px) {
  .oc-right { display: none !important; }
}
```

- [ ] **Step 2: Add dark-mode overrides for new classes**

Find the dark-mode block that contains `/* Confirm page */` (around line 1183) and replace the three lines inside it:

```css
  /* Confirm page */
  .oc-card        { background: #1E1508 !important; }
  .oc-card-header { border-bottom-color: #3A2810 !important; }
  .oc-detail-row  { border-bottom-color: #3A2810 !important; }
  .oc-info-strip  { background: #1E1508 !important; border-bottom-color: #3A2810 !important; }
  .oc-step-list li { border-bottom-color: #3A2810 !important; }
```

- [ ] **Step 3: Commit**

```bash
git add styles/globals.css
git commit -m "feat: add oc-* CSS classes for order-confirmed redesign"
```

---

## Task 3 — Rewrite order-confirmed.js JSX

**Files:**
- Modify: `pages/order-confirmed.js`

The imports, all state variables, all `useEffect` hooks, `handleMiswakPayment`, `copyOrderId`, and all computed values (`isCOD`, `priceStr`, `dispatchValue`, `WA_NUM`, `waMessage`) stay **exactly as they are**. Only the `return (...)` statement is replaced.

- [ ] **Step 1: Replace the entire return statement**

Delete everything from `return (` through the closing `);` at the end of the component and replace with:

```jsx
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* WhatsApp referral message */
  const refMsg = encodeURIComponent(
    `Hey! I just ordered a Vijaysar Wooden Glass from Vedayu — it's amazing for blood sugar & diabetes care! 🌿\n\nYou'll get ₹50 off automatically with my link:\nhttps://vedayulife.com/?ref=${orderId}`
  );

  /* Shared miswak card — rendered in both mobile zone and desktop right column */
  const MiswakCard = ({ id }) => miswakState === 'done' ? (
    <div id={id} style={{ background: 'linear-gradient(135deg,#F0F9F3,#e6f4ea)', border: '2px solid #4A7C59', borderRadius: 16, padding: '20px 24px', marginBottom: 16, textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🌿</div>
      <p style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1.05rem', color: '#2d6b40' }}>{t('order_confirmed.miswak_added_title')}</p>
      <p style={{ margin: 0, fontSize: '.85rem', color: '#4A7C59', lineHeight: 1.6 }}>{t('order_confirmed.miswak_added_desc')}</p>
    </div>
  ) : miswakState !== 'declined' ? (
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
  ) : null;

  /* Shared referral card */
  const ReferralCard = ({ id }) => orderId ? (
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
  ) : null;

  /* Shared bottom CTAs */
  const BottomCTAs = () => (
    <>
      <div className="oc-cta-strip">
        <a href={`https://wa.me/91${WA_NUM}?text=${waMessage}`} target="_blank" rel="noopener noreferrer" className="btn btn-green btn-full">
          {t('order_confirmed.whatsapp_track_cta')}
        </a>
        <a href="/" className="btn btn-outline btn-full">{t('order_confirmed.back_home')}</a>
      </div>
      <p style={{ marginTop: 8, fontSize: '.72rem', color: 'var(--vd-text-light)', lineHeight: 1.6, textAlign: 'center' }}>
        <em>{t('order_confirmed.disclaimer')}</em>
      </p>
    </>
  );

  return (
    <>
      <Head>
        <title>{t('order_confirmed.page_title')}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {/* ── SUCCESS BANNER ── */}
      <div className="oc-banner" style={{ opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
        <div className="oc-banner-icon">{isCOD ? '📦' : '🎉'}</div>
        <h1>{isCOD ? t('order_confirmed.order_placed_title') : t('order_confirmed.payment_success_title')}</h1>
        <p>{t('order_confirmed.banner_subtitle', { name: name || '' })}</p>
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

      {/* ── INFO STRIP ── */}
      <div className="oc-info-strip">
        <span>📦 <strong>{t('order_confirmed.delivery_value')}</strong></span>
        <span>🚚 <strong>{dispatchValue}</strong></span>
        <span>💬 <strong>{t('order_confirmed.support_value')}</strong></span>
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
                [t('order_confirmed.product_label'), t('order_confirmed.product_name'), false],
                ...(pack     ? [[t('order_confirmed.pack_label'),     pack,     false]] : []),
                ...(priceStr ? [[t('order_confirmed.amount_label'),   isCOD ? t('order_confirmed.amount_cod', { price: priceStr }) : t('order_confirmed.amount_prepaid', { price: priceStr }), false]] : []),
                [t('order_confirmed.delivery_label'), t('order_confirmed.delivery_value'), false],
                [t('order_confirmed.dispatch_label'), dispatchValue, true],
                [t('order_confirmed.support_label'),  t('order_confirmed.support_value'),  false],
              ].map(([k, v, isBadge]) => (
                <div className="oc-detail-row" key={k}>
                  <span className="oc-detail-label">{k}</span>
                  <span className="oc-detail-value">
                    {isBadge ? <span className="oc-dispatch-badge">🚚 {v}</span> : v}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
            <MiswakCard id="miswak-upsell-mobile" />
            <ReferralCard id="referral-share-mobile" />
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

          {/* Mobile-only: CTA buttons + disclaimer */}
          <div className="oc-mobile-only">
            <BottomCTAs />
          </div>

        </div>

        {/* ═══ RIGHT COLUMN (desktop only, sticky) ═══ */}
        <div className="oc-right">
          <MiswakCard id="miswak-upsell-desktop" />
          <ReferralCard id="referral-share-desktop" />
          <BottomCTAs />
        </div>

      </div>

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
```

- [ ] **Step 2: Verify the dev server compiles cleanly**

```bash
npm run dev 2>&1 | head -30
```

Expected: no errors, "Ready" or "compiled successfully" message. Fix any JSX syntax errors before continuing.

- [ ] **Step 3: Visual check — mobile (375px)**

Open `http://localhost:3000/order-confirmed?method=cod&pack=Pack%20of%201&price=499&name=Test&orderId=VED-TEST01` in a browser at 375px width.

Verify:
- ✅ Green banner with order ID pill and copy button
- ✅ White info strip below banner
- ✅ Order Summary card with dispatch badge
- ✅ Green teaser row (miswak) visible immediately below summary
- ✅ Gold teaser row (referral) below that
- ✅ Full miswak offer card below teasers
- ✅ How to Use card with numbered steps
- ✅ WhatsApp + Back to Home buttons
- ✅ Sticky green bar pinned to bottom with "Claim ↓" button
- ✅ Tapping teaser rows scrolls to the offer cards
- ✅ Tapping sticky bar scrolls to miswak offer
- ✅ Accepting/declining miswak hides the sticky bar

- [ ] **Step 4: Visual check — desktop (1200px)**

Resize to 1200px.

Verify:
- ✅ Banner and info strip remain full-width
- ✅ Two-column grid: left = summary + how-to-use, right = miswak offer + referral + CTAs
- ✅ Right column stays sticky while scrolling left column
- ✅ No sticky bottom bar visible
- ✅ No teaser rows visible (hidden by `oc-mobile-only`)
- ✅ Offer cards in right column respond to miswak accept/decline correctly

- [ ] **Step 5: Check all languages**

Visit the page with `?locale=hi`, `?locale=ta`, `?locale=te` query params (or switch locale via site nav). Confirm no untranslated keys appear (no raw key strings like `order_confirmed.banner_subtitle`).

- [ ] **Step 6: Commit**

```bash
git add pages/order-confirmed.js
git commit -m "feat: responsive order-confirmed redesign with sticky bar and two-column desktop layout"
```
