# Spec: Confirmation Page & Admin UX Improvements

**Date:** 2026-06-19  
**Status:** Approved

---

## Overview

Five independent improvements across the order confirmation page and admin panel. No WhatsApp dependency — WhatsApp is disabled.

---

## 1. Order Confirmation Page Redesign

### Layout: Delivery Timeline (Option A)

Replace the current flat info strip with a 4-step delivery timeline inside the green banner.

**Banner changes:**
- Add a 4-step progress bar: **Confirmed → Packed → Shipped → Delivered**
- "Confirmed" step is always filled/active on this page; the rest are grey
- Keep existing order ID pill with copy button
- Keep personalised subtitle with customer name

**Replace info strip** (the 3-icon row below the banner) with a single **delivery date band**:
- Shows real ETA from checkout when available: `📦 Free shipping · Est. delivery **Tue, 24 Jun**`
- Falls back to: `📦 Free shipping · 3–5 business days` when no ETA
- **Remove "WhatsApp us anytime"** — gone entirely from this strip and everywhere on this page

### Passing delivery estimate

In `pages/index.js`, the `deliveryEst` state holds the real ETA string (e.g. `"by Tue, 24 Jun"`). Pass it as a query param `deliveryEst` when redirecting to `/order-confirmed` for both COD and prepaid flows.

In `pages/order-confirmed.js`:
- Read `deliveryEst` from `router.query`
- Display in the delivery date band (strip the leading "by " prefix if present for cleaner display)
- Also replace the generic `delivery_value` translation key in the order summary table's "Est. Delivery" row with the real ETA (or fall back to the generic "3–5 business days" text)

### Support row in order summary

Change "Support" row value from `t('order_confirmed.support_value')` ("WhatsApp us anytime") to "Email / Call us".

Update translation keys `order_confirmed.support_value` in all 4 locales (en/hi/ta/te).

---

## 2. Notification CTA for Users Who Declined at Checkout

**Current behaviour:** `showNotifyToggle` is `true` when the user did *not* opt-in at checkout (`vedayu_notify_orders` is not `'1'` in sessionStorage). The existing card shows a brown "Enable" button.

**Problem:** When a user has already denied browser notification permission (e.g. clicked "Block" in a previous visit), `Notification.permission === 'denied'` — the browser won't re-prompt. The card button currently just silently fails.

**Fix:**
- On mount, also check `Notification.permission`:
  - If `'denied'`: show a different card state — "Notifications are blocked in your browser. To enable, update your browser settings." (no button, just info text with a settings icon)
  - If `'default'` and `showNotifyToggle`: show the existing "Enable Alerts" button CTA
  - If `'granted'`: hide the card

The card title changes from generic "Get order updates" to **"🔔 Receive Order Updates"** — matching the mockup.

---

## 3. Admin Panel — Chat Timestamps

### AI Chats (`pages/admin/chats.js`)

Messages in the thread are stored as `{ role, content }` objects. They currently have no timestamp.

**Fix:** If a message has a `timestamp` or `created_at` field, show it below the bubble as a small grey label (e.g. `"10:42 AM"`). If no timestamp field exists on messages, show nothing — don't break existing sessions. Format: `HH:MM AM/PM` using IST locale.

Also add the session's `created_at` to the thread header more prominently (already shown, but small — keep as-is, just ensure it's visible).

### WhatsApp Chats (`pages/admin/whatsapp.js`)

Messages are stored as `{ direction, message, bot_replied, ... }`. Add timestamp display below each bubble using `m.created_at` or `m.timestamp` if present. Same format: `HH:MM AM/PM IST`. If absent, render nothing.

---

## 4. Abandoned Cart Admin Panel

**Current state:** The `pages/admin/abandoned.js` page calls `/api/admin/abandoned` which reads from the `cart_abandons` Supabase table. The API route looks correct.

**Likely issue:** The `track-abandon.js` beacon only writes to `cart_abandons` when `supabase && mobile` are both truthy. If the Supabase client isn't initialised in the serverless environment, rows never get written — so the admin page shows empty correctly but there's nothing to show.

**Fix:** Add a debug row to the admin abandoned page when the table returns 0 results: show a small helper text — *"No abandoned checkouts recorded yet. Carts are tracked when a visitor fills their mobile number and leaves without ordering."* This makes the empty state informative rather than broken-looking.

No code change needed to the tracking logic itself unless there's a confirmed Supabase initialisation bug (out of scope here — investigate separately if the empty state persists after real traffic).

---

## 5. Customer Address Retrieval Fix

**Current logic** (`lib/customer-cache.js` + `/api/lookup-customer`): requires **both** `mobile` AND `email` — both must match a row in `orders`.

**Problem:** Returning customers who only fill in their mobile number (and skip email, or use a different email) get no address pre-fill.

**Fix:** Change lookup to a two-pass strategy:
1. **Try mobile + email** (exact match on both) — if found, return
2. **Fall back to mobile-only** — query `orders` where `mobile = ?`, order by `created_at DESC`, limit 1 — if found, return

This means a customer who used a different email this time still gets their address pre-filled based on phone number alone. The mobile-only fallback is safe because phone numbers are unique per customer in practice.

Update `lookupCustomer` in `lib/customer-cache.js`. The `/api/lookup-customer` route and `pages/index.js` call site need no changes.

---

## Scope Boundaries

- No WhatsApp CTAs added anywhere on the confirmation page
- Referral card's "Share via WhatsApp" link is kept as-is (it's a passive share link, not an active message send — acceptable)
- Miswak upsell card: no changes
- Admin WhatsApp inbox page: timestamps added but no other UI changes
- i18n: only keys that change (`support_value`, any new keys) need updating in all 4 locales

---

## Files Affected

| File | Change |
|------|--------|
| `pages/order-confirmed.js` | Timeline, delivery band, ETA display, notify card fix, remove WhatsApp |
| `pages/index.js` | Pass `deliveryEst` in redirect query params |
| `lib/customer-cache.js` | Mobile-only fallback lookup |
| `pages/admin/chats.js` | Per-message timestamps |
| `pages/admin/whatsapp.js` | Per-message timestamps |
| `pages/admin/abandoned.js` | Informative empty state |
| `public/locales/*/common.json` | Update `support_value` key + any new keys |
