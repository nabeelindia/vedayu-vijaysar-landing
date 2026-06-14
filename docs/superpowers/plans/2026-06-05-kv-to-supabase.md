# KV → Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Vercel KV with Supabase for all persistent data (customer cache, followup queue, referrals, shipments), keeping KV only for the daily order-ID sequence counter, short-lived COD verify state, and the NimbusPost auth token cache.

**Architecture:** Add 3 new Supabase tables (`followup_queue`, `referrals`, `shipments`), delete the `customer-cache.js` lib (replaced by querying `orders` directly), rewrite `followup-queue.js` and `nimbuspost.js` to use Supabase, update all call sites. Run a one-shot migration script to copy existing KV data into the new tables.

**Tech Stack:** Supabase JS client (`@supabase/supabase-js`), existing `lib/supabase.js`, Next.js API routes, Vercel KV (kept for `order_seq:*`, `cod_verify:*`, `nimbuspost:token`)

---

## File Map

| File | Action | Responsibility after migration |
|------|--------|-------------------------------|
| `supabase/migrations/005_followup_queue.sql` | Create | `followup_queue` table schema |
| `supabase/migrations/006_referrals.sql` | Create | `referrals` table schema |
| `supabase/migrations/007_shipments.sql` | Create | `shipments` table schema |
| `lib/followup-queue.js` | Rewrite | Supabase-backed queue (enqueue, getActive, markSent) |
| `lib/customer-cache.js` | Delete | Replaced by direct `orders` query |
| `lib/nimbuspost.js` | Modify | Replace KV shipment index with Supabase `shipments` |
| `pages/api/referral-validate.js` | Modify | `isNewCustomer` queries `orders` table, referral writes go to `referrals` |
| `pages/api/submit-cod.js` | Modify | Write referral to `referrals` table; remove `saveCustomer` KV call |
| `pages/api/verify-payment.js` | Modify | Write referral to `referrals` table; remove `saveCustomer` KV call |
| `pages/api/unsubscribe.js` | Modify | Delete row from `followup_queue` |
| `pages/api/nimbuspost/webhook.js` | Modify | Replace KV awb/order lookups with `shipments` table |
| `pages/api/sync-audiences.js` | Modify | Pull purchasers from Supabase `orders` instead of KV followup queue |
| `scripts/migrate-kv-to-supabase.mjs` | Create | One-shot migration script |

**Keep KV as-is (no changes):**
- `lib/orders.js` — `order_seq:{date}` daily atomic counter
- `pages/api/whatsapp-webhook.js` — `cod_verify:{phone}` (48h TTL, already mirrored in `cod_verifications`)
- `lib/nimbuspost.js` — `nimbuspost:token` (23h auth cache)
- `pages/api/verify-miswak.js` — `miswak:{orderId}`
- `pages/api/track-abandon.js` / `abandon:*` — out of scope

---

## Task 1: Add Supabase migrations

**Files:**
- Create: `supabase/migrations/005_followup_queue.sql`
- Create: `supabase/migrations/006_referrals.sql`
- Create: `supabase/migrations/007_shipments.sql`

- [ ] **Step 1: Create followup_queue migration**

```sql
-- supabase/migrations/005_followup_queue.sql
create table if not exists followup_queue (
  id          bigserial primary key,
  order_id    text not null unique,
  email       text not null,
  name        text,
  mobile      text,
  pack        text,
  price       int,
  method      text,                -- 'cod' | 'prepaid'
  order_ts    timestamptz not null default now(),
  sent_d3     boolean not null default false,
  sent_d7     boolean not null default false,
  sent_d30    boolean not null default false,
  sent_d90    boolean not null default false,
  unsubscribed boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists fq_order_id_idx   on followup_queue(order_id);
create index if not exists fq_unsubscribed_idx on followup_queue(unsubscribed);
```

- [ ] **Step 2: Create referrals migration**

```sql
-- supabase/migrations/006_referrals.sql
create table if not exists referrals (
  id          bigserial primary key,
  order_id    text not null unique,
  owner_mobile text not null,     -- mobile of the customer who placed this order
  referrer_id  text,              -- order_id that referred this order (null if none)
  discount     int,               -- discount amount applied (null if none)
  method       text,              -- 'cod' | 'prepaid'
  created_at   timestamptz default now()
);
create index if not exists referrals_owner_mobile_idx on referrals(owner_mobile);
create index if not exists referrals_referrer_id_idx  on referrals(referrer_id);
```

- [ ] **Step 3: Create shipments migration**

```sql
-- supabase/migrations/007_shipments.sql
create table if not exists shipments (
  id                   bigserial primary key,
  order_id             text not null unique,
  awb                  text,
  courier              text default 'nimbuspost',
  nimbuspost_order_id  text,
  mobile               text,
  email                text,
  name                 text,
  status               text,
  label_url            text,
  raw_event            jsonb,
  last_updated_at      timestamptz,
  created_at           timestamptz default now()
);
create index if not exists shipments_awb_idx     on shipments(awb);
create index if not exists shipments_order_id_idx on shipments(order_id);
create index if not exists shipments_mobile_idx  on shipments(mobile);
create index if not exists shipments_email_idx   on shipments(email);
```

- [ ] **Step 4: Run migrations in Supabase**

Open the [Supabase SQL editor](https://app.supabase.com) → run each file in order (005, 006, 007). Confirm all three tables appear in the Table Editor.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/005_followup_queue.sql supabase/migrations/006_referrals.sql supabase/migrations/007_shipments.sql
git commit -m "feat: add followup_queue, referrals, shipments supabase tables"
```

---

## Task 2: Rewrite followup-queue.js

**Files:**
- Modify: `lib/followup-queue.js`

- [ ] **Step 1: Replace the entire file**

```js
// lib/followup-queue.js
import { supabase } from './supabase';

export async function enqueueFollowup({ orderId, email, name, pack, price, method, mobile }) {
  if (!email?.trim()) return;
  await supabase.from('followup_queue').upsert({
    order_id:  orderId,
    email:     email.trim(),
    name,
    pack,
    price,
    method,
    mobile:    mobile?.trim() || null,
    order_ts:  new Date().toISOString(),
    sent_d3:   false,
    sent_d7:   false,
    sent_d30:  false,
    sent_d90:  false,
    unsubscribed: false,
  }, { onConflict: 'order_id' });
}

export async function getActiveOrders() {
  const { data, error } = await supabase
    .from('followup_queue')
    .select('*')
    .eq('unsubscribed', false);
  if (error) throw new Error(error.message);
  return (data || []).map(row => ({
    orderId:  row.order_id,
    email:    row.email,
    name:     row.name,
    pack:     row.pack,
    price:    row.price,
    method:   row.method,
    mobile:   row.mobile,
    orderTs:  new Date(row.order_ts).getTime(),
    sent:     { d3: row.sent_d3, d7: row.sent_d7, d30: row.sent_d30, d90: row.sent_d90 },
  }));
}

export async function markSent(orderId, day) {
  // day is 'd3' | 'd7' | 'd30' | 'd90'
  const col = `sent_${day}`;
  await supabase.from('followup_queue').update({ [col]: true }).eq('order_id', orderId);
}

export function daysSince(orderTs) {
  return Math.floor((Date.now() - orderTs) / 86_400_000);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/followup-queue.js
git commit -m "feat: migrate followup-queue from KV to Supabase"
```

---

## Task 3: Update unsubscribe route

**Files:**
- Modify: `pages/api/unsubscribe.js`

- [ ] **Step 1: Replace KV calls with Supabase**

Replace the entire import block and try/catch:

```js
import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has already been used.'));
  }

  try {
    await supabase.from('followup_queue').update({ unsubscribed: true }).eq('order_id', orderId);
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).send(page('Something went wrong', 'Please try again or contact us on WhatsApp.'));
  }

  return res.status(200).send(page(
    "You've been unsubscribed",
    "You won't receive any more follow-up emails from Vedayu for this order. If you have questions, you can always reach us on WhatsApp.",
  ));
}
```

Keep the existing `page()` helper function unchanged at the bottom.

- [ ] **Step 2: Commit**

```bash
git add pages/api/unsubscribe.js
git commit -m "feat: migrate unsubscribe route from KV to Supabase"
```

---

## Task 4: Migrate customer lookup — remove customer-cache.js

**Files:**
- Modify: `lib/customer-cache.js` (replace entirely)
- Modify: `pages/api/referral-validate.js`

The `customer:` KV key stored name/address for pre-fill. We can query the `orders` table directly (most recent order by that mobile+email).

- [ ] **Step 1: Rewrite customer-cache.js to query orders**

```js
// lib/customer-cache.js
import { supabase } from './supabase';

export async function saveCustomer() {
  // No-op: orders table is the source of truth now.
  // Pre-fill reads directly from orders — nothing to save separately.
}

export async function lookupCustomer({ mobile, email }) {
  if (!mobile || !email) return null;
  const { data } = await supabase
    .from('orders')
    .select('name, email, address, city, state, pincode')
    .eq('mobile', mobile.trim())
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}
```

- [ ] **Step 2: Update isNewCustomer in referral-validate.js to query orders**

Replace the entire `isNewCustomer` function and remove the KV import:

```js
// pages/api/referral-validate.js
import { supabase } from '../../lib/supabase';

export async function isNewCustomer(mobile) {
  const cleanMobile = String(mobile || '').replace(/\D/g, '');
  if (!/^[6-9]\d{9}$/.test(cleanMobile)) return true;

  try {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('mobile', cleanMobile)
      .limit(1);
    return count === 0;
  } catch {
    return true; // DB unavailable — allow
  }
}

export default async function handler(req, res) {
  const { mobile } = req.query;
  if (!mobile) return res.status(400).json({ valid: false, reason: 'missing' });

  const newCustomer = await isNewCustomer(mobile);
  return res.json({
    valid:  newCustomer,
    reason: newCustomer ? null : 'returning',
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/customer-cache.js pages/api/referral-validate.js
git commit -m "feat: migrate customer lookup from KV to Supabase orders query"
```

---

## Task 5: Migrate referral writes

**Files:**
- Modify: `pages/api/submit-cod.js`
- Modify: `pages/api/verify-payment.js`

Both files currently write `referral:owner:{orderId}` and `referral:used:{orderId}` to KV. Replace with an insert into `referrals`.

- [ ] **Step 1: Update submit-cod.js**

Find these two lines in `pages/api/submit-cod.js` (near line 231–235):

```js
kv.set(`referral:owner:${orderId}`, mobile.trim(), { ex: 15552000 }).catch(() => {});
if (referrerId) {
  kv.set(`referral:used:${orderId}`, { referrerId, discount: 50, method: 'cod', at: Date.now() }, { ex: 15552000 }).catch(() => {});
}
```

Replace with:

```js
supabase.from('referrals').insert({
  order_id:     orderId,
  owner_mobile: mobile.trim(),
  referrer_id:  referrerId || null,
  discount:     referrerId ? 50 : null,
  method:       'cod',
}).then(() => {}).catch(() => {});
```

Also remove the `import { kv } from '@vercel/kv'` line **only if** it is no longer used anywhere else in submit-cod.js (check for `cod_verify` KV set — that stays, so keep the import).

- [ ] **Step 2: Update verify-payment.js**

Find these lines in `pages/api/verify-payment.js` (near line 237–240):

```js
kv.set(`referral:owner:${orderId}`, mobile?.trim() || '', { ex: 15552000 }).catch(() => {});
if (referrerId) {
  kv.set(`referral:used:${orderId}`, { referrerId, discount: 50, method: 'prepaid', at: Date.now() }, { ex: 15552000 }).catch(() => {});
}
```

Replace with:

```js
supabase.from('referrals').insert({
  order_id:     orderId,
  owner_mobile: mobile?.trim() || '',
  referrer_id:  referrerId || null,
  discount:     referrerId ? 50 : null,
  method:       'prepaid',
}).then(() => {}).catch(() => {});
```

Ensure `supabase` is imported at the top — it already is in both files.

- [ ] **Step 3: Commit**

```bash
git add pages/api/submit-cod.js pages/api/verify-payment.js
git commit -m "feat: migrate referral writes from KV to Supabase referrals table"
```

---

## Task 6: Migrate NimbusPost shipment index

**Files:**
- Modify: `lib/nimbuspost.js`
- Modify: `pages/api/nimbuspost/webhook.js`

`storeAwbMapping`, `getAwbByOrderId`, `getOrdersByPhone`, `getOrdersByEmail` all use KV. Replace with `shipments` table.

- [ ] **Step 1: Rewrite the KV shipment functions in lib/nimbuspost.js**

Find the `storeAwbMapping`, `getAwbByOrderId`, `getOrdersByPhone`, `getOrdersByEmail` functions (around line 290–334) and replace them:

```js
import { supabase } from './supabase';

export async function storeAwbMapping({ orderId, awb, mobile, email, name, nimbuspostOrderId, labelUrl }) {
  try {
    await supabase.from('shipments').upsert({
      order_id:            orderId,
      awb:                 awb || null,
      courier:             'nimbuspost',
      nimbuspost_order_id: nimbuspostOrderId || null,
      mobile:              mobile || null,
      email:               email?.toLowerCase().trim() || null,
      name:                name || null,
      label_url:           labelUrl || null,
      last_updated_at:     new Date().toISOString(),
    }, { onConflict: 'order_id' });
  } catch (err) {
    console.error('storeAwbMapping error:', err);
  }
}

export async function getAwbByOrderId(orderId) {
  try {
    const { data } = await supabase
      .from('shipments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    return data || null;
  } catch { return null; }
}

export async function getOrdersByPhone(mobile) {
  try {
    const { data } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('mobile', mobile)
      .order('created_at', { ascending: false })
      .limit(10);
    return (data || []).map(r => r.order_id);
  } catch { return []; }
}

export async function getOrdersByEmail(email) {
  try {
    const { data } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('email', email.toLowerCase().trim())
      .order('created_at', { ascending: false })
      .limit(10);
    return (data || []).map(r => r.order_id);
  } catch { return []; }
}
```

Also remove the `kv` import from `lib/nimbuspost.js` and the `TOKEN_KV_KEY` KV auth token cache stays — only remove the KV calls from the shipment functions.

- [ ] **Step 2: Update pages/api/nimbuspost/webhook.js**

Replace the two KV reads (`nimbuspost:awb:${awb}` and `nimbuspost:awb_to_order:${awb}`) with Supabase reads:

```js
import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.NIMBUSPOST_WEBHOOK_SECRET;
  if (secret) {
    const incomingSecret = req.headers['x-nimbuspost-secret'] || req.headers['x-webhook-secret'];
    if (incomingSecret !== secret) return res.status(401).json({ error: 'Unauthorized' });
  }

  const body   = req.body;
  const awb    = body?.awb    || body?.tracking_number;
  const status = body?.status || body?.current_status;

  if (!awb || !status) return res.status(400).json({ error: 'Missing awb or status' });

  console.log(`NimbusPost webhook: AWB=${awb} STATUS=${status}`);

  const s = status.toLowerCase();

  // Update shipment row
  try {
    await supabase.from('shipments').upsert({
      awb,
      status,
      last_updated_at: new Date().toISOString(),
      raw_event:       body,
    }, { onConflict: 'awb', ignoreDuplicates: false });
  } catch (err) {
    console.error('Webhook shipments upsert error:', err);
  }

  // Write status back to orders table
  const statusUpdates = { updated_at: new Date().toISOString() };
  if (s.includes('delivered'))                          { statusUpdates.status = 'delivered'; statusUpdates.delivered_at = new Date().toISOString(); }
  else if (s.includes('rto'))                           { statusUpdates.status = 'returned';  statusUpdates.returned_at  = new Date().toISOString(); }
  else if (s.includes('sent') || s.includes('picked'))  { statusUpdates.status = 'sent';      statusUpdates.sent_at      = new Date().toISOString(); }

  if (Object.keys(statusUpdates).length > 1 && supabase) {
    await supabase.from('orders').update(statusUpdates).eq('awb', awb).catch(() => {});
  }

  // RTO — notify owner
  if (s.includes('rto') && process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const { data: shipment } = await supabase
        .from('shipments')
        .select('order_id, name')
        .eq('awb', awb)
        .maybeSingle();

      const orderId     = shipment?.order_id || 'Unknown';
      const customerName = shipment?.name    || '';

      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    'Vedayu System <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `⚠️ RTO Alert — AWB ${awb}${orderId !== 'Unknown' ? ` | ${orderId}` : ''}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
            <div style="background:#c0392b;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;">⚠️ RTO Initiated — Vedayu</h2>
            </div>
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;width:40%;">Order ID</td><td style="padding:10px 0;font-family:monospace;">${orderId}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">AWB</td><td style="padding:10px 0;font-family:monospace;">${awb}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Customer</td><td style="padding:10px 0;">${customerName}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Status</td><td style="padding:10px 0;color:#c0392b;font-weight:700;">${status}</td></tr>
                <tr><td style="padding:10px 0;font-weight:600;">Time</td><td style="padding:10px 0;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              </table>
              <div style="background:#FFF8E1;border-left:4px solid #e67e22;padding:12px 16px;margin-top:20px;font-size:.85rem;color:#6D4C00;border-radius:0 6px 6px 0;">
                Log into <a href="https://ship.nimbuspost.com" style="color:#5C3D1E;">NimbusPost dashboard</a> to take NDR action.
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('RTO email failed:', emailErr);
    }
  }

  return res.status(200).json({ received: true });
}
```

Note: the `shipments` table needs `awb` as a unique index for the upsert to work. Add that to the migration:

```sql
-- add to 007_shipments.sql (or run separately)
create unique index if not exists shipments_awb_unique_idx on shipments(awb) where awb is not null;
```

- [ ] **Step 3: Commit**

```bash
git add lib/nimbuspost.js pages/api/nimbuspost/webhook.js supabase/migrations/007_shipments.sql
git commit -m "feat: migrate NimbusPost shipment index from KV to Supabase"
```

---

## Task 7: Update sync-audiences.js

**Files:**
- Modify: `pages/api/sync-audiences.js`

Currently pulls purchasers from `getActiveOrders()` (KV-backed). After Task 2 that already uses Supabase — no change needed to import. But `abandon:*` stays in KV (out of scope). Just verify the import still works.

- [ ] **Step 1: Verify sync-audiences.js still works**

`getActiveOrders()` in `lib/followup-queue.js` is now Supabase-backed. The call in `sync-audiences.js` is unchanged — it just calls the function. No code change needed.

The KV import in `sync-audiences.js` for `abandon:*` keys remains — that's intentional (out of scope).

- [ ] **Step 2: Commit note**

No commit needed — this file works unchanged after Task 2.

---

## Task 8: Write and run the KV → Supabase migration script

**Files:**
- Create: `scripts/migrate-kv-to-supabase.mjs`

This script reads all existing KV data and inserts it into Supabase. Run once, then discard.

- [ ] **Step 1: Create the migration script**

```js
// scripts/migrate-kv-to-supabase.mjs
// Run: node --env-file=.env.local scripts/migrate-kv-to-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import { createClient as createKvClient } from '@vercel/kv';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const kv = createKvClient({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function migrateFollowupQueue() {
  console.log('\n── followup_queue ──────────────────────');
  const ids = await kv.smembers('followup:active');
  if (!ids?.length) { console.log('  No active followup entries.'); return; }

  for (const orderId of ids) {
    const d = await kv.get(`followup:${orderId}`);
    if (!d) continue;

    const { error } = await supabase.from('followup_queue').upsert({
      order_id:     d.orderId,
      email:        d.email,
      name:         d.name,
      pack:         d.pack,
      price:        d.price,
      method:       d.method,
      mobile:       d.mobile || null,
      order_ts:     new Date(d.orderTs).toISOString(),
      sent_d3:      d.sent?.d3  || false,
      sent_d7:      d.sent?.d7  || false,
      sent_d30:     d.sent?.d30 || false,
      sent_d90:     d.sent?.d90 || false,
      unsubscribed: false,
    }, { onConflict: 'order_id' });

    if (error) console.error(`  ✗ ${orderId}: ${error.message}`);
    else       console.log(`  ✓ ${orderId}`);
  }
}

async function migrateReferrals() {
  console.log('\n── referrals ───────────────────────────');
  // Scan KV for all referral:owner:* keys
  let cursor = 0;
  let keys = [];
  do {
    const [nextCursor, batch] = await kv.scan(cursor, { match: 'referral:owner:*', count: 100 });
    cursor = nextCursor;
    keys = keys.concat(batch);
  } while (cursor !== 0);

  console.log(`  Found ${keys.length} referral:owner entries`);

  for (const key of keys) {
    const orderId     = key.replace('referral:owner:', '');
    const ownerMobile = await kv.get(key);
    const used        = await kv.get(`referral:used:${orderId}`);

    const { error } = await supabase.from('referrals').upsert({
      order_id:     orderId,
      owner_mobile: ownerMobile || '',
      referrer_id:  used?.referrerId || null,
      discount:     used?.discount   || null,
      method:       used?.method     || null,
    }, { onConflict: 'order_id' });

    if (error) console.error(`  ✗ ${orderId}: ${error.message}`);
    else       console.log(`  ✓ ${orderId}`);
  }
}

async function migrateShipments() {
  console.log('\n── shipments ───────────────────────────');
  let cursor = 0;
  let keys = [];
  do {
    const [nextCursor, batch] = await kv.scan(cursor, { match: 'nimbuspost:order:*', count: 100 });
    cursor = nextCursor;
    keys = keys.concat(batch);
  } while (cursor !== 0);

  console.log(`  Found ${keys.length} nimbuspost:order entries`);

  for (const key of keys) {
    const orderId = key.replace('nimbuspost:order:', '');
    const d = await kv.get(key);
    if (!d) continue;

    const { error } = await supabase.from('shipments').upsert({
      order_id:            orderId,
      awb:                 d.awb || null,
      courier:             'nimbuspost',
      nimbuspost_order_id: d.nimbuspostOrderId || null,
      mobile:              d.mobile || null,
      email:               d.email  || null,
      name:                d.name   || null,
      label_url:           d.labelUrl || null,
      last_updated_at:     new Date().toISOString(),
    }, { onConflict: 'order_id' });

    if (error) console.error(`  ✗ ${orderId}: ${error.message}`);
    else       console.log(`  ✓ ${orderId}`);
  }
}

async function main() {
  console.log('KV → Supabase migration starting…\n');
  await migrateFollowupQueue();
  await migrateReferrals();
  await migrateShipments();
  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the migration**

```bash
node --env-file=.env.local scripts/migrate-kv-to-supabase.mjs
```

Expected output: each migrated key prints `✓ VED-C…`. Check Supabase Table Editor to confirm rows appear.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/migrate-kv-to-supabase.mjs
git commit -m "chore: one-shot KV → Supabase migration script"
```

---

## Task 9: Final commit & deploy

- [ ] **Step 1: Push everything**

```bash
git push origin main
```

- [ ] **Step 2: Verify cron in production**

After deploy, manually trigger the followups cron to confirm it reads from Supabase:

```bash
curl -X GET https://vedayulife.com/api/cron/send-followups \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected: `{ "checked": N, "sent": [], "errors": [] }` — `N` should match the count of rows in `followup_queue`.

- [ ] **Step 3: Verify referral-validate in production**

```bash
curl "https://vedayulife.com/api/referral-validate?mobile=9876543210"
```

Expected: `{ "valid": false, "reason": "returning" }` for any mobile that has a past order.

---

## What stays in KV (unchanged)

| KV key | Reason to keep |
|--------|---------------|
| `order_seq:{date}` | Atomic daily counter — Postgres sequences don't have per-day TTL |
| `cod_verify:{phone}` | 48h ephemeral state, already mirrored in `cod_verifications` |
| `nimbuspost:token` | 23h auth token cache — short-lived, no query value |
| `miswak:{orderId}` | One-time verification flag, trivial |
| `abandon:*` | Out of scope for this migration |
