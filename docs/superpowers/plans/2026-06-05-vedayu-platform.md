# Vedayu Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship sequential order IDs, COD WhatsApp verification flow, and a mobile-first admin panel — in that order, each building on the last.

**Architecture:** Three phases. Phase 1 adds `lib/orders.js` (order ID generator) used by both order APIs. Phase 2 wires the full COD WhatsApp verification flow into `submit-cod.js` and `whatsapp-webhook.js` with two cron jobs. Phase 3 builds the `/admin` panel: Supabase `orders` table, REST API layer at `/api/admin/*`, shared React components, and six admin pages.

**Tech Stack:** Next.js 14 (Pages Router), Vercel KV (atomic counters), Supabase (Postgres), WhatsApp Business Cloud API, Resend (email), Tailwind-via-inline-styles (existing pattern).

---

## File Map

**New files:**
```
lib/orders.js
supabase/migrations/003_cod_verifications.sql
supabase/migrations/004_orders.sql
pages/api/cron/cod-nudge.js
pages/api/cron/cod-auto-confirm.js
pages/api/admin-auth.js
pages/api/admin/_auth.js
pages/api/admin/orders/index.js
pages/api/admin/orders/[id].js
pages/api/admin/customers/index.js
pages/api/admin/customers/[phone].js
pages/api/admin/analytics.js
components/admin/Layout.js
components/admin/StatusBadge.js
components/admin/StatCard.js
components/admin/PageHeader.js
components/admin/OrderCard.js
components/admin/VerifyTimeline.js
pages/admin/login.js
pages/admin/index.js
pages/admin/orders/index.js
pages/admin/orders/[id].js
pages/admin/customers/index.js
pages/admin/customers/[phone].js
pages/admin/whatsapp.js
pages/admin/analytics.js
```

**Modified files:**
```
lib/whatsapp.js              — add waCodVerify, waCodNudge, waCodPrepaidOffer, getSendingLine
pages/api/submit-cod.js      — generateOrderId, waCodVerify, write orders + cod_verifications
pages/api/verify-payment.js  — generateOrderId, write orders table
pages/api/whatsapp-webhook.js — handle interactive button replies
pages/api/nimbuspost/webhook.js — write awb/status back to orders table
middleware.js                — add /admin protection
vercel.json                  — add two cron schedules
```

---

## PHASE 1 — Order Numbers

### Task 1: Create `lib/orders.js`

**Files:**
- Create: `lib/orders.js`

- [ ] **Create the file**

```js
// lib/orders.js
import { kv } from '@vercel/kv';

function getISTDate() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yy = String(ist.getFullYear()).slice(2);
  const mm = String(ist.getMonth() + 1).padStart(2, '0');
  const dd = String(ist.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/**
 * Generates VED-C250605XX (COD) or VED-P250605XX (Prepaid).
 * Counter resets each IST day. Falls back to base36 suffix if KV is down.
 * @param {'cod'|'prepaid'} method
 */
export async function generateOrderId(method) {
  const prefix = method === 'prepaid' ? 'P' : 'C';
  const date   = getISTDate();
  const kvKey  = `order_seq:${date}`;
  try {
    const seq = await kv.incr(kvKey);
    await kv.expire(kvKey, 172800); // 48h TTL — cleans up yesterday's key
    return `VED-${prefix}${date}${String(seq).padStart(2, '0')}`;
  } catch {
    const short = Date.now().toString(36).slice(-4).toUpperCase();
    return `VED-${prefix}F${date}${short}`;
  }
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully` (or similar — no errors mentioning orders.js).

- [ ] **Commit**

```bash
git add lib/orders.js
git commit -m "feat: add generateOrderId — VED-C250605XX daily sequential format"
```

---

### Task 2: Wire order IDs into both order APIs

**Files:**
- Modify: `pages/api/submit-cod.js` (line ~33 where `orderId` is set)
- Modify: `pages/api/verify-payment.js` (line 62 where `orderId` is set)

- [ ] **Update `submit-cod.js`**

Add import at the top (after existing imports):
```js
import { generateOrderId } from '../../lib/orders';
```

Replace this line:
```js
const orderId   = `VED-COD-${Date.now()}`;
```
With:
```js
const orderId   = await generateOrderId('cod');
```

- [ ] **Update `verify-payment.js`**

Add import at the top (after existing imports):
```js
import { generateOrderId } from '../../lib/orders';
```

Replace this line (line 62):
```js
const orderId   = `VED-PRE-${razorpay_payment_id}`;
```
With:
```js
const orderId   = await generateOrderId('prepaid');
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/submit-cod.js pages/api/verify-payment.js
git commit -m "feat: use VED-C/P + date + daily seq for all order IDs"
```

---

## PHASE 2 — COD Verification Flow

### Task 3: Supabase migrations

**Files:**
- Create: `supabase/migrations/003_cod_verifications.sql`
- Create: `supabase/migrations/004_orders.sql`

- [ ] **Create `003_cod_verifications.sql`**

```sql
create table if not exists cod_verifications (
  id            bigserial primary key,
  order_id      text not null unique,
  mobile        text not null,
  name          text not null,
  status        text not null default 'pending',
  nudged_at     timestamptz,
  verified_at   timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz default now()
);
create index if not exists cod_verif_mobile_idx  on cod_verifications(mobile);
create index if not exists cod_verif_status_idx  on cod_verifications(status);
create index if not exists cod_verif_created_idx on cod_verifications(created_at);
```

- [ ] **Create `004_orders.sql`**

```sql
create table if not exists orders (
  id                  bigserial primary key,
  order_id            text not null unique,
  method              text not null,
  status              text not null default 'pending',
  name                text not null,
  mobile              text not null,
  email               text,
  address             text not null,
  city                text not null,
  state               text not null,
  pincode             text not null,
  pack                text not null,
  qty                 int  not null default 1,
  price               int  not null,
  utm                 jsonb,
  referrer_id         text,
  awb                 text,
  courier             text,
  nimbuspost_order_id text,
  label_url           text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  returned_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists orders_mobile_idx  on orders(mobile);
create index if not exists orders_status_idx  on orders(status);
create index if not exists orders_method_idx  on orders(method);
create index if not exists orders_created_idx on orders(created_at desc);
create index if not exists orders_awb_idx     on orders(awb);
```

- [ ] **Run both migrations in Supabase SQL editor**

Open your Supabase project → SQL Editor → paste and run `003_cod_verifications.sql`, then `004_orders.sql`. Confirm both tables appear in Table Editor.

- [ ] **Commit**

```bash
git add supabase/migrations/003_cod_verifications.sql supabase/migrations/004_orders.sql
git commit -m "feat: add cod_verifications and orders tables"
```

---

### Task 4: Add COD WhatsApp functions to `lib/whatsapp.js`

**Files:**
- Modify: `lib/whatsapp.js` (append to end of file)

- [ ] **Append these functions to `lib/whatsapp.js`**

```js
// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSendingLine() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.getHours() < 18
    ? 'we will send it to you today itself'
    : 'we will send it to you tomorrow morning';
}

// ─── COD Verification Templates ──────────────────────────────────────────────

/**
 * COD order verification — sent immediately after order placement.
 * Template: vedayu_cod_verify (UTILITY)
 * Body vars: {{1}} name, {{2}} orderId, {{3}} pack, {{4}} price, {{5}} address, {{6}} sending line
 * Buttons: QUICK_REPLY — "Yes, Send My Order" (CONFIRM_COD), "Cancel Order" (CANCEL_COD)
 */
export async function waCodVerify({ mobile, name, orderId, pack, price, address }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cod_verify',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: orderId },
            { type: 'text', text: pack },
            { type: 'text', text: `₹${price}` },
            { type: 'text', text: address },
            { type: 'text', text: getSendingLine() },
          ],
        },
        { type: 'button', sub_type: 'quick_reply', index: '0',
          parameters: [{ type: 'payload', payload: 'CONFIRM_COD' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1',
          parameters: [{ type: 'payload', payload: 'CANCEL_COD' }] },
      ],
    },
  });
}

/**
 * 6-hour nudge for non-responders.
 * Template: vedayu_cod_nudge (UTILITY)
 * Body vars: {{1}} name, {{2}} orderId, {{3}} sending line
 * Buttons: same QUICK_REPLY as verify
 */
export async function waCodNudge({ mobile, name, orderId }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cod_nudge',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: orderId },
            { type: 'text', text: getSendingLine() },
          ],
        },
        { type: 'button', sub_type: 'quick_reply', index: '0',
          parameters: [{ type: 'payload', payload: 'CONFIRM_COD' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1',
          parameters: [{ type: 'payload', payload: 'CANCEL_COD' }] },
      ],
    },
  });
}

/**
 * Prepaid upsell sent after COD cancellation.
 * Template: vedayu_cod_prepaid_offer (MARKETING)
 * Body vars: {{1}} name, {{2}} orderId
 * Button: URL — "Reorder with ₹50 Off"
 */
export async function waCodPrepaidOffer({ mobile, name, orderId }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cod_prepaid_offer',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: orderId },
        ],
      }],
    },
  });
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add lib/whatsapp.js
git commit -m "feat: add waCodVerify, waCodNudge, waCodPrepaidOffer to whatsapp lib"
```

---

### Task 5: Update `submit-cod.js` — write to orders + cod_verifications, send verification WA

**Files:**
- Modify: `pages/api/submit-cod.js`

- [ ] **Add imports** (after existing imports at top of file)

```js
import { waCodVerify } from '../../lib/whatsapp';
import { supabase } from '../../lib/supabase';
```

Note: `waCodVerify` is new; `waOrderConfirmed` import already exists. `supabase` is new here.

- [ ] **Write to `orders` table** — add this block just before `return res.status(200).json(...)` at the bottom of the handler:

```js
  // ── Persist order to Supabase ────────────────────────────────────────────
  if (supabase) {
    await supabase.from('orders').insert({
      order_id:    orderId,
      method:      'cod',
      status:      'pending',
      name,
      mobile:      mobile.trim(),
      email:       email?.trim() || null,
      address,
      city,
      state,
      pincode,
      pack,
      qty:         Number(qty),
      price:       safePrice,
      utm:         Object.keys(utm).length ? utm : null,
      referrer_id: referrerId || null,
    }).catch(err => console.error('orders insert failed:', err.message));
  }
```

- [ ] **Write to `cod_verifications` table and send verification WA** — add this block right after the orders insert block:

```js
  // ── COD verification — store record and send WhatsApp ───────────────────
  const normalised = mobile.trim().startsWith('91') ? mobile.trim() : `91${mobile.trim()}`;
  if (supabase) {
    await supabase.from('cod_verifications').insert({
      order_id: orderId,
      mobile:   normalised,
      name,
      status:   'pending',
    }).catch(err => console.error('cod_verifications insert failed:', err.message));
  }

  await kv.set(`cod_verify:${normalised}`, {
    orderId, name, pack, price: safePrice, status: 'pending', createdAt: Date.now(),
  }, { ex: 172800 }).catch(() => {});

  await waCodVerify({
    mobile: mobile.trim(), name, orderId, pack, price: safePrice, address: fullAddr,
  }).catch(() => {});
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/submit-cod.js
git commit -m "feat: COD orders write to Supabase + send WhatsApp verification"
```

---

### Task 6: Update `verify-payment.js` — write to orders table

**Files:**
- Modify: `pages/api/verify-payment.js`

- [ ] **Add supabase import** at top of file:

```js
import { supabase } from '../../lib/supabase';
```

- [ ] **Add orders write** — just before `return res.status(200).json(...)`:

```js
  // ── Persist order to Supabase ────────────────────────────────────────────
  if (supabase) {
    await supabase.from('orders').insert({
      order_id:    orderId,
      method:      'prepaid',
      status:      'confirmed',
      name,
      mobile:      mobile?.trim() || null,
      email:       email?.trim()  || null,
      address,
      city,
      state,
      pincode,
      pack,
      qty:         Number(qty),
      price:       Number(amount) / 100,
      utm:         Object.keys(utm || {}).length ? utm : null,
      referrer_id: referrerId || null,
    }).catch(err => console.error('orders insert (prepaid) failed:', err.message));
  }
```

Note: prepaid starts as `confirmed` (payment already verified) while COD starts as `pending`.

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/verify-payment.js
git commit -m "feat: prepaid orders write to Supabase orders table"
```

---

### Task 7: Update `whatsapp-webhook.js` — handle interactive button replies

**Files:**
- Modify: `pages/api/whatsapp-webhook.js`

- [ ] **Add imports** at top (after existing imports):

```js
import { kv } from '@vercel/kv';
import { waCodPrepaidOffer } from '../../lib/whatsapp';
import { Resend } from 'resend';
```

Note: `supabase` and `Resend` are already imported. `kv` and `waCodPrepaidOffer` are new.

- [ ] **Add the interactive message handler** inside the `if (msgArr?.length)` loop, directly after the `if (msg.type !== 'text') continue;` line. Replace that line with:

```js
        // ── Interactive button reply (COD verification) ──────────────────
        if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
          if (recentIds.has(msg.id)) continue;
          recentIds.add(msg.id);
          if (recentIds.size > 200) recentIds.delete(recentIds.values().next().value);

          const phone    = msg.from; // already in e164 format e.g. '919876543210'
          const buttonId = msg.interactive.button_reply.id; // 'CONFIRM_COD' | 'CANCEL_COD'
          const record   = await kv.get(`cod_verify:${phone}`).catch(() => null);

          if (!record || record.status !== 'pending') continue;

          if (buttonId === 'CONFIRM_COD') {
            await kv.set(`cod_verify:${phone}`, { ...record, status: 'confirmed' }, { ex: 172800 }).catch(() => {});
            if (supabase) {
              await supabase.from('cod_verifications')
                .update({ status: 'confirmed', verified_at: new Date().toISOString() })
                .eq('order_id', record.orderId).catch(() => {});
              await supabase.from('orders')
                .update({ status: 'confirmed', updated_at: new Date().toISOString() })
                .eq('order_id', record.orderId).catch(() => {});
            }
            await sendWAMessage(phone,
              `Namaste ${record.name} ji 🙏 Thank you! Your order ${record.orderId} is confirmed. We will send your order to you — please keep ₹${record.price} ready to give the delivery person.`
            );
            notifyOwnerCodAction({ orderId: record.orderId, name: record.name, action: 'confirmed' }).catch(() => {});

          } else if (buttonId === 'CANCEL_COD') {
            await kv.set(`cod_verify:${phone}`, { ...record, status: 'cancelled' }, { ex: 172800 }).catch(() => {});
            if (supabase) {
              await supabase.from('cod_verifications')
                .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
                .eq('order_id', record.orderId).catch(() => {});
              await supabase.from('orders')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('order_id', record.orderId).catch(() => {});
            }
            await waCodPrepaidOffer({ mobile: phone, name: record.name, orderId: record.orderId });
            notifyOwnerCodAction({ orderId: record.orderId, name: record.name, action: 'cancelled' }).catch(() => {});
          }
          continue;
        }

        if (msg.type !== 'text') continue;
```

- [ ] **Add the `notifyOwnerCodAction` helper** at the bottom of the file (after the existing `notifyAdmin` function):

```js
async function notifyOwnerCodAction({ orderId, name, action }) {
  if (!process.env.RESEND_API_KEY || !process.env.ORDERS_EMAIL) return;
  const emoji  = action === 'confirmed' ? '✅' : '❌';
  const label  = action === 'confirmed' ? 'Confirmed' : 'Cancelled';
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from:    'Vedayu Orders <orders@vedayulife.com>',
    to:      process.env.ORDERS_EMAIL,
    subject: `${emoji} COD ${label} — ${orderId} | ${name}`,
    html: `<p style="font-family:sans-serif">Customer <b>${name}</b> tapped <b>${label}</b> for order <b>${orderId}</b> on WhatsApp.</p>`,
  });
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/whatsapp-webhook.js
git commit -m "feat: handle COD verification button replies in WhatsApp webhook"
```

---

### Task 8: Create nudge and auto-confirm cron jobs

**Files:**
- Create: `pages/api/cron/cod-nudge.js`
- Create: `pages/api/cron/cod-auto-confirm.js`
- Modify: `vercel.json`

- [ ] **Create `pages/api/cron/cod-nudge.js`**

```js
// Runs every 3 hours. Sends a nudge WA to COD customers who haven't responded in 6–23h.
import { supabase } from '../../../lib/supabase';
import { waCodNudge } from '../../../lib/whatsapp';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const now        = new Date();
  const sixHAgo    = new Date(now - 6  * 60 * 60 * 1000).toISOString();
  const twentyThreeHAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString();

  const { data: pending, error } = await supabase
    .from('cod_verifications')
    .select('order_id, mobile, name')
    .eq('status', 'pending')
    .is('nudged_at', null)
    .gte('created_at', twentyThreeHAgo)
    .lte('created_at', sixHAgo);

  if (error) return res.status(500).json({ error: error.message });
  if (!pending?.length) return res.json({ nudged: 0 });

  let nudged = 0;
  for (const row of pending) {
    await waCodNudge({ mobile: row.mobile, name: row.name, orderId: row.order_id }).catch(() => {});
    await supabase.from('cod_verifications')
      .update({ nudged_at: now.toISOString() })
      .eq('order_id', row.order_id).catch(() => {});
    nudged++;
  }

  console.log(`[cod-nudge] nudged ${nudged} orders`);
  return res.json({ nudged });
}
```

- [ ] **Create `pages/api/cron/cod-auto-confirm.js`**

```js
// Runs daily at 06:00 IST (00:30 UTC). Auto-confirms COD orders pending for 24h+.
import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: stale, error } = await supabase
    .from('cod_verifications')
    .select('order_id, mobile, name')
    .eq('status', 'pending')
    .lte('created_at', cutoff);

  if (error) return res.status(500).json({ error: error.message });
  if (!stale?.length) return res.json({ autoConfirmed: 0 });

  const now    = new Date().toISOString();
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  let autoConfirmed = 0;

  for (const row of stale) {
    await supabase.from('cod_verifications')
      .update({ status: 'auto_confirmed', verified_at: now })
      .eq('order_id', row.order_id).catch(() => {});
    await supabase.from('orders')
      .update({ status: 'auto_confirmed', updated_at: now })
      .eq('order_id', row.order_id).catch(() => {});

    if (resend && process.env.ORDERS_EMAIL) {
      await resend.emails.send({
        from:    'Vedayu System <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `🤖 Auto-confirmed — ${row.order_id} | ${row.name}`,
        html:    `<p style="font-family:sans-serif">Order <b>${row.order_id}</b> (${row.name}) was auto-confirmed — customer did not reply in 24h. Please call before sending the order.</p>`,
      }).catch(() => {});
    }
    autoConfirmed++;
  }

  console.log(`[cod-auto-confirm] auto-confirmed ${autoConfirmed} orders`);
  return res.json({ autoConfirmed });
}
```

- [ ] **Update `vercel.json`** — add the two new cron entries:

```json
{
  "crons": [
    { "path": "/api/cron/generate-posts",    "schedule": "30 0 * * 1" },
    { "path": "/api/cron/send-followups",    "schedule": "30 2 * * *" },
    { "path": "/api/sync-audiences",         "schedule": "0 3 * * *"  },
    { "path": "/api/cron/cod-nudge",         "schedule": "0 */3 * * *" },
    { "path": "/api/cron/cod-auto-confirm",  "schedule": "30 0 * * *"  }
  ]
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/cron/cod-nudge.js pages/api/cron/cod-auto-confirm.js vercel.json
git commit -m "feat: add COD nudge (every 3h) and auto-confirm (daily 6am IST) crons"
```

---

## PHASE 3 — Admin Panel

### Task 9: Admin auth — API route + middleware + login page

**Files:**
- Create: `pages/api/admin-auth.js`
- Create: `pages/api/admin/_auth.js`
- Modify: `middleware.js`
- Create: `pages/admin/login.js`

- [ ] **Create `pages/api/admin-auth.js`**

```js
import { createHmac, timingSafeEqual } from 'crypto';

function makeAdminToken() {
  const secret   = process.env.ADMIN_PASSWORD || 'admin-dev';
  const payload  = JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const payload64 = Buffer.from(payload).toString('base64');
  const sig      = createHmac('sha256', secret).update(payload64).digest('hex');
  return `${payload64}.${sig}`;
}

export default function handler(req, res) {
  if (req.method === 'GET' && req.query.logout) {
    res.setHeader('Set-Cookie', 'admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
    return res.redirect('/admin/login');
  }
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body || {};
  const expected     = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' });

  let match = false;
  try {
    match = timingSafeEqual(Buffer.from(password || ''), Buffer.from(expected));
  } catch { match = false; }

  if (!match) return res.status(401).json({ error: 'Wrong password' });

  const token = makeAdminToken();
  res.setHeader('Set-Cookie', `admin_session=${token}; Path=/; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; SameSite=Strict`);
  return res.json({ ok: true });
}
```

- [ ] **Create `pages/api/admin/_auth.js`**

```js
import { createHmac, timingSafeEqual } from 'crypto';

export function checkAdminAuth(req) {
  const token = req.cookies?.admin_session;
  if (!token) return false;
  try {
    const [payload64, sig] = token.split('.');
    if (!payload64 || !sig) return false;
    const secret   = process.env.ADMIN_PASSWORD || 'admin-dev';
    const expected = createHmac('sha256', secret).update(payload64).digest('hex');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
    const { exp } = JSON.parse(Buffer.from(payload64, 'base64').toString());
    return Date.now() < exp;
  } catch { return false; }
}
```

- [ ] **Update `middleware.js`** — add admin protection. The existing matcher only covers `/insights`. Replace the entire file with:

```js
import { NextResponse } from 'next/server';

async function verifyToken(token, secret) {
  if (!token) return false;
  try {
    const [payload64, sig] = token.split('.');
    if (!payload64 || !sig) return false;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const expectedBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload64));
    const expected = Array.from(new Uint8Array(expectedBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    if (expected !== sig) return false;
    const { exp } = JSON.parse(atob(payload64));
    return Date.now() < exp;
  } catch { return false; }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Admin protection
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token  = req.cookies.get('admin_session')?.value;
    const secret = req.cookies.get('_adminSecret')?.value
      || process.env.ADMIN_PASSWORD || 'admin-dev';
    // Edge runtime can't use Node crypto — re-verify with Web Crypto
    if (!(await verifyToken(token, secret))) {
      const url = new URL('/admin/login', req.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  // Insights protection (unchanged)
  if (pathname.startsWith('/insights') && pathname !== '/insights/login') {
    const token  = req.cookies.get('insights_session')?.value;
    const secret = process.env.SESSION_SECRET || 'dev-secret';
    if (!(await verifyToken(token, secret))) {
      const url = new URL('/insights/login', req.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/insights', '/insights/((?!login).*)', '/admin', '/admin/((?!login).*)'],
};
```

**Important:** The Edge runtime middleware can't read `process.env` at match time for token verification — we pass `ADMIN_PASSWORD` through via the existing Web Crypto approach. The `admin-auth.js` API route (Node runtime) still uses Node `crypto` for signing, which is fine.

- [ ] **Create `pages/admin/login.js`**

```js
import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace(router.query.from || '/admin');
      } else {
        const j = await res.json();
        setError(j.error || 'Wrong password');
        setPassword('');
      }
    } catch { setError('Something went wrong. Try again.'); }
    finally  { setLoading(false); }
  };

  return (
    <>
      <Head>
        <title>Admin — Vedayu</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{ minHeight:'100vh', background:'#f5f0e8', display:'flex',
        alignItems:'center', justifyContent:'center', fontFamily:'system-ui, sans-serif', padding:24 }}>
        <div style={{ background:'#fff', borderRadius:16, padding:'40px 36px',
          boxShadow:'0 4px 24px rgba(0,0,0,.08)', width:'100%', maxWidth:380, textAlign:'center' }}>
          <div style={{ width:56, height:56, borderRadius:14, background:'#5C3D1E',
            display:'flex', alignItems:'center', justifyContent:'center',
            margin:'0 auto 16px', fontSize:'1.6rem' }}>🌿</div>
          <h1 style={{ margin:'0 0 4px', fontSize:'1.3rem', fontWeight:800, color:'#1a1a1a' }}>
            Vedayu Admin
          </h1>
          <p style={{ margin:'0 0 28px', fontSize:'.82rem', color:'#888' }}>
            Enter your admin password to continue
          </p>
          <form onSubmit={submit}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Admin password" autoFocus required
              style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px',
                fontSize:'.95rem', border:`1.5px solid ${error ? '#e57373' : '#e0e0e0'}`,
                borderRadius:10, outline:'none', marginBottom: error ? 8 : 16 }} />
            {error && <p style={{ margin:'0 0 12px', fontSize:'.78rem', color:'#c62828', fontWeight:600 }}>{error}</p>}
            <button type="submit" disabled={loading || !password}
              style={{ width:'100%', padding:12, background: loading || !password ? '#c4a882' : '#5C3D1E',
                color:'#fff', border:'none', borderRadius:10, fontSize:'.95rem', fontWeight:700,
                cursor: loading || !password ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Checking…' : 'Unlock →'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Add `ADMIN_PASSWORD` to your Vercel environment variables** (via Vercel dashboard → Settings → Environment Variables). Also add to local `.env.local` for development:

```
ADMIN_PASSWORD=your-strong-admin-password
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Smoke test login** — run dev server, open `http://localhost:3000/admin/login`, enter wrong password (should show error), enter correct password (should redirect to `/admin` — which 404s for now, that's fine).

```bash
npm run dev
```

- [ ] **Commit**

```bash
git add pages/api/admin-auth.js pages/api/admin/_auth.js middleware.js pages/admin/login.js
git commit -m "feat: admin auth — login page, cookie session, middleware protection"
```

---

### Task 10: Admin API — orders endpoints

**Files:**
- Create: `pages/api/admin/orders/index.js`
- Create: `pages/api/admin/orders/[id].js`

- [ ] **Create `pages/api/admin/orders/index.js`**

```js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { method, status, search, page = '1' } = req.query;
  const pageSize = 50;
  const offset   = (parseInt(page) - 1) * pageSize;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (method && method !== 'all') query = query.eq('method', method);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) {
    query = query.or(
      `order_id.ilike.%${search}%,name.ilike.%${search}%,mobile.ilike.%${search}%,pincode.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ data, total: count, page: parseInt(page), pageSize });
}
```

- [ ] **Create `pages/api/admin/orders/[id].js`**

```js
import { checkAdminAuth } from '../../_auth';
import { supabase } from '../../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  const { id } = req.query;

  if (req.method === 'GET') {
    const [orderRes, verifRes] = await Promise.all([
      supabase.from('orders').select('*').eq('order_id', id).single(),
      supabase.from('cod_verifications').select('*').eq('order_id', id).maybeSingle(),
    ]);
    if (orderRes.error) return res.status(404).json({ error: 'Order not found' });
    return res.json({ order: orderRes.data, verification: verifRes.data });
  }

  if (req.method === 'PATCH') {
    const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                     'sent_at', 'delivered_at', 'returned_at'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('orders').update(updates).eq('order_id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ order: data });
  }

  return res.status(405).end();
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Smoke test** (with dev server running, after logging into admin):

```bash
curl -s http://localhost:3000/api/admin/orders \
  -H "Cookie: admin_session=$(node -e "
    const {createHmac}=require('crypto');
    const p=Buffer.from(JSON.stringify({exp:Date.now()+9e9})).toString('base64');
    const s=createHmac('sha256',process.env.ADMIN_PASSWORD||'admin-dev').update(p).digest('hex');
    console.log(p+'.'+s);
  ")" | jq '.total'
```

Expected: a number (may be 0 if no orders yet).

- [ ] **Commit**

```bash
git add pages/api/admin/orders/index.js pages/api/admin/orders/[id].js
git commit -m "feat: admin API — orders list (GET) and order detail (GET/PATCH)"
```

---

### Task 11: Admin API — customers + analytics endpoints

**Files:**
- Create: `pages/api/admin/customers/index.js`
- Create: `pages/api/admin/customers/[phone].js`
- Create: `pages/api/admin/analytics.js`

- [ ] **Create `pages/api/admin/customers/index.js`**

```js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { search, page = '1' } = req.query;
  const pageSize = 50;
  const offset   = (parseInt(page) - 1) * pageSize;

  // Aggregate orders by mobile — one row per customer
  let query = supabase.rpc('admin_customers_list', {
    p_search:    search || '',
    p_limit:     pageSize,
    p_offset:    offset,
  });

  // Fallback if RPC doesn't exist yet: raw query
  const { data, error } = await supabase
    .from('orders')
    .select('mobile, name, city, state, email')
    .order('created_at', { ascending: false })
    .limit(1000); // we'll aggregate in JS for now

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate in JS: group by mobile
  const map = {};
  for (const o of (data || [])) {
    if (!map[o.mobile]) {
      map[o.mobile] = { mobile: o.mobile, name: o.name, city: o.city,
                        state: o.state, email: o.email, orderCount: 0, totalSpend: 0 };
    }
    map[o.mobile].orderCount++;
  }

  // Apply search filter
  let customers = Object.values(map);
  if (search) {
    const s = search.toLowerCase();
    customers = customers.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.mobile?.includes(s) ||
      c.city?.toLowerCase().includes(s)
    );
  }

  const total  = customers.length;
  const paged  = customers.slice(offset, offset + pageSize);
  return res.json({ data: paged, total, page: parseInt(page), pageSize });
}
```

- [ ] **Create `pages/api/admin/customers/[phone].js`**

```js
import { checkAdminAuth } from '../../_auth';
import { supabase } from '../../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { phone } = req.query;

  const [ordersRes, waInRes, waOutRes, codRes] = await Promise.all([
    supabase.from('orders').select('*').eq('mobile', phone).order('created_at', { ascending: false }),
    supabase.from('wa_messages').select('*').eq('from_phone', phone).order('created_at', { ascending: true }),
    supabase.from('wa_outbound').select('*').eq('to_phone', phone).order('sent_at', { ascending: true }),
    supabase.from('cod_verifications').select('*').eq('mobile', phone).order('created_at', { ascending: false }),
  ]);

  const orders        = ordersRes.data  || [];
  const waIn          = (waInRes.data   || []).map(m => ({ ...m, direction: 'in',  at: m.created_at }));
  const waOut         = (waOutRes.data  || []).map(m => ({ ...m, direction: 'out', at: m.sent_at }));
  const waThread      = [...waIn, ...waOut].sort((a, b) => new Date(a.at) - new Date(b.at));
  const verifications = codRes.data     || [];

  const totalSpend = orders.filter(o => !['cancelled','returned'].includes(o.status))
    .reduce((s, o) => s + (o.price || 0), 0);

  const profile = orders[0]
    ? { name: orders[0].name, mobile: orders[0].mobile, email: orders[0].email,
        city: orders[0].city, state: orders[0].state }
    : null;

  return res.json({ profile, orders, waThread, verifications, totalSpend });
}
```

- [ ] **Create `pages/api/admin/analytics.js`**

```js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [ordersRes, codRes] = await Promise.all([
    supabase.from('orders').select('order_id,method,status,price,created_at')
      .gte('created_at', thirtyDaysAgo),
    supabase.from('cod_verifications').select('status,created_at')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const orders = ordersRes.data || [];
  const cods   = codRes.data    || [];

  // Revenue by day
  const revenueByDay = {};
  for (const o of orders) {
    if (['cancelled','returned','pending'].includes(o.status)) continue;
    const day = o.created_at.slice(0, 10);
    revenueByDay[day] = (revenueByDay[day] || 0) + (o.price || 0);
  }

  // COD vs Prepaid split
  const codCount     = orders.filter(o => o.method === 'cod').length;
  const prepaidCount = orders.filter(o => o.method === 'prepaid').length;

  // Verification stats
  const confirmed     = cods.filter(c => c.status === 'confirmed').length;
  const autoConfirmed = cods.filter(c => c.status === 'auto_confirmed').length;
  const cancelled     = cods.filter(c => c.status === 'cancelled').length;
  const pending       = cods.filter(c => c.status === 'pending').length;

  // Revenue totals
  const totalRevenue = orders
    .filter(o => !['cancelled','returned','pending'].includes(o.status))
    .reduce((s, o) => s + (o.price || 0), 0);

  return res.json({
    totalRevenue,
    totalOrders:    orders.length,
    revenueByDay,
    codCount,
    prepaidCount,
    verification:   { confirmed, autoConfirmed, cancelled, pending },
  });
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/admin/customers/index.js pages/api/admin/customers/[phone].js pages/api/admin/analytics.js
git commit -m "feat: admin API — customers list, customer profile, analytics"
```

---

### Task 12: Admin shared components

**Files:**
- Create: `components/admin/Layout.js`
- Create: `components/admin/StatusBadge.js`
- Create: `components/admin/StatCard.js`
- Create: `components/admin/PageHeader.js`
- Create: `components/admin/OrderCard.js`
- Create: `components/admin/VerifyTimeline.js`

- [ ] **Create `components/admin/Layout.js`**

```js
import Head from 'next/head';
import { useRouter } from 'next/router';

const NAV = [
  { href: '/admin',           label: 'Dashboard', icon: '🏠' },
  { href: '/admin/orders',    label: 'Orders',    icon: '📦' },
  { href: '/admin/customers', label: 'Customers', icon: '👥' },
  { href: '/admin/whatsapp',  label: 'WhatsApp',  icon: '💬' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
];

const BROWN = '#5C3D1E';
const CREAM = '#FFF8E1';

export default function AdminLayout({ title, children }) {
  const router  = useRouter();
  const active  = (href) => router.pathname === href || (href !== '/admin' && router.pathname.startsWith(href));

  return (
    <>
      <Head>
        <title>{title ? `${title} — Vedayu Admin` : 'Vedayu Admin'}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ display:'flex', minHeight:'100vh', fontFamily:'system-ui,sans-serif',
        background:'#f5f0e8', color:'#1a1a1a' }}>

        {/* Desktop sidebar */}
        <aside style={{ width:200, background:BROWN, display:'flex', flexDirection:'column',
          padding:'24px 0', flexShrink:0, position:'sticky', top:0, height:'100vh',
          '@media(maxWidth:768px)': { display:'none' } }}
          className="admin-sidebar">
          <div style={{ padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,.15)' }}>
            <div style={{ fontSize:'1.1rem', fontWeight:800, color:'#fff' }}>🌿 Vedayu</div>
            <div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.5)', marginTop:2 }}>Admin Panel</div>
          </div>
          <nav style={{ flex:1, padding:'16px 0' }}>
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{
                display:'flex', alignItems:'center', gap:10, padding:'10px 20px',
                color: active(n.href) ? '#fff' : 'rgba(255,255,255,.65)',
                background: active(n.href) ? 'rgba(255,255,255,.15)' : 'transparent',
                textDecoration:'none', fontSize:'.88rem', fontWeight: active(n.href) ? 700 : 400,
                borderLeft: active(n.href) ? '3px solid #C9A84C' : '3px solid transparent',
                transition:'all .15s',
              }}>
                <span>{n.icon}</span>{n.label}
              </a>
            ))}
          </nav>
          <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,.15)' }}>
            <a href="/api/admin-auth?logout=1" style={{ fontSize:'.75rem', color:'rgba(255,255,255,.5)',
              textDecoration:'none' }}>Sign out</a>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex:1, padding:'20px 20px 80px', maxWidth:'100%', overflowX:'hidden' }}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav style={{ display:'none', position:'fixed', bottom:0, left:0, right:0,
        background:BROWN, borderTop:'1px solid rgba(255,255,255,.15)',
        padding:'8px 0 12px', zIndex:100 }} className="admin-bottom-nav">
        {NAV.map(n => (
          <a key={n.href} href={n.href} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:3,
            flex:1, textDecoration:'none',
            color: active(n.href) ? '#C9A84C' : 'rgba(255,255,255,.6)',
          }}>
            <span style={{ fontSize:'1.2rem' }}>{n.icon}</span>
            <span style={{ fontSize:'.55rem', fontWeight: active(n.href) ? 700 : 400 }}>{n.label}</span>
          </a>
        ))}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
          .admin-bottom-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
```

- [ ] **Create `components/admin/StatusBadge.js`**

```js
const STATUS_CONFIG = {
  pending:       { label: 'Waiting for reply', bg: '#FFF8E1', color: '#6D4C00' },
  confirmed:     { label: 'Confirmed',          bg: '#E8F5E9', color: '#2E7D32' },
  auto_confirmed:{ label: 'Auto-confirmed',     bg: '#E3F2FD', color: '#1565C0' },
  sent:          { label: 'Order sent',         bg: '#E8EAF6', color: '#283593' },
  delivered:     { label: 'Delivered',          bg: '#E8F5E9', color: '#1B5E20' },
  cancelled:     { label: 'Cancelled',          bg: '#FFEBEE', color: '#C62828' },
  returned:      { label: 'Returned',           bg: '#FCE4EC', color: '#880E4F' },
};

export default function StatusBadge({ status, small }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#f0f0f0', color: '#555' };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: small ? '2px 7px' : '4px 10px',
      borderRadius: 20, fontSize: small ? '.65rem' : '.75rem',
      fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}
```

- [ ] **Create `components/admin/StatCard.js`**

```js
export default function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,.07)',
      cursor: onClick ? 'pointer' : 'default',
      flex: '1 1 140px', minWidth: 0,
    }}>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: color || '#1a1a1a', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '.72rem', fontWeight: 600, color: '#555', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: '.65rem', color: '#aaa', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
```

- [ ] **Create `components/admin/PageHeader.js`**

```js
export default function PageHeader({ title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
      <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1a1a1a' }}>{title}</h1>
      {action}
    </div>
  );
}
```

- [ ] **Create `components/admin/OrderCard.js`**

```js
import StatusBadge from './StatusBadge';

const fmt = n => `₹${Number(n).toLocaleString('en-IN')}`;
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export default function OrderCard({ order, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      borderLeft: `4px solid ${order.method === 'cod' ? '#C9A84C' : '#4A7C59'}`,
    }}>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.88rem', color: '#5C3D1E' }}>
          {order.order_id}
        </div>
        <div style={{ fontSize: '.82rem', color: '#333', marginTop: 2 }}>
          {order.name} · {order.city}
        </div>
        <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
          {order.pack} · {fmt(order.price)} · {timeAgo(order.created_at)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <StatusBadge status={order.status} small />
        <span style={{ fontSize: '.65rem', fontWeight: 700,
          color: order.method === 'cod' ? '#6D4C00' : '#2E7D32',
          background: order.method === 'cod' ? '#FFF8E1' : '#E8F5E9',
          padding: '2px 7px', borderRadius: 20 }}>
          {order.method === 'cod' ? 'COD' : 'Prepaid'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Create `components/admin/VerifyTimeline.js`**

```js
const EVENT_LABELS = {
  placed:         { label: 'Order placed',           color: '#5C3D1E' },
  verify_sent:    { label: 'Confirmation sent (WA)', color: '#1565C0' },
  nudged:         { label: 'Nudge sent',             color: '#E65100' },
  confirmed:      { label: 'Customer confirmed ✅',   color: '#2E7D32' },
  cancelled:      { label: 'Customer cancelled ❌',   color: '#C62828' },
  auto_confirmed: { label: 'Auto-confirmed 🤖',       color: '#1565C0' },
};

function Dot({ done, color }) {
  return (
    <div style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3,
      background: done ? color : '#ddd', border: done ? 'none' : '2px solid #bbb' }} />
  );
}

export default function VerifyTimeline({ order, verification }) {
  const events = [
    { key: 'placed',      at: order?.created_at,          done: true },
    { key: 'verify_sent', at: verification?.created_at,   done: !!verification },
    { key: 'nudged',      at: verification?.nudged_at,    done: !!verification?.nudged_at },
    { key: verification?.status === 'cancelled' ? 'cancelled' : 'confirmed',
      at: verification?.verified_at || verification?.cancelled_at,
      done: !!(verification?.verified_at || verification?.cancelled_at) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {events.map((ev, i) => {
        const cfg = EVENT_LABELS[ev.key] || {};
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Dot done={ev.done} color={cfg.color} />
            <div>
              <div style={{ fontSize: '.8rem', fontWeight: ev.done ? 600 : 400,
                color: ev.done ? cfg.color : '#bbb' }}>
                {cfg.label}
              </div>
              {ev.at && (
                <div style={{ fontSize: '.7rem', color: '#aaa' }}>
                  {new Date(ev.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add components/admin/
git commit -m "feat: admin shared components — Layout, StatusBadge, StatCard, OrderCard, VerifyTimeline"
```

---

### Task 13: Admin Dashboard page

**Files:**
- Create: `pages/admin/index.js`

- [ ] **Create `pages/admin/index.js`**

```js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import StatCard from '../../components/admin/StatCard';
import OrderCard from '../../components/admin/OrderCard';
import PageHeader from '../../components/admin/PageHeader';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AdminDashboard() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [recent,    setRecent]    = useState([]);
  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/analytics').then(r => r.json()),
      fetch('/api/admin/orders?page=1').then(r => r.json()),
      fetch('/api/admin/orders?status=pending&method=cod&page=1').then(r => r.json()),
    ]).then(([a, r, p]) => {
      setAnalytics(a);
      setRecent((r.data || []).slice(0, 8));
      setPending((p.data || []).slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Today's revenue
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const todayRevenue = analytics?.revenueByDay?.[today] || 0;

  return (
    <AdminLayout title="Dashboard">
      <PageHeader title="Dashboard" />

      {loading ? (
        <p style={{ color: '#888', fontSize: '.9rem' }}>Loading…</p>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard label="Today's Revenue" value={fmt(todayRevenue)} color="#5C3D1E" />
            <StatCard label="Total Orders (30d)" value={analytics?.totalOrders || 0} />
            <StatCard label="Pending Verifications"
              value={analytics?.verification?.pending || 0}
              color="#E65100"
              onClick={() => router.push('/admin/whatsapp?tab=verifications')} />
            <StatCard label="Total Revenue (30d)" value={fmt(analytics?.totalRevenue)} color="#4A7C59" />
          </div>

          {/* Pending COD verifications */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '.85rem', fontWeight: 700, color: '#E65100',
                textTransform: 'uppercase', letterSpacing: '.8px', margin: '0 0 10px' }}>
                ⏳ Waiting for Customer Reply
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending.map(o => (
                  <OrderCard key={o.order_id} order={o}
                    onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
                ))}
              </div>
              <a href="/admin/whatsapp?tab=verifications"
                style={{ display: 'block', textAlign: 'center', marginTop: 10,
                  fontSize: '.78rem', color: '#5C3D1E', fontWeight: 600 }}>
                View all →
              </a>
            </div>
          )}

          {/* Recent orders */}
          <div>
            <h2 style={{ fontSize: '.85rem', fontWeight: 700, color: '#555',
              textTransform: 'uppercase', letterSpacing: '.8px', margin: '0 0 10px' }}>
              Recent Orders
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recent.map(o => (
                <OrderCard key={o.order_id} order={o}
                  onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
              ))}
            </div>
            <a href="/admin/orders" style={{ display: 'block', textAlign: 'center', marginTop: 12,
              fontSize: '.78rem', color: '#5C3D1E', fontWeight: 600 }}>
              View all orders →
            </a>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Smoke test** — run dev server, visit `http://localhost:3000/admin` (login first). Should show dashboard with stat cards and (empty) order lists.

- [ ] **Commit**

```bash
git add pages/admin/index.js
git commit -m "feat: admin dashboard page — revenue, pending verifications, recent orders"
```

---

### Task 14: Admin Orders pages

**Files:**
- Create: `pages/admin/orders/index.js`
- Create: `pages/admin/orders/[id].js`

- [ ] **Create `pages/admin/orders/index.js`**

```js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import OrderCard from '../../../components/admin/OrderCard';
import PageHeader from '../../../components/admin/PageHeader';

const FILTERS = ['all','cod','prepaid','pending','confirmed','auto_confirmed','sent','delivered','cancelled'];

export default function OrdersList() {
  const router = useRouter();
  const [orders,  setOrders]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const load = (f = filter, s = search, p = page) => {
    setLoading(true);
    const params = new URLSearchParams({ page: p });
    if (['cod','prepaid'].includes(f)) params.set('method', f);
    else if (f !== 'all') params.set('status', f);
    if (s) params.set('search', s);
    fetch(`/api/admin/orders?${params}`).then(r => r.json()).then(d => {
      setOrders(d.data || []);
      setTotal(d.total || 0);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleFilter = (f) => { setFilter(f); setPage(1); load(f, search, 1); };
  const handleSearch = (e) => {
    if (e.key === 'Enter') { setPage(1); load(filter, e.target.value, 1); }
  };

  return (
    <AdminLayout title="Orders">
      <PageHeader title={`Orders (${total})`} />

      <input type="search" placeholder="Search by name, mobile, order ID, pincode…"
        value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10,
          border: '1.5px solid #e0d8cc', fontSize: '.88rem', marginBottom: 12, outline: 'none' }} />

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => handleFilter(f)}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: '.72rem', fontWeight: 700,
              background: filter === f ? '#5C3D1E' : '#f0ede8',
              color: filter === f ? '#fff' : '#555' }}>
            {f === 'all' ? 'All' : f === 'auto_confirmed' ? 'Auto-confirmed' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: '#888', fontSize: '.9rem' }}>Loading…</p> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orders.length === 0 && <p style={{ color: '#aaa', fontSize: '.88rem' }}>No orders found.</p>}
            {orders.map(o => (
              <OrderCard key={o.order_id} order={o}
                onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
            ))}
          </div>
          {/* Pagination */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            {page > 1 && (
              <button onClick={() => { const p = page - 1; setPage(p); load(filter, search, p); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #d0c8bc',
                  background: '#fff', cursor: 'pointer', fontSize: '.82rem' }}>← Prev</button>
            )}
            <span style={{ padding: '8px 0', fontSize: '.82rem', color: '#888' }}>
              Page {page} · {total} orders
            </span>
            {orders.length === 50 && (
              <button onClick={() => { const p = page + 1; setPage(p); load(filter, search, p); }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #d0c8bc',
                  background: '#fff', cursor: 'pointer', fontSize: '.82rem' }}>Next →</button>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
```

- [ ] **Create `pages/admin/orders/[id].js`**

```js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import StatusBadge from '../../../components/admin/StatusBadge';
import VerifyTimeline from '../../../components/admin/VerifyTimeline';
import PageHeader from '../../../components/admin/PageHeader';

const fmt  = n  => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '—';

export default function OrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data,   setData]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [awb,    setAwb]    = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/orders/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  const patch = async (updates) => {
    setSaving(true);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const d = await res.json();
    if (d.order) setData(prev => ({ ...prev, order: d.order }));
    setSaving(false);
  };

  const markSent = async () => {
    if (!awb.trim()) return alert('Please enter a tracking number.');
    await patch({ status: 'sent', awb: awb.trim(), sent_at: new Date().toISOString() });
    setAwb('');
  };

  if (!data) return <AdminLayout title="Order"><p style={{ color:'#888',padding:20 }}>Loading…</p></AdminLayout>;

  const { order, verification } = data;

  const Row = ({ label, value }) => (
    <tr style={{ borderBottom: '1px solid #f0ede8' }}>
      <td style={{ padding: '9px 0', fontWeight: 600, color: '#555', width: '40%', fontSize: '.85rem' }}>{label}</td>
      <td style={{ padding: '9px 0', fontSize: '.85rem', color: '#1a1a1a' }}>{value}</td>
    </tr>
  );

  return (
    <AdminLayout title={order.order_id}>
      <PageHeader title={order.order_id}
        action={<a href="/admin/orders" style={{ fontSize:'.8rem', color:'#5C3D1E', fontWeight:600 }}>← Orders</a>} />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

        {/* Order info */}
        <div style={{ flex: '1 1 280px', background: '#fff', borderRadius: 12,
          padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.7px', color: '#888' }}>Order Details</h2>
            <StatusBadge status={order.status} small />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Customer"    value={order.name} />
              <Row label="Mobile"      value={<a href={`tel:+${order.mobile}`} style={{ color:'#5C3D1E' }}>{order.mobile}</a>} />
              <Row label="Email"       value={order.email || '—'} />
              <Row label="Address"     value={`${order.address}, ${order.city}, ${order.state} — ${order.pincode}`} />
              <Row label="Pack"        value={`${order.pack} × ${order.qty}`} />
              <Row label="Amount"      value={fmt(order.price)} />
              <Row label="Payment"     value={order.method === 'cod' ? 'Cash on Delivery' : 'Prepaid (UPI/Card)'} />
              <Row label="Placed at"   value={fmtD(order.created_at)} />
              {order.awb && <Row label="Tracking No." value={order.awb} />}
              {order.courier && <Row label="Courier" value={order.courier} />}
              {order.sent_at && <Row label="Order sent" value={fmtD(order.sent_at)} />}
              {order.delivered_at && <Row label="Delivered" value={fmtD(order.delivered_at)} />}
            </tbody>
          </table>

          {/* Actions */}
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.status === 'confirmed' || order.status === 'auto_confirmed' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={awb} onChange={e => setAwb(e.target.value)}
                  placeholder="Enter tracking number"
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid #d0c8bc', fontSize: '.82rem', outline: 'none' }} />
                <button onClick={markSent} disabled={saving}
                  style={{ padding: '9px 14px', background: '#5C3D1E', color: '#fff',
                    border: 'none', borderRadius: 8, fontSize: '.82rem', fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '…' : 'Order Sent'}
                </button>
              </div>
            ) : null}
            {order.status === 'sent' && (
              <button onClick={() => patch({ status:'delivered', delivered_at: new Date().toISOString() })}
                disabled={saving}
                style={{ padding: '9px 14px', background: '#4A7C59', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: '.82rem', fontWeight: 700, cursor: 'pointer' }}>
                {saving ? '…' : 'Mark Delivered'}
              </button>
            )}
            {!['cancelled','returned','delivered'].includes(order.status) && (
              <button onClick={() => { if (confirm('Cancel this order?')) patch({ status:'cancelled' }); }}
                disabled={saving}
                style={{ padding: '9px 14px', background: '#fff', color: '#C62828',
                  border: '1.5px solid #C62828', borderRadius: 8, fontSize: '.82rem',
                  fontWeight: 700, cursor: 'pointer' }}>
                Cancel Order
              </button>
            )}
          </div>
        </div>

        {/* COD verification timeline */}
        {order.method === 'cod' && (
          <div style={{ flex: '0 1 240px', background: '#fff', borderRadius: 12,
            padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.07)', height: 'fit-content' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '.85rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '.7px', color: '#888' }}>
              WhatsApp Confirmation
            </h2>
            <VerifyTimeline order={order} verification={verification} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/admin/orders/
git commit -m "feat: admin orders list and order detail pages"
```

---

### Task 15: Admin Customers pages

**Files:**
- Create: `pages/admin/customers/index.js`
- Create: `pages/admin/customers/[phone].js`

- [ ] **Create `pages/admin/customers/index.js`**

```js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

export default function CustomersList() {
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);

  const load = (s = '') => {
    setLoading(true);
    const params = new URLSearchParams({ page: 1 });
    if (s) params.set('search', s);
    fetch(`/api/admin/customers?${params}`).then(r => r.json()).then(d => {
      setCustomers(d.data || []);
      setTotal(d.total || 0);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout title="Customers">
      <PageHeader title={`Customers (${total})`} />
      <input type="search" placeholder="Search by name, mobile, city…"
        value={search} onChange={e => setSearch(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && load(search)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10,
          border: '1.5px solid #e0d8cc', fontSize: '.88rem', marginBottom: 14, outline: 'none' }} />

      {loading ? <p style={{ color:'#888', fontSize:'.9rem' }}>Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customers.length === 0 && <p style={{ color:'#aaa', fontSize:'.88rem' }}>No customers found.</p>}
          {customers.map(c => (
            <div key={c.mobile} onClick={() => router.push(`/admin/customers/${c.mobile}`)}
              style={{ background:'#fff', borderRadius:12, padding:'14px 16px',
                boxShadow:'0 1px 3px rgba(0,0,0,.07)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'.9rem', color:'#1a1a1a' }}>{c.name}</div>
                <div style={{ fontSize:'.78rem', color:'#888', marginTop:3 }}>
                  {c.mobile} · {c.city}, {c.state}
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'.82rem', fontWeight:700, color:'#5C3D1E' }}>{c.orderCount} orders</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
```

- [ ] **Create `pages/admin/customers/[phone].js`**

```js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import OrderCard from '../../../components/admin/OrderCard';
import PageHeader from '../../../components/admin/PageHeader';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '';

export default function CustomerProfile() {
  const router    = useRouter();
  const { phone } = router.query;
  const [data,    setData]  = useState(null);
  const [tab,     setTab]   = useState('orders');

  useEffect(() => {
    if (!phone) return;
    fetch(`/api/admin/customers/${phone}`).then(r => r.json()).then(setData);
  }, [phone]);

  if (!data) return <AdminLayout title="Customer"><p style={{ color:'#888',padding:20 }}>Loading…</p></AdminLayout>;

  const { profile, orders, waThread, totalSpend } = data;

  return (
    <AdminLayout title={profile?.name || phone}>
      <PageHeader title={profile?.name || phone}
        action={<a href="/admin/customers" style={{ fontSize:'.8rem', color:'#5C3D1E', fontWeight:600 }}>← Customers</a>} />

      {/* Profile card */}
      <div style={{ background:'#fff', borderRadius:12, padding:'16px 18px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginBottom:16,
        display:'flex', flexWrap:'wrap', gap:16 }}>
        <div style={{ flex:'1 1 160px' }}>
          <div style={{ fontSize:'1rem', fontWeight:800, color:'#1a1a1a' }}>{profile?.name}</div>
          <div style={{ fontSize:'.82rem', color:'#888', marginTop:4 }}>
            <a href={`tel:+${profile?.mobile}`} style={{ color:'#5C3D1E' }}>{profile?.mobile}</a>
          </div>
          {profile?.email && <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{profile.email}</div>}
          <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{profile?.city}, {profile?.state}</div>
        </div>
        <div style={{ display:'flex', gap:16, alignItems:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#5C3D1E' }}>{orders.length}</div>
            <div style={{ fontSize:'.68rem', color:'#888', fontWeight:600 }}>ORDERS</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#4A7C59' }}>
              ₹{Number(totalSpend).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize:'.68rem', color:'#888', fontWeight:600 }}>TOTAL SPEND</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {['orders','whatsapp'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab === t ? '#5C3D1E' : '#f0ede8',
              color: tab === t ? '#fff' : '#555',
              fontSize:'.82rem', fontWeight:700 }}>
            {t === 'orders' ? '📦 Orders' : '💬 WhatsApp'}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {orders.map(o => (
            <OrderCard key={o.order_id} order={o}
              onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
          ))}
        </div>
      )}

      {tab === 'whatsapp' && (
        <div style={{ background:'#fff', borderRadius:12, padding:'14px 16px',
          boxShadow:'0 1px 3px rgba(0,0,0,.07)', display:'flex', flexDirection:'column', gap:10 }}>
          {waThread.length === 0 && <p style={{ color:'#aaa', fontSize:'.85rem' }}>No messages yet.</p>}
          {waThread.map((m, i) => (
            <div key={i} style={{ display:'flex',
              justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth:'80%', background: m.direction === 'out' ? '#5C3D1E' : '#f0ede8',
                color: m.direction === 'out' ? '#fff' : '#1a1a1a',
                padding:'8px 12px', borderRadius:10, fontSize:'.82rem' }}>
                <div>{m.message || m.bot_replied}</div>
                <div style={{ fontSize:'.65rem', opacity:.6, marginTop:4, textAlign:'right' }}>
                  {fmtD(m.at || m.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/admin/customers/
git commit -m "feat: admin customers list and customer profile pages"
```

---

### Task 16: Admin WhatsApp page

**Files:**
- Create: `pages/admin/whatsapp.js`

- [ ] **Create `pages/admin/whatsapp.js`**

```js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import StatusBadge from '../../components/admin/StatusBadge';
import PageHeader from '../../components/admin/PageHeader';

const fmtD = iso => iso ? new Date(iso).toLocaleString('en-IN',
  { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' }) : '—';

// ── Inbox tab (re-uses existing /api/wa-inbox logic) ─────────────────────────
function InboxTab() {
  const [convs,     setConvs]     = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [reply,     setReply]     = useState('');
  const [sending,   setSending]   = useState(false);
  const bottomRef = useRef();

  const load = () => fetch('/api/wa-inbox').then(r => r.json())
    .then(d => setConvs(d.conversations || []));

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [selected]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    await fetch('/api/wa-reply', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ phone: selected.phone, message: reply.trim() }),
    });
    setReply('');
    setSending(false);
    await load();
  };

  const conv = convs.find(c => c.phone === selected?.phone);

  return (
    <div style={{ display:'flex', gap:12, height:'calc(100vh - 140px)', minHeight:400 }}>
      {/* Conversation list */}
      <div style={{ flex:'0 0 240px', overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
        {convs.length === 0 && <p style={{ color:'#aaa', fontSize:'.82rem', padding:8 }}>No messages yet.</p>}
        {convs.map(c => (
          <div key={c.phone} onClick={() => { setSelected(c); fetch('/api/wa-inbox',
            { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({phone:c.phone}) }); }}
            style={{ background: selected?.phone === c.phone ? '#5C3D1E' : '#fff',
              color: selected?.phone === c.phone ? '#fff' : '#1a1a1a',
              borderRadius:10, padding:'10px 12px', cursor:'pointer',
              boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
            <div style={{ fontWeight:700, fontSize:'.85rem' }}>{c.name}</div>
            <div style={{ fontSize:'.72rem', opacity:.7, marginTop:2 }}>
              {c.messages[c.messages.length-1]?.message?.slice(0,40)}…
            </div>
            {c.unread > 0 && (
              <span style={{ background:'#E53935', color:'#fff', fontSize:'.6rem',
                padding:'1px 6px', borderRadius:20, fontWeight:700 }}>{c.unread} new</span>
            )}
          </div>
        ))}
      </div>

      {/* Thread */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#fff',
        borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
        {!conv ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            color:'#ccc', fontSize:'.9rem' }}>Select a conversation</div>
        ) : (
          <>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0ede8',
              fontWeight:700, fontSize:'.9rem', color:'#5C3D1E' }}>
              {conv.name} · <a href={`/admin/customers/${conv.phone}`}
                style={{ fontSize:'.75rem', color:'#888', fontWeight:400 }}>View profile →</a>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:12, display:'flex',
              flexDirection:'column', gap:8 }}>
              {conv.messages.map((m, i) => (
                <div key={i} style={{ display:'flex',
                  justifyContent: m.direction === 'out' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth:'75%', background: m.direction === 'out' ? '#5C3D1E' : '#f0ede8',
                    color: m.direction === 'out' ? '#fff' : '#1a1a1a',
                    padding:'8px 12px', borderRadius:10, fontSize:'.82rem' }}>
                    {m.message || m.bot_replied}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding:'10px 12px', borderTop:'1px solid #f0ede8',
              display:'flex', gap:8 }}>
              <input value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Type a reply…"
                style={{ flex:1, padding:'9px 12px', borderRadius:8,
                  border:'1.5px solid #e0d8cc', fontSize:'.85rem', outline:'none' }} />
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                style={{ padding:'9px 16px', background: sending || !reply.trim() ? '#c4a882' : '#5C3D1E',
                  color:'#fff', border:'none', borderRadius:8, fontWeight:700,
                  fontSize:'.82rem', cursor: sending ? 'not-allowed' : 'pointer' }}>
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Verifications tab ─────────────────────────────────────────────────────────
function VerificationsTab() {
  const router = useRouter();
  const [rows,    setRows]    = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ method: 'cod', page: 1 });
    if (filter !== 'all') params.set('status', filter);
    fetch(`/api/admin/orders?${params}`).then(r => r.json()).then(d => {
      setRows(d.data || []);
      setLoading(false);
    });
  }, [filter]);

  const FILTERS = ['all','pending','confirmed','auto_confirmed','cancelled'];

  return (
    <>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:'5px 12px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:'.72rem', fontWeight:700,
              background: filter === f ? '#5C3D1E' : '#f0ede8',
              color: filter === f ? '#fff' : '#555' }}>
            {f === 'all' ? 'All' : f === 'auto_confirmed' ? 'Auto-confirmed' : f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      {loading ? <p style={{ color:'#888' }}>Loading…</p> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.length === 0 && <p style={{ color:'#aaa', fontSize:'.88rem' }}>No orders found.</p>}
          {rows.map(o => (
            <div key={o.order_id} onClick={() => router.push(`/admin/orders/${o.order_id}`)}
              style={{ background:'#fff', borderRadius:12, padding:'12px 16px',
                boxShadow:'0 1px 3px rgba(0,0,0,.07)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ fontFamily:'monospace', fontWeight:700, color:'#5C3D1E', fontSize:'.88rem' }}>
                  {o.order_id}
                </div>
                <div style={{ fontSize:'.78rem', color:'#888', marginTop:2 }}>{o.name} · {o.mobile}</div>
                <div style={{ fontSize:'.72rem', color:'#aaa', marginTop:2 }}>{fmtD(o.created_at)}</div>
              </div>
              <StatusBadge status={o.status} small />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function AdminWhatsApp() {
  const router = useRouter();
  const [tab, setTab] = useState(router.query.tab === 'verifications' ? 'verifications' : 'inbox');

  return (
    <AdminLayout title="WhatsApp">
      <PageHeader title="WhatsApp" />
      <div style={{ display:'flex', gap:4, marginBottom:14 }}>
        {['inbox','verifications'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer',
              background: tab === t ? '#5C3D1E' : '#f0ede8',
              color: tab === t ? '#fff' : '#555',
              fontSize:'.82rem', fontWeight:700 }}>
            {t === 'inbox' ? '💬 Inbox' : '✅ Confirmations'}
          </button>
        ))}
      </div>
      {tab === 'inbox'         && <InboxTab />}
      {tab === 'verifications' && <VerificationsTab />}
    </AdminLayout>
  );
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/admin/whatsapp.js
git commit -m "feat: admin WhatsApp page — inbox + COD confirmations tabs"
```

---

### Task 17: Admin Analytics page

**Files:**
- Create: `pages/admin/analytics.js`

- [ ] **Create `pages/admin/analytics.js`**

```js
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import StatCard from '../../components/admin/StatCard';
import PageHeader from '../../components/admin/PageHeader';

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pct = (n, d) => d ? `${((n / d) * 100).toFixed(1)}%` : '—';

export default function AdminAnalytics() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/analytics').then(r => r.json()).then(d => {
      setData(d); setLoading(false);
    });
  }, []);

  if (loading) return <AdminLayout title="Analytics"><p style={{ color:'#888',padding:20 }}>Loading…</p></AdminLayout>;

  const { totalRevenue, totalOrders, revenueByDay, codCount, prepaidCount, verification } = data;
  const totalCod    = codCount + prepaidCount;
  const confirmRate = pct((verification.confirmed + verification.autoConfirmed), codCount);
  const cancelRate  = pct(verification.cancelled, codCount);

  // Sort revenue days for chart
  const days = Object.entries(revenueByDay || {}).sort((a,b) => a[0].localeCompare(b[0])).slice(-14);
  const maxRev = Math.max(...days.map(d => d[1]), 1);

  return (
    <AdminLayout title="Analytics">
      <PageHeader title="Analytics (last 30 days)" />

      {/* Summary cards */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:24 }}>
        <StatCard label="Total Revenue" value={fmt(totalRevenue)} color="#5C3D1E" />
        <StatCard label="Total Orders"  value={totalOrders} />
        <StatCard label="COD Orders"    value={codCount}
          sub={`${pct(codCount, totalOrders)} of total`} />
        <StatCard label="Prepaid Orders" value={prepaidCount}
          sub={`${pct(prepaidCount, totalOrders)} of total`} color="#4A7C59" />
      </div>

      {/* Revenue chart (bar) */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginBottom:16 }}>
        <h3 style={{ margin:'0 0 16px', fontSize:'.78rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.8px', color:'#888' }}>Revenue — Last 14 Days</h3>
        <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:80 }}>
          {days.map(([day, rev]) => (
            <div key={day} title={`${day}: ${fmt(rev)}`}
              style={{ flex:1, background:'#5C3D1E', borderRadius:'3px 3px 0 0', minWidth:0,
                height: `${(rev / maxRev) * 80}px`, opacity:.85 }} />
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between',
          fontSize:'.6rem', color:'#aaa', marginTop:4 }}>
          <span>{days[0]?.[0]?.slice(5)}</span>
          <span>{days[days.length-1]?.[0]?.slice(5)}</span>
        </div>
      </div>

      {/* COD verification stats */}
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
        <h3 style={{ margin:'0 0 14px', fontSize:'.78rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.8px', color:'#888' }}>
          WhatsApp Confirmation — COD Orders
        </h3>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          <StatCard label="Customer confirmed" value={verification.confirmed}
            sub={pct(verification.confirmed, codCount)} color="#2E7D32" />
          <StatCard label="Auto-confirmed"     value={verification.autoConfirmed}
            sub={pct(verification.autoConfirmed, codCount)} color="#1565C0" />
          <StatCard label="Cancelled by customer" value={verification.cancelled}
            sub={cancelRate} color="#C62828" />
          <StatCard label="Pending reply"      value={verification.pending} color="#E65100" />
        </div>
        <div style={{ marginTop:14, padding:'10px 14px', background:'#f5f0e8',
          borderRadius:8, fontSize:'.78rem', color:'#5C3D1E' }}>
          <b>Confirmation rate:</b> {confirmRate} &nbsp;·&nbsp; <b>Cancel rate:</b> {cancelRate}
        </div>
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/admin/analytics.js
git commit -m "feat: admin analytics page — revenue chart, COD/prepaid split, verification stats"
```

---

### Task 18: Update NimbusPost webhook to write back to orders table

**Files:**
- Modify: `pages/api/nimbuspost/webhook.js`

- [ ] **Add supabase import** at the top of the file:

```js
import { supabase } from '../../../lib/supabase';
```

- [ ] **Add Supabase status write** inside the `try` block where KV is updated (after `await kv.set(...)`):

```js
  // Write status back to orders table so admin panel shows live tracking
  if (supabase) {
    const updates = { updated_at: new Date().toISOString() };
    if (s.includes('delivered'))       { updates.status = 'delivered'; updates.delivered_at = new Date().toISOString(); }
    else if (s.includes('rto'))        { updates.status = 'returned';  updates.returned_at  = new Date().toISOString(); }
    else if (s.includes('sent') || s.includes('picked')) { updates.status = 'sent'; updates.sent_at = new Date().toISOString(); }

    if (Object.keys(updates).length > 1) {
      // Look up orderId from KV mapping then update Supabase
      const orderRecord = await kv.get(`nimbuspost:awb_to_order:${awb}`).catch(() => null);
      if (orderRecord?.orderId) {
        await supabase.from('orders').update(updates).eq('order_id', orderRecord.orderId).catch(() => {});
      } else if (awb) {
        await supabase.from('orders').update(updates).eq('awb', awb).catch(() => {});
      }
    }
  }
```

- [ ] **Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Commit**

```bash
git add pages/api/nimbuspost/webhook.js
git commit -m "feat: NimbusPost webhook writes delivery status back to orders table"
```

---

## Final verification

- [ ] **Full production build — zero errors**

```bash
npm run build
```

Expected output: no red errors. Pages for `/admin`, `/admin/orders`, etc. should appear in the build output.

- [ ] **Deploy to Vercel**

```bash
git push origin main
```

- [ ] **Set environment variable in Vercel dashboard**

Go to: Vercel → Project → Settings → Environment Variables  
Add: `ADMIN_PASSWORD` = your chosen admin password  
Redeploy for the variable to take effect.

- [ ] **End-to-end smoke test on production**

1. Visit `https://vedayulife.com/admin` → should redirect to `/admin/login`
2. Enter `ADMIN_PASSWORD` → should land on dashboard
3. Place a test COD order → check Supabase `orders` table for new row, `cod_verifications` for new row, WhatsApp should receive verification message
4. Check `/admin/orders` → new order appears
5. Check `/admin/whatsapp?tab=verifications` → pending entry visible

- [ ] **Register WhatsApp templates in Meta Business Manager**

Submit these three templates (do this in parallel — approval takes 1–3 days):

**`vedayu_cod_verify`** (UTILITY):
> Namaste {{1}} ji 🙏 We have received your order {{2}} for {{3}} ({{4}}). We will send it to this address: {{5}}. Is this address correct? If yes, please press *Yes, Send My Order*. If not correct, press *Cancel Order* and place a new order with the right address. {{6}}.
- Button 1 (QUICK_REPLY): "Yes, Send My Order" — payload `CONFIRM_COD`
- Button 2 (QUICK_REPLY): "Cancel Order" — payload `CANCEL_COD`

**`vedayu_cod_nudge`** (UTILITY):
> Namaste {{1}} ji 🙏 Your Vedayu order {{2}} is ready to be sent to you! We are waiting for your reply. Please press *Yes, Send My Order* so we can send it — {{3}}. If you do not want it, press *Cancel Order*.
- Same two QUICK_REPLY buttons

**`vedayu_cod_prepaid_offer`** (MARKETING):
> Namaste {{1}} ji 🙏 Your order {{2}} has been cancelled as you requested. If you would like to order again and pay online, you will get ₹50 off. Tap below to reorder.
- Button (URL): "Reorder with ₹50 Off" → `https://vedayulife.com/?cod_cancel_upsell=1`

- [ ] **Set `CRON_SECRET` environment variable in Vercel** (prevents unauthorized cron calls):

Add to Vercel env vars: `CRON_SECRET` = any long random string

---

*Plan complete. Three sub-skills cover execution: superpowers:subagent-driven-development (recommended), superpowers:executing-plans (inline).*
