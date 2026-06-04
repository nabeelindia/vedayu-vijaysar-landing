# COD Verification Flow — Improvements

**Date:** 2026-06-05  
**Status:** Approved  
**Build order:** 2 of 3 (extends the COD verification base spec from 2026-06-05)  
**Depends on:** Simplified order numbers (lib/orders.js must exist)

---

## Overview

Four improvements to the COD verification WhatsApp flow:

1. Dynamic sending time in messages (before/after 6 PM IST)
2. Simple, friendly message framing for elderly Indian customers (no jargon)
3. 6-hour nudge for non-responders
4. 24-hour auto-confirm for persistent non-responders

---

## 1. Dynamic Sending Time

At the moment of order placement, check current IST time:

```js
function getSendingLine() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hour = ist.getHours();
  // before 6 PM (18:00)
  return hour < 18
    ? 'we will send it to you today itself'
    : 'we will send it to you tomorrow morning';
}
```

This string becomes the 6th body variable `{{6}}` in the `vedayu_cod_verify` template. Meta allows up to 10 body variables.

**Decision:** Use as `{{6}}` — keeps message text clean and lets Meta validate each variable separately.

---

## 2. Updated Template: `vedayu_cod_verify`

**Language note:** All messages use simple, warm Hindi-influenced Indian English. No English jargon ("dispatch", "activate", "confirm order"). The goal is clarity for elderly customers who may not be very comfortable with formal English.

**Previous body (from base spec):**
> Hi {{1}}, we received your COD order {{2}} for {{3}} ({{4}}). Your delivery address on file: {{5}}. Please confirm this is correct — once confirmed, your order will be shipped within 24 business hours.

**New body:**
> Namaste {{1}} ji 🙏 We have received your order {{2}} for {{3}} ({{4}}). We will send it to this address: {{5}}. Is this address correct? If yes, please press *Yes, Send My Order*. If not correct, press *Cancel Order* and place a new order with the right address. {{6}}.

Variables: `{{1}}` name · `{{2}}` orderId · `{{3}}` pack · `{{4}}` price · `{{5}}` address · `{{6}}` sending time line

Buttons (QUICK_REPLY):
- "✅ Yes, Send My Order" — payload `CONFIRM_COD`
- "❌ Cancel Order" — payload `CANCEL_COD`

**Re-submit this updated template to Meta Business Manager.** Category: UTILITY.

---

## 3. Updated KV Record

When `waCodVerify` is called, store in KV:

```js
await kv.set(`cod_verify:${normalised_mobile}`, {
  orderId,
  name,
  pack,
  price,
  status: 'pending',
  nudgedAt: null,
  createdAt: Date.now(),
}, { ex: 172800 }); // 48h TTL
```

Also insert a row in `cod_verifications` (Supabase) immediately with `status = 'pending'`.

---

## 4. Nudge Cron — `/api/cron/cod-nudge`

**Schedule:** every 3 hours (configured in `vercel.json`).

**Logic:**
1. Query Supabase `cod_verifications` where `status = 'pending'` and `created_at` is between 6 and 23 hours ago and `nudged_at IS NULL`.
2. For each: send WhatsApp nudge, update `nudged_at = now()` in DB.

**Nudge message** — use a new template `vedayu_cod_nudge`:
> Namaste {{1}} ji 🙏 Your Vedayu order {{2}} is ready to be sent to you! We are waiting for your reply. Please press *Yes, Send My Order* so we can send it — {{3}}. If you do not want it, press *Cancel Order*.

Variables: `{{1}}` name · `{{2}}` orderId · `{{3}}` shipping line (dynamic, same helper)

Buttons: same QUICK_REPLY buttons as verify template.

**Template to register:** `vedayu_cod_nudge` — Category: UTILITY.

**Security:** Cron route must check `Authorization: Bearer ${CRON_SECRET}` header (Vercel cron standard).

---

## 5. Auto-Confirm Cron — `/api/cron/cod-auto-confirm`

**Schedule:** runs once daily at 06:00 IST (01:30 UTC — use `vercel.json` cron).

**Logic:**
1. Query Supabase `cod_verifications` where `status = 'pending'` and `created_at` < 24 hours ago.
2. For each:
   - Update `cod_verifications.status = 'auto_confirmed'`, `verified_at = now()`
   - Update `orders.status = 'confirmed'` in Supabase
   - Send owner email: "Order {orderId} auto-confirmed — customer did not reply. Please call customer before sending the parcel."
   - Send customer WA text (session message): "Namaste ji 🙏 Your Vedayu order {orderId} is being sent to you. Please keep ₹{price} ready to give the delivery person when they arrive."

---

## 6. Updated `cod_verifications` Table

Replaces the schema from the base spec:

```sql
create table if not exists cod_verifications (
  id            bigserial primary key,
  order_id      text not null unique,
  mobile        text not null,
  name          text not null,
  status        text not null default 'pending',
    -- pending | confirmed | cancelled | auto_confirmed
  nudged_at     timestamptz,
  verified_at   timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz default now()
);
create index if not exists cod_verifications_mobile_idx on cod_verifications(mobile);
create index if not exists cod_verifications_status_idx on cod_verifications(status);
create index if not exists cod_verifications_created_idx on cod_verifications(created_at);
```

---

## 7. Updated Webhook Handler Logic

In `pages/api/whatsapp-webhook.js`, add the interactive branch:

```
msg.type === 'interactive' && msg.interactive?.type === 'button_reply'
  → buttonId = msg.interactive.button_reply.id
  → phone = msg.from (e.g. '919876543210')
  → record = await kv.get(`cod_verify:${phone}`)

  if !record or record.status !== 'pending':
    → silently ignore (already handled or expired)

  CONFIRM_COD:
    → kv.set status = 'confirmed'
    → supabase update cod_verifications: status='confirmed', verified_at=now()
    → supabase update orders: status='confirmed'
    → send WA session message: "Namaste ji 🙏 Thank you! Your order {orderId} is confirmed. We will send your parcel to you — please keep ₹{price} ready to give the delivery person."
    → notifyOwner (email)

  CANCEL_COD:
    → kv.set status = 'cancelled'
    → supabase update cod_verifications: status='cancelled', cancelled_at=now()
    → supabase update orders: status='cancelled'
    → send waCodPrepaidOffer()
    → notifyOwner (email)
```

---

## Meta Templates Checklist (updated)

- [ ] Submit `vedayu_cod_verify` (updated — 6 variables, same 2 buttons) — UTILITY
- [ ] Submit `vedayu_cod_nudge` (new) — UTILITY
- [ ] Submit `vedayu_cod_prepaid_offer` (from base spec) — MARKETING
- [ ] Test all three with a real number before go-live

---

## Files Changed

| File | Change |
|------|--------|
| `lib/whatsapp.js` | Add `waCodVerify` (6 vars), `waCodNudge`, `waCodPrepaidOffer` |
| `pages/api/submit-cod.js` | Call `waCodVerify`, write to `cod_verifications` + `orders` |
| `pages/api/whatsapp-webhook.js` | Add interactive button handler |
| `pages/api/cron/cod-nudge.js` | New — 6h nudge cron |
| `pages/api/cron/cod-auto-confirm.js` | New — 24h auto-confirm cron |
| `vercel.json` | Add cron schedules |
| `supabase/migrations/003_cod_verifications.sql` | Updated schema |

---

## Out of Scope

- IVR/phone call fallback for non-responders
- Customer-facing verification status on the tracking page
- RTO analytics (covered in admin panel spec)
