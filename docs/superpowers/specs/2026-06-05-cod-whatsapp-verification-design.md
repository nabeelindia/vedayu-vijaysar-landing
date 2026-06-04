# COD Order Verification via WhatsApp Interactive Template

**Date:** 2026-06-05  
**Status:** Approved

---

## Overview

When a COD order is placed, send the customer a WhatsApp message showing their delivery address with two quick-reply buttons — **Confirm Order** and **Cancel Order**. When the customer taps Confirm, the order is flagged as verified. When they tap Cancel, the order is cancelled and an upsell message is sent offering a discount to switch to prepaid.

---

## User Flow

1. Customer places a COD order on vedayulife.com.
2. `submit-cod.js` sends the existing `vedayu_order_confirmed` template (unchanged), then immediately sends a new `vedayu_cod_verify` interactive template.
3. The verification message shows: customer name, order ID, pack, price, and delivery address, with two quick reply buttons.
4. Customer taps **✅ Confirm Order**:
   - KV status updated to `confirmed`
   - WhatsApp text sent: "Great! Your order is confirmed. We'll dispatch in 1–2 business days."
   - Owner notified via existing email mechanism
5. Customer taps **❌ Cancel Order**:
   - KV status updated to `cancelled`
   - WhatsApp template `vedayu_cod_prepaid_offer` sent (upsell to prepaid with discount)
   - Owner notified

---

## Architecture

### New WhatsApp Templates (register in Meta Business Manager)

**`vedayu_cod_verify`**
- Category: UTILITY
- Language: en
- Body variables: `{{1}}` name, `{{2}}` orderId, `{{3}}` pack, `{{4}}` price, `{{5}}` address
- Body text:
  > Hi {{1}}, we received your COD order {{2}} for {{3}} ({{4}}). Your delivery address on file: {{5}}. Please confirm this is correct so we can dispatch your order.
- Buttons (QUICK_REPLY):
  - Button 1: "✅ Confirm Order" — payload `CONFIRM_COD`
  - Button 2: "❌ Cancel Order" — payload `CANCEL_COD`

**`vedayu_cod_prepaid_offer`**
- Category: MARKETING
- Language: en
- Body variables: `{{1}}` name, `{{2}}` orderId
- Body text:
  > Hi {{1}}, your order {{2}} has been cancelled as requested. Want to reorder and get ₹50 off? Pay via UPI and we'll apply the discount automatically. Tap below to reorder.
- Button (URL): "Reorder with ₹50 Off" → `https://vedayulife.com/?cod_cancel_upsell=1`

---

### Code Changes

#### `lib/whatsapp.js` — 2 new exports

**`waCodVerify({ mobile, name, orderId, pack, price, address })`**  
Sends `vedayu_cod_verify` interactive template with 5 body variables and 2 quick reply buttons.

**`waCodPrepaidOffer({ mobile, name, orderId })`**  
Sends `vedayu_cod_prepaid_offer` template with 2 body variables and a URL button.

#### `pages/api/submit-cod.js` — additions after `waOrderConfirmed()`

1. Call `waCodVerify(...)` with name, orderId, pack, price, full address.
2. Store in Vercel KV:
   - Key: `cod_verify:${mobile}` (normalised to `91XXXXXXXXXX`)
   - Value: `{ orderId, status: 'pending', createdAt: Date.now() }`
   - TTL: 172800 seconds (48 hours)

#### `pages/api/whatsapp-webhook.js` — new branch in the message loop

Current handler only processes `msg.type === 'text'`. Add a parallel branch:

```
if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
  const buttonId = msg.interactive.button_reply.id  // 'CONFIRM_COD' | 'CANCEL_COD'
  const phone    = msg.from  // e.g. '919876543210'

  const record = await kv.get(`cod_verify:${phone}`)
  if (!record || record.status !== 'pending') return  // already handled or unknown

  if (buttonId === 'CONFIRM_COD') {
    await kv.set(`cod_verify:${phone}`, { ...record, status: 'confirmed' }, { ex: 172800 })
    // send WA confirmation text (session message, not template)
    // notify owner
  } else if (buttonId === 'CANCEL_COD') {
    await kv.set(`cod_verify:${phone}`, { ...record, status: 'cancelled' }, { ex: 172800 })
    // send vedayu_cod_prepaid_offer template
    // notify owner
  }
}
```

The confirmation WA reply (after Confirm) can be a free-text session message since the customer just initiated interaction. The cancel upsell must be a template.

#### `supabase/migrations/003_cod_verifications.sql` — new table

```sql
create table if not exists cod_verifications (
  id           bigserial primary key,
  order_id     text not null unique,
  mobile       text not null,
  status       text not null default 'pending',  -- pending | confirmed | cancelled
  verified_at  timestamptz,
  cancelled_at timestamptz,
  created_at   timestamptz default now()
);
create index if not exists cod_verifications_mobile_idx on cod_verifications(mobile);
```

Write to this table from the webhook handler after each button tap (for insights page visibility and analytics).

---

## State Machine

```
             [Order placed]
                   │
                   ▼
              status: pending
             (KV + DB, 48h TTL)
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
  CONFIRM_COD           CANCEL_COD
        │                     │
        ▼                     ▼
  status: confirmed     status: cancelled
  WA: "dispatching"     WA: prepaid offer
  Notify owner          Notify owner
```

If no response within 48h, the KV key expires. Status remains `pending` in DB. Owner can filter `pending` orders in the insights page for manual follow-up.

---

## Error Handling

- `waCodVerify` failure: log but do not fail the order response. Customer already got `waOrderConfirmed`.
- KV lookup miss in webhook (key expired or unknown phone): silently ignore — do not reply.
- DB write failure in webhook: log, but do not block the WA reply.
- Template not yet approved: `waCodVerify` will return a Meta error logged to console — order still placed normally.

---

## Meta Template Submission Checklist

Before going live:
- [ ] Submit `vedayu_cod_verify` to Meta Business Manager (category: UTILITY)
- [ ] Submit `vedayu_cod_prepaid_offer` to Meta Business Manager (category: MARKETING)
- [ ] Wait for approval (1–3 business days)
- [ ] Test with a real phone number in sandbox/test mode

---

## Out of Scope

- Timeout reminder (e.g. "You haven't confirmed yet") — can be added later as a cron
- Showing verification status in the customer-facing order tracking page
- Webhook signature verification improvement (already tracked separately)
