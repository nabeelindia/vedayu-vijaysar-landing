# Confirmation Page & Admin UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the order confirmation page with a delivery timeline + real ETA, fix the notification CTA, add chat timestamps in admin, improve abandoned cart empty state, and fix customer address lookup to work with mobile-only.

**Architecture:** All changes are isolated to existing files — no new files needed. The delivery ETA is threaded from `index.js` (where it's already computed) through to `order-confirmed.js` via a new `deliveryEst` query param. Admin chat timestamp display is purely additive. Customer lookup gains a mobile-only fallback query in `lib/customer-cache.js`.

**Tech Stack:** Next.js 14 Pages Router, next-i18next v13, Supabase, inline CSS (no CSS modules — existing pattern)

---

## File Map

| File | Change |
|------|--------|
| `pages/index.js` | Append `&deliveryEst=…` to both `router.push` calls (lines ~591, ~673) |
| `pages/order-confirmed.js` | Read `deliveryEst` from query; add timeline to banner; replace info strip with delivery band; update order summary rows; fix notify card for denied state |
| `lib/customer-cache.js` | Add mobile-only fallback in `lookupCustomer` |
| `pages/admin/chats.js` | Show per-message timestamp below each bubble |
| `pages/admin/whatsapp.js` | Show per-message timestamp below each bubble |
| `pages/admin/abandoned.js` | Add informative empty state |
| `public/locales/en/common.json` | Update `support_value`; add `est_delivery_label`, `notify_blocked_msg` |
| `public/locales/hi/common.json` | Same keys |
| `public/locales/ta/common.json` | Same keys |
| `public/locales/te/common.json` | Same keys |

---

## Task 1: Thread `deliveryEst` from checkout to confirmation page

**Files:**
- Modify: `pages/index.js` (lines ~591, ~673)

- [ ] **Step 1: Append `deliveryEst` to COD redirect (line ~591)**

Find this line in `pages/index.js`:
```js
router.push(`/order-confirmed?method=cod&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(data.orderId)}${scheduledDate ? `&scheduledShipDate=${scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}` : ''}`);
```

Replace with:
```js
router.push(`/order-confirmed?method=cod&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(data.orderId)}${scheduledDate ? `&scheduledShipDate=${scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}` : ''}${deliveryEst ? `&deliveryEst=${encodeURIComponent(deliveryEst)}` : ''}`);
```

- [ ] **Step 2: Append `deliveryEst` to prepaid redirect (line ~673)**

Find this line:
```js
router.push(`/order-confirmed?method=prepaid&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(finalOrderId)}${scheduledDate ? `&scheduledShipDate=${scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}` : ''}`);
```

Replace with:
```js
router.push(`/order-confirmed?method=prepaid&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(finalOrderId)}${scheduledDate ? `&scheduledShipDate=${scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}` : ''}${deliveryEst ? `&deliveryEst=${encodeURIComponent(deliveryEst)}` : ''}`);
```

- [ ] **Step 3: Verify `deliveryEst` is in scope at both lines**

`deliveryEst` is already declared at the top of the component: `const [deliveryEst, setDeliveryEst] = useState('');`. Both `router.push` calls are inside event handlers that close over it — no extra changes needed.

- [ ] **Step 4: Commit**
```bash
git add pages/index.js
git commit -m "feat: pass deliveryEst to order-confirmed page"
```

---

## Task 2: Update locale keys (all 4 locales)

**Files:**
- Modify: `public/locales/en/common.json`
- Modify: `public/locales/hi/common.json`
- Modify: `public/locales/ta/common.json`
- Modify: `public/locales/te/common.json`

- [ ] **Step 1: Update `support_value` and add new keys in `en/common.json`**

Change line with `"order_confirmed.support_value"`:
```json
"order_confirmed.support_value": "Email / Call us",
```

Add these two new keys right after `order_confirmed.notify_denied_msg` (line ~517):
```json
"order_confirmed.est_delivery_label": "Est. Delivery",
"order_confirmed.notify_blocked_msg": "Notifications are blocked in your browser. To enable, go to your browser settings and allow notifications for this site.",
```

- [ ] **Step 2: Update `hi/common.json`**

Change `"order_confirmed.support_value"`:
```json
"order_confirmed.support_value": "ईमेल / कॉल करें",
```

Add after `order_confirmed.notify_denied_msg`:
```json
"order_confirmed.est_delivery_label": "अनुमानित डिलीवरी",
"order_confirmed.notify_blocked_msg": "आपके ब्राउज़र में नोटिफिकेशन ब्लॉक हैं। सक्षम करने के लिए, ब्राउज़र सेटिंग में इस साइट के लिए नोटिफिकेशन की अनुमति दें।",
```

- [ ] **Step 3: Update `ta/common.json`**

Change `"order_confirmed.support_value"`:
```json
"order_confirmed.support_value": "மின்னஞ்சல் / அழைப்பு",
```

Add after `order_confirmed.notify_denied_msg`:
```json
"order_confirmed.est_delivery_label": "மதிப்பிடப்பட்ட டெலிவரி",
"order_confirmed.notify_blocked_msg": "உங்கள் உலாவியில் அறிவிப்புகள் தடுக்கப்பட்டுள்ளன. இயக்க, உலாவி அமைப்புகளில் இந்த தளத்திற்கு அனுமதி வழங்கவும்.",
```

- [ ] **Step 4: Update `te/common.json`**

Change `"order_confirmed.support_value"`:
```json
"order_confirmed.support_value": "ఇమెయిల్ / కాల్ చేయండి",
```

Add after `order_confirmed.notify_denied_msg`:
```json
"order_confirmed.est_delivery_label": "అంచనా డెలివరీ",
"order_confirmed.notify_blocked_msg": "మీ బ్రౌజర్‌లో నోటిఫికేషన్లు నిరోధించబడ్డాయి. ప్రారంభించడానికి, బ్రౌజర్ సెట్టింగ్‌లలో ఈ సైట్‌కు అనుమతి ఇవ్వండి.",
```

- [ ] **Step 5: Run locale key check**
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
Expected output:
```
hi: ok
ta: ok
te: ok
```

- [ ] **Step 6: Commit**
```bash
git add public/locales/en/common.json public/locales/hi/common.json public/locales/ta/common.json public/locales/te/common.json
git commit -m "i18n: update support_value, add est_delivery_label + notify_blocked_msg"
```

---

## Task 3: Redesign order-confirmed banner + info strip

**Files:**
- Modify: `pages/order-confirmed.js`

This task adds the 4-step timeline inside the green banner and replaces the 3-icon info strip with a delivery date band.

- [ ] **Step 1: Read `deliveryEst` from query params**

In `order-confirmed.js`, find the destructuring on line ~113:
```js
const { method, pack, price, name, orderId, scheduledShipDate } = router.query;
```

Replace with:
```js
const { method, pack, price, name, orderId, scheduledShipDate, deliveryEst: deliveryEstRaw } = router.query;
```

Then add this derived value immediately after (before the useState declarations):
```js
// Strip leading "by " prefix if present (e.g. "by Tue, 24 Jun" → "Tue, 24 Jun")
const deliveryEstDisplay = deliveryEstRaw
  ? deliveryEstRaw.replace(/^by\s+/i, '')
  : '';
```

- [ ] **Step 2: Add the delivery timeline component**

Add this component above `export default function OrderConfirmed()` (after the existing `BottomCTAs` component, around line ~108):

```jsx
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
```

Make sure `React` is imported — check the top of the file. If only `{ useEffect, useState }` are imported from 'react', add React:
```js
import React, { useEffect, useState, useRef, useCallback } from 'react';
```
(Add `useRef` and `useCallback` only if they're already used but not imported — check the existing imports first to avoid duplicates.)

- [ ] **Step 3: Add timeline to the banner**

Find the banner JSX block (lines ~325–338):
```jsx
{/* ── SUCCESS BANNER ── */}
<div className="oc-banner" style={{ opacity: visible ? 1 : 0, transition: 'opacity .4s' }}>
  <div className="oc-banner-icon">{isCOD ? '📦' : '🎉'}</div>
  <h1>{isCOD ? t('order_confirmed.order_placed_title') : t('order_confirmed.payment_success_title')}</h1>
  <p>{t('order_confirmed.banner_subtitle', { name: name || '' })}</p>
  {orderId && (
    <div className="oc-order-pill">
      ...
    </div>
  )}
</div>
```

Add `<DeliveryTimeline />` after the `<p>` subtitle and before the order pill:
```jsx
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
```

- [ ] **Step 4: Replace the info strip with a delivery date band**

Find the info strip (lines ~341–345):
```jsx
{/* ── INFO STRIP ── */}
<div className="oc-info-strip">
  <span>📦 <strong>{t('order_confirmed.delivery_value')}</strong></span>
  <span>🚚 <strong>{dispatchValue}</strong></span>
  <span>💬 <strong>{t('order_confirmed.support_value')}</strong></span>
</div>
```

Replace entirely with:
```jsx
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
```

- [ ] **Step 5: Commit**
```bash
git add pages/order-confirmed.js
git commit -m "feat: add delivery timeline to banner and delivery date band"
```

---

## Task 4: Update order summary rows + support row

**Files:**
- Modify: `pages/order-confirmed.js`

- [ ] **Step 1: Replace the order summary table rows**

Find the order summary rows array (lines ~357–364):
```js
{[
  [t('order_confirmed.product_label'), t('order_confirmed.product_name'), false],
  ...(pack     ? [[t('order_confirmed.pack_label'),   packDisplay, false]] : []),
  ...(priceStr ? [[t('order_confirmed.amount_label'), isCOD ? t('order_confirmed.amount_cod', { price: priceStr }) : t('order_confirmed.amount_prepaid', { price: priceStr }), false]] : []),
  [t('order_confirmed.delivery_label'), t('order_confirmed.delivery_value'), false],
  [t('order_confirmed.dispatch_label'), dispatchValue, true],
  [t('order_confirmed.support_label'),  t('order_confirmed.support_value'),  false],
].map(([k, v, isBadge]) => (
```

Replace with (adds `deliveryEstDisplay` row, removes WhatsApp support row, keeps support as "Email / Call us"):
```js
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
```

Note: The `.map` callback now destructures 4 elements — update the destructuring from `([k, v, isBadge])` to `([k, v, isBadge, isEta])` and replace the inner JSX as shown above.

- [ ] **Step 2: Commit**
```bash
git add pages/order-confirmed.js
git commit -m "feat: show real delivery ETA in order summary, update support row"
```

---

## Task 5: Fix notification card for browser-denied state

**Files:**
- Modify: `pages/order-confirmed.js`

- [ ] **Step 1: Add `permissionState` detection on mount**

Find the push notification `useEffect` (lines ~131–138):
```js
useEffect(() => {
  const shouldNotify = sessionStorage.getItem('vedayu_notify_orders');
  if (shouldNotify === '1') {
    requestPushPermission().then(setNotifyState);
  } else {
    setShowNotifyToggle(true);
  }
}, []);
```

Replace with:
```js
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
```

- [ ] **Step 2: Update the notification card JSX**

Find the notify card (lines ~382–409):
```jsx
{showNotifyToggle && (
  <div className="oc-notify-card">
    <div className="oc-notify-card-text">
      <p className="oc-notify-card-title">🔔 {t('order_confirmed.notify_card_title')}</p>
      <p className="oc-notify-card-desc">{t('order_confirmed.notify_card_desc')}</p>
      {notifyState === 'granted' && (
        <p className="oc-notify-card-msg" style={{ color: '#2d6b40' }}>{t('order_confirmed.notify_granted_msg')}</p>
      )}
      {notifyState === 'denied' && (
        <p className="oc-notify-card-msg" style={{ color: '#c0392b' }}>{t('order_confirmed.notify_denied_msg')}</p>
      )}
    </div>
    {notifyState !== 'granted' && notifyState !== 'denied' && (
      <button
        onClick={() => requestPushPermission().then(setNotifyState)}
        disabled={notifyState === 'requesting'}
        style={{...}}
      >
        {notifyState === 'requesting' ? '...' : t('order_confirmed.notify_enable_btn')}
      </button>
    )}
  </div>
)}
```

Replace with:
```jsx
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
```

- [ ] **Step 3: Commit**
```bash
git add pages/order-confirmed.js
git commit -m "feat: show browser-settings message when notifications are blocked"
```

---

## Task 6: Customer address lookup — mobile-only fallback

**Files:**
- Modify: `lib/customer-cache.js`

- [ ] **Step 1: Add mobile-only fallback**

The current file content:
```js
export async function lookupCustomer({ mobile, email }) {
  if (!mobile || !email) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('name, email, address, city, state, pincode')
    .eq('mobile', mobile.trim())
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data || null;
}
```

Replace with:
```js
export async function lookupCustomer({ mobile, email }) {
  if (!mobile) return null;

  // Pass 1: exact match on mobile + email
  if (email) {
    const { data } = await supabase
      .from('orders')
      .select('name, email, address, city, state, pincode')
      .eq('mobile', mobile.trim())
      .eq('email', email.trim().toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // Pass 2: mobile-only fallback
  const { data } = await supabase
    .from('orders')
    .select('name, email, address, city, state, pincode')
    .eq('mobile', mobile.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}
```

- [ ] **Step 2: Commit**
```bash
git add lib/customer-cache.js
git commit -m "fix: customer lookup falls back to mobile-only when email doesn't match"
```

---

## Task 7: Admin AI chats — per-message timestamps

**Files:**
- Modify: `pages/admin/chats.js`

- [ ] **Step 1: Add timestamp helper**

At the top of `pages/admin/chats.js`, there is already a `fmtD` function. Add a new helper below it:
```js
const fmtTime = iso => iso
  ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  : null;
```

- [ ] **Step 2: Update the message bubble render in `SessionDetail`**

Find the message rendering inside `SessionDetail` (lines ~128–143):
```jsx
{messages.map((m, i) => {
  const isUser = m.role === 'user';
  return (
    <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '80%',
        background: isUser ? BROWN : '#f5f0e8',
        color: isUser ? '#fff' : '#1a1a1a',
        padding: '8px 12px', borderRadius: 10,
        fontSize: '.84rem', lineHeight: 1.45,
      }}>
        {m.content || ''}
      </div>
    </div>
  );
})}
```

Replace with:
```jsx
{messages.map((m, i) => {
  const isUser = m.role === 'user';
  const ts = fmtTime(m.timestamp || m.created_at);
  return (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        maxWidth: '80%',
        background: isUser ? BROWN : '#f5f0e8',
        color: isUser ? '#fff' : '#1a1a1a',
        padding: '8px 12px', borderRadius: 10,
        fontSize: '.84rem', lineHeight: 1.45,
      }}>
        {m.content || ''}
      </div>
      {ts && (
        <span style={{ fontSize: '.62rem', color: '#aaa', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
          {ts}
        </span>
      )}
    </div>
  );
})}
```

- [ ] **Step 3: Commit**
```bash
git add pages/admin/chats.js
git commit -m "feat: show per-message timestamps in AI chat admin panel"
```

---

## Task 8: Admin WhatsApp chats — per-message timestamps

**Files:**
- Modify: `pages/admin/whatsapp.js`

- [ ] **Step 1: Add `fmtTime` helper**

At the top of `pages/admin/whatsapp.js`, there is already a `fmtD` function. Add below it:
```js
const fmtTime = iso => iso
  ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  : null;
```

- [ ] **Step 2: Update message bubble render in `Thread`**

Find the messages map inside `Thread` (lines ~77–87):
```jsx
{conv.messages.map((m, i) => (
  <div key={i} style={{ display: 'flex',
    justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
    <div style={{ maxWidth:'80%', background: m.direction === 'out' ? '#5C3D1E' : '#f0ede8',
      color: m.direction === 'out' ? '#fff' : '#1a1a1a',
      padding:'8px 12px', borderRadius:10, fontSize:'.84rem', lineHeight:1.45 }}>
      {m.message || m.bot_replied}
    </div>
  </div>
))}
```

Replace with:
```jsx
{conv.messages.map((m, i) => {
  const isOut = m.direction === 'out';
  const ts = fmtTime(m.created_at || m.timestamp);
  return (
    <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: isOut ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth:'80%', background: isOut ? '#5C3D1E' : '#f0ede8',
        color: isOut ? '#fff' : '#1a1a1a',
        padding:'8px 12px', borderRadius:10, fontSize:'.84rem', lineHeight:1.45 }}>
        {m.message || m.bot_replied}
      </div>
      {ts && (
        <span style={{ fontSize:'.62rem', color:'#aaa', marginTop:2, paddingLeft:4, paddingRight:4 }}>
          {ts}
        </span>
      )}
    </div>
  );
})}
```

- [ ] **Step 3: Commit**
```bash
git add pages/admin/whatsapp.js
git commit -m "feat: show per-message timestamps in WhatsApp chat admin panel"
```

---

## Task 9: Abandoned cart — informative empty state

**Files:**
- Modify: `pages/admin/abandoned.js`

- [ ] **Step 1: Add empty state message**

Find the section that renders the cart list (after the summary chips and filter row). Look for where `carts` are mapped — there will be a table/list render. Find the spot where `carts.length === 0` after filtering and add:

After the filter buttons and before the carts table/list, find the `loading` check and the carts render. Add an empty state when `!loading && carts.length === 0`:

```jsx
{!loading && carts.length === 0 && (
  <div style={{
    background: '#fff', borderRadius: 12, padding: '32px 24px',
    textAlign: 'center', border: '1px solid #e8d5b0', color: '#888',
    fontSize: '.85rem', lineHeight: 1.6,
  }}>
    <div style={{ fontSize: '2rem', marginBottom: 10 }}>🛒</div>
    <p style={{ fontWeight: 700, color: '#5C3D1E', marginBottom: 6 }}>No abandoned checkouts recorded yet</p>
    <p>Carts are tracked when a visitor fills in their mobile number and leaves without completing the order.</p>
  </div>
)}
```

Place this immediately after the loading check block, before wherever carts are listed.

- [ ] **Step 2: Commit**
```bash
git add pages/admin/abandoned.js
git commit -m "ux: informative empty state for abandoned checkouts"
```

---

## Task 10: Run dev server and verify all changes

- [ ] **Step 1: Start dev server**
```bash
npm run dev
```

- [ ] **Step 2: Test the confirmation page**

Open `http://localhost:3000/order-confirmed?method=cod&pack=Pack%20of%201&price=499&name=Test%20User&orderId=VED-TEST001&deliveryEst=by%20Tue%2C%2024%20Jun`

Verify:
- Green banner shows the 4-step timeline (Confirmed filled, others grey)
- Delivery date band shows "Tue, 24 Jun" (not the generic text)
- Order summary has an "Est. Delivery" row with "📅 Tue, 24 Jun"
- Support row shows "Email / Call us" (not WhatsApp)
- Notification card shows the "Enable Alerts" button (not browser-denied state)

- [ ] **Step 3: Test fallback when no `deliveryEst`**

Open `http://localhost:3000/order-confirmed?method=cod&pack=Pack%20of%201&price=499&name=Test%20User&orderId=VED-TEST001`

Verify:
- Delivery date band shows "3–5 business days"
- No "Est. Delivery" row in order summary

- [ ] **Step 4: Test notification blocked state**

In browser DevTools console run:
```js
// Simulate denied state by checking what the component reads
// (can't truly override Notification.permission in devtools, but you can
//  verify the UI renders correctly by temporarily hardcoding in the component)
```

To test visually: in `order-confirmed.js` temporarily change the mount effect to force `'denied'`:
```js
// TEMP: force browser-denied state for testing
setNotifyState('browser-denied');
setShowNotifyToggle(true);
```
Verify the card shows the "blocked in your browser" message with no button. Revert after confirming.

- [ ] **Step 5: Test admin chat timestamps**

Open `http://localhost:3000/admin/chats` — select a session. If messages have `timestamp` fields in Supabase, they'll show. If not, nothing breaks.

- [ ] **Step 6: Final locale check**
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
Expected: all `ok`.
