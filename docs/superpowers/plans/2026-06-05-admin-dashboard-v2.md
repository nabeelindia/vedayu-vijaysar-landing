# Admin Dashboard V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> ⚠️ **USER INSTRUCTION: Do NOT commit or push anything without explicit user confirmation. At every commit step, show the user a `git diff --stat` and wait for approval.**

**Goal:** Extend the Vedayu admin panel with order status management, bulk actions, CSV export, WhatsApp send from order detail, notes, refund logging, RTO management, dashboard stat improvements, referral leaderboard, and push notifications.

**Architecture:** All new data (notes, refunds, return reasons) lives in Supabase. Push subscriptions migrate from the `PUSH_SUBSCRIPTIONS` env-var JSON to the existing `push_subscriptions` table. New admin pages follow the existing pattern: `pages/admin/*.js` + `pages/api/admin/*.js` + shared components in `components/admin/`. CSV export is client-side (no new API needed). A shared `lib/push.js` helper centralises push-notification sending so submit-cod, verify-payment, and the NimbusPost webhook all call one function.

**Tech Stack:** Next.js 13 (pages router), Supabase JS v2, web-push, existing `components/admin/` component library, `lib/whatsapp.js` for WA sends.

**Vercel Hobby constraints:** Max 10s function duration. All operations must complete within that window. No background jobs beyond existing crons.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/008_admin_v2.sql` | Create | order_notes + refunds tables; return_reason + confirmed_at columns on orders |
| `lib/push.js` | Create | Central push-notification helper (reads from push_subscriptions table) |
| `pages/api/admin/push-subscribe.js` | Create | POST: save subscription to Supabase; DELETE: remove |
| `pages/api/admin/push-test.js` | Create | POST: send test push to all subscriptions |
| `pages/api/admin/dashboard-stats.js` | Create | GET: today's orders/revenue, awaiting dispatch, RTOs this week |
| `pages/api/admin/orders/[id].js` | Modify | Add notes + refunds to GET; add return_reason + confirmed_at to PATCH allowed list |
| `pages/api/admin/referrals.js` | Create | GET: referral leaderboard from referrals table |
| `pages/admin/orders/[id].js` | Modify | Add Notes panel, Refund panel, WA-send panel, Confirm/RTO buttons |
| `pages/admin/orders/index.js` | Modify | Add checkboxes, bulk-action bar, CSV export button |
| `pages/admin/index.js` | Modify | Replace analytics fetch with dashboard-stats; add 4 new stat cards |
| `pages/admin/referrals.js` | Create | Referral leaderboard page |
| `pages/admin/settings.js` | Create | Push notification subscribe/test UI |
| `components/admin/Layout.js` | Modify | Add "Referrals" + "Settings" nav links |
| `pages/api/submit-cod.js` | Modify | Send push on new COD order via lib/push.js |
| `pages/api/verify-payment.js` | Modify | Send push on new prepaid order via lib/push.js |
| `pages/api/nimbuspost/webhook.js` | Modify | Send push on RTO via lib/push.js |
| `pages/api/whatsapp-webhook.js` | Modify | Replace PUSH_SUBSCRIPTIONS env-var with lib/push.js |

---

## Task 1: DB migrations

**Files:**
- Create: `supabase/migrations/008_admin_v2.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/008_admin_v2.sql

-- Notes on orders (internal, admin-only)
create table if not exists order_notes (
  id         bigserial primary key,
  order_id   text not null references orders(order_id) on delete cascade,
  note       text not null,
  created_at timestamptz default now()
);
create index if not exists order_notes_order_id_idx on order_notes(order_id);

-- Refund log
create table if not exists refunds (
  id         bigserial primary key,
  order_id   text not null references orders(order_id) on delete cascade,
  amount     int  not null,   -- in rupees
  method     text not null,   -- 'upi' | 'bank' | 'cash' | 'other'
  note       text,
  created_at timestamptz default now()
);
create index if not exists refunds_order_id_idx on refunds(order_id);

-- Extra columns on orders
alter table orders
  add column if not exists return_reason  text,
  add column if not exists confirmed_at   timestamptz;
```

- [ ] **Step 2: Run in Supabase SQL editor**

Open Supabase → SQL Editor → paste and run. Confirm:
- `order_notes` table appears in Table Editor
- `refunds` table appears
- `orders` has `return_reason` and `confirmed_at` columns

- [ ] **Step 3: Show diff to user and request commit approval**

```bash
git add supabase/migrations/008_admin_v2.sql
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: add order_notes, refunds tables; return_reason + confirmed_at on orders"
```

---

## Task 2: lib/push.js — central push helper

**Files:**
- Create: `lib/push.js`
- Modify: `pages/api/whatsapp-webhook.js` (remove inline push code, use lib/push.js)

The current `whatsapp-webhook.js` reads push subscriptions from `process.env.PUSH_SUBSCRIPTIONS` (a JSON env var). This task replaces that with a Supabase read so subscriptions can be managed in the admin UI.

- [ ] **Step 1: Create lib/push.js**

```js
// lib/push.js
import webpush from 'web-push';
import { supabase } from './supabase';

function setup() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@vedayulife.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  }
}
setup();

export async function sendPush({ title, body }) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  if (!supabase) return;

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (!subs?.length) return;

  const payload = JSON.stringify({ title, body: body?.slice(0, 120) });

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async err => {
        // Remove expired/invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        console.error('Push error:', err.message);
      })
    )
  );
}
```

- [ ] **Step 2: Update whatsapp-webhook.js to use lib/push.js**

In `pages/api/whatsapp-webhook.js`:

Remove these lines near the top:
```js
import webpush from 'web-push';
// ...
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);
```

Add at the top:
```js
import { sendPush } from '../../lib/push';
```

Find the block that reads (around line 209):
```js
if (!process.env.VAPID_PUBLIC_KEY || !process.env.PUSH_SUBSCRIPTIONS) return;
let subs = [];
try { subs = JSON.parse(process.env.PUSH_SUBSCRIPTIONS); } catch { return; }

const payload = JSON.stringify({
  title: isFallback ? `⚠️ Needs reply — ${contact}` : `💬 WA — ${contact}`,
  body:  text.slice(0, 120),
});

await Promise.allSettled(
  subs.map(sub =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    ).catch(err => console.error('Push error:', err.message))
  )
);
```

Replace with:
```js
await sendPush({
  title: isFallback ? `⚠️ Needs reply — ${contact}` : `💬 WA — ${contact}`,
  body:  text,
});
```

- [ ] **Step 3: Show diff to user and request commit approval**

```bash
git add lib/push.js pages/api/whatsapp-webhook.js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: centralise push notifications in lib/push.js; migrate from env-var to Supabase"
```

---

## Task 3: Push subscribe/test API + Settings page

**Files:**
- Create: `pages/api/admin/push-subscribe.js`
- Create: `pages/api/admin/push-test.js`
- Create: `pages/admin/settings.js`
- Modify: `components/admin/Layout.js` (add Settings nav link)

- [ ] **Step 1: Create push-subscribe API**

```js
// pages/api/admin/push-subscribe.js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST') {
    const { endpoint, p256dh, auth } = req.body;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Missing fields' });
    const { error } = await supabase.from('push_subscriptions')
      .upsert({ endpoint, p256dh, auth }, { onConflict: 'endpoint' });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
```

- [ ] **Step 2: Create push-test API**

```js
// pages/api/admin/push-test.js
import { checkAdminAuth } from '../_auth';
import { sendPush } from '../../../lib/push';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();
  await sendPush({ title: '✅ Test notification', body: 'Push is working for Vedayu admin.' });
  return res.json({ ok: true });
}
```

- [ ] **Step 3: Create settings page**

```js
// pages/admin/settings.js
import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

export default function AdminSettings() {
  const [subbed,   setSubbed]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState('');
  const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(s => setSubbed(!!s))
    );
  }, []);

  const subscribe = async () => {
    setLoading(true); setMsg('');
    try {
      const reg  = await navigator.serviceWorker.ready;
      const sub  = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC,
      });
      const { endpoint, keys } = sub.toJSON();
      await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
      });
      setSubbed(true); setMsg('Subscribed! You will receive push notifications.');
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true); setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/admin/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubbed(false); setMsg('Unsubscribed.');
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const testPush = async () => {
    setLoading(true); setMsg('');
    await fetch('/api/admin/push-test', { method: 'POST' });
    setMsg('Test notification sent!');
    setLoading(false);
  };

  return (
    <AdminLayout title="Settings">
      <PageHeader title="Settings" />
      <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
        boxShadow:'0 1px 3px rgba(0,0,0,.07)', maxWidth:480 }}>
        <h3 style={{ margin:'0 0 6px', fontSize:'.85rem', fontWeight:700,
          textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>
          Push Notifications
        </h3>
        <p style={{ margin:'0 0 16px', fontSize:'.85rem', color:'#555' }}>
          Receive a browser notification when a new order arrives or an RTO is triggered.
          {!VAPID_PUBLIC && <span style={{ color:'#c00' }}> NEXT_PUBLIC_VAPID_PUBLIC_KEY not set.</span>}
        </p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {!subbed
            ? <button onClick={subscribe} disabled={loading || !VAPID_PUBLIC}
                style={{ padding:'9px 18px', background:'#5C3D1E', color:'#fff',
                  border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
                {loading ? '…' : '🔔 Enable notifications'}
              </button>
            : <button onClick={unsubscribe} disabled={loading}
                style={{ padding:'9px 18px', background:'#fff', color:'#C62828',
                  border:'1.5px solid #C62828', borderRadius:8, fontSize:'.82rem',
                  fontWeight:700, cursor:'pointer' }}>
                {loading ? '…' : 'Disable'}
              </button>
          }
          {subbed && (
            <button onClick={testPush} disabled={loading}
              style={{ padding:'9px 18px', background:'#f0ede8', color:'#5C3D1E',
                border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
              {loading ? '…' : 'Send test'}
            </button>
          )}
        </div>
        {msg && <p style={{ marginTop:12, fontSize:'.82rem', color:'#4A7C59' }}>{msg}</p>}
      </div>
    </AdminLayout>
  );
}
```

- [ ] **Step 4: Add Settings link to Layout nav**

In `components/admin/Layout.js`, find the nav links array (search for `whatsapp` or `analytics` in the nav section) and add `{ href: '/admin/settings', label: 'Settings' }` at the end.

- [ ] **Step 5: Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to Vercel env**

In Vercel → Project Settings → Environment Variables, add:
- Name: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Value: same value as `VAPID_PUBLIC_KEY`

This is safe to expose client-side (it's a public key by design).

- [ ] **Step 6: Show diff and request commit approval**

```bash
git add pages/api/admin/push-subscribe.js pages/api/admin/push-test.js pages/admin/settings.js components/admin/Layout.js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: push notification subscribe/unsubscribe/test in admin settings"
```

---

## Task 4: Push on new order + RTO

**Files:**
- Modify: `pages/api/submit-cod.js`
- Modify: `pages/api/verify-payment.js`
- Modify: `pages/api/nimbuspost/webhook.js`

- [ ] **Step 1: Add push import and call in submit-cod.js**

At the top of `pages/api/submit-cod.js`, add:
```js
import { sendPush } from '../../lib/push';
```

After the line `await waOrderConfirmed(...)`, add:
```js
sendPush({ title: `🛒 New COD order — ${name}`, body: `${pack} · ₹${safePrice} · ${mobile.trim()}` }).catch(() => {});
```

- [ ] **Step 2: Add push import and call in verify-payment.js**

At the top of `pages/api/verify-payment.js`, add:
```js
import { sendPush } from '../../lib/push';
```

After the line `await waOrderConfirmed(...)`, add:
```js
sendPush({ title: `💳 New prepaid order — ${name}`, body: `${pack} · ₹${price} · ${mobile?.trim()}` }).catch(() => {});
```

- [ ] **Step 3: Add push on RTO in nimbuspost/webhook.js**

At the top of `pages/api/nimbuspost/webhook.js`, add:
```js
import { sendPush } from '../../../lib/push';
```

In the RTO section (inside `if (s.includes('rto') ...)`), after sending the email, add:
```js
await sendPush({ title: `⚠️ RTO — AWB ${awb}`, body: `Order ${orderId} · ${customerName}` }).catch(() => {});
```

- [ ] **Step 4: Show diff and request commit approval**

```bash
git add pages/api/submit-cod.js pages/api/verify-payment.js pages/api/nimbuspost/webhook.js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: send push notification on new order and RTO"
```

---

## Task 5: Dashboard stats API + improved dashboard

**Files:**
- Create: `pages/api/admin/dashboard-stats.js`
- Modify: `pages/admin/index.js`

- [ ] **Step 1: Create dashboard-stats API**

```js
// pages/api/admin/dashboard-stats.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const now       = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow    = new Date(now.getTime() + istOffset);
  const todayIST  = istNow.toISOString().slice(0, 10);
  const todayStart = `${todayIST}T00:00:00+05:30`;

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [todayRes, awaitingRes, rtoRes, pendingCodRes] = await Promise.all([
    supabase.from('orders')
      .select('price, method')
      .gte('created_at', todayStart),
    supabase.from('orders')
      .select('order_id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'auto_confirmed'])
      .is('awb', null),
    supabase.from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'returned')
      .gte('returned_at', weekAgo),
    supabase.from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('method', 'cod'),
  ]);

  const todayOrders  = todayRes.data || [];
  const todayRevenue = todayOrders
    .filter(o => !['cancelled','returned'].includes(o.status))
    .reduce((s, o) => s + (o.price || 0), 0);

  return res.json({
    todayOrders:      todayOrders.length,
    todayRevenue,
    awaitingDispatch: awaitingRes.count || 0,
    rtosThisWeek:     rtoRes.count      || 0,
    pendingCodVerify: pendingCodRes.count || 0,
  });
}
```

- [ ] **Step 2: Update dashboard page to use new stats**

Replace the `useEffect` in `pages/admin/index.js` so it calls `/api/admin/dashboard-stats` instead of `/api/admin/analytics`. Replace the 4 StatCards with:

```js
// New state
const [stats, setStats] = useState(null);

// New useEffect
useEffect(() => {
  Promise.all([
    fetch('/api/admin/dashboard-stats').then(r => r.json()),
    fetch('/api/admin/orders?page=1').then(r => r.json()),
    fetch('/api/admin/orders?status=pending&method=cod&page=1').then(r => r.json()),
  ]).then(([s, r, p]) => {
    setStats(s);
    setRecent((r.data || []).slice(0, 8));
    setPending((p.data || []).slice(0, 5));
    setLoading(false);
  }).catch(() => setLoading(false));
}, []);

// New StatCard grid (replace the existing 4 cards)
<div className="admin-stat-grid" style={{ marginBottom:24 }}>
  <StatCard label="Today's Orders"     value={stats?.todayOrders   || 0} />
  <StatCard label="Today's Revenue"    value={`₹${Number(stats?.todayRevenue || 0).toLocaleString('en-IN')}`} color="#5C3D1E" />
  <StatCard label="Awaiting Dispatch"  value={stats?.awaitingDispatch || 0} color="#E65100"
    onClick={() => router.push('/admin/orders?status=confirmed')} />
  <StatCard label="Pending COD Reply"  value={stats?.pendingCodVerify || 0} color="#E65100"
    onClick={() => router.push('/admin/whatsapp?tab=verifications')} />
  <StatCard label="RTOs This Week"     value={stats?.rtosThisWeek  || 0} color="#C62828" />
</div>
```

- [ ] **Step 3: Show diff and request commit approval**

```bash
git add pages/api/admin/dashboard-stats.js pages/admin/index.js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: improved dashboard stats — today's orders, awaiting dispatch, RTOs"
```

---

## Task 6: Order detail — Notes, Refunds, Confirm, RTO

**Files:**
- Modify: `pages/api/admin/orders/[id].js`
- Modify: `pages/admin/orders/[id].js`

- [ ] **Step 1: Extend the orders API to serve notes + refunds and accept new PATCH fields**

In `pages/api/admin/orders/[id].js`, update the GET handler to also fetch notes and refunds:

```js
if (req.method === 'GET') {
  const [orderRes, verifRes, notesRes, refundsRes] = await Promise.all([
    supabase.from('orders').select('*').eq('order_id', id).single(),
    supabase.from('cod_verifications').select('*').eq('order_id', id).maybeSingle(),
    supabase.from('order_notes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('refunds').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  ]);
  if (orderRes.error) return res.status(404).json({ error: 'Order not found' });
  return res.json({
    order:        orderRes.data,
    verification: verifRes.data,
    notes:        notesRes.data  || [],
    refunds:      refundsRes.data || [],
  });
}
```

Update PATCH allowed fields to include `return_reason` and `confirmed_at`:
```js
const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                 'sent_at', 'delivered_at', 'returned_at', 'return_reason', 'confirmed_at'];
```

Add two new method handlers after the PATCH block:

```js
// POST /api/admin/orders/[id]?action=note
// POST /api/admin/orders/[id]?action=refund
if (req.method === 'POST') {
  const { action } = req.query;

  if (action === 'note') {
    const { note } = req.body;
    if (!note?.trim()) return res.status(400).json({ error: 'Note required' });
    const { data, error } = await supabase.from('order_notes')
      .insert({ order_id: id, note: note.trim() })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ note: data });
  }

  if (action === 'refund') {
    const { amount, method, note } = req.body;
    if (!amount || !method) return res.status(400).json({ error: 'Amount and method required' });
    const { data, error } = await supabase.from('refunds')
      .insert({ order_id: id, amount: parseInt(amount), method, note: note?.trim() || null })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ refund: data });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
```

- [ ] **Step 2: Update order detail page — add Confirm, RTO buttons + panels**

In `pages/admin/orders/[id].js`:

Add state for notes and refunds:
```js
const [notes,      setNotes]      = useState([]);
const [refunds,    setRefunds]    = useState([]);
const [newNote,    setNewNote]    = useState('');
const [refAmount,  setRefAmount]  = useState('');
const [refMethod,  setRefMethod]  = useState('upi');
const [refNote,    setRefNote]    = useState('');
const [rtoReason,  setRtoReason]  = useState('');
const [showRTO,    setShowRTO]    = useState(false);
const [saving2,    setSaving2]    = useState(false);
```

Update the `useEffect` data fetch:
```js
fetch(`/api/admin/orders/${id}`)
  .then(r => r.json())
  .then(d => {
    setData(d);
    setNotes(d.notes  || []);
    setRefunds(d.refunds || []);
  });
```

Add helper functions:
```js
const confirm = () => patch({
  status: 'confirmed',
  confirmed_at: new Date().toISOString(),
});

const markRTO = async () => {
  if (!rtoReason.trim()) return alert('Please enter a return reason.');
  await patch({ status: 'returned', return_reason: rtoReason.trim(), returned_at: new Date().toISOString() });
  setShowRTO(false);
};

const addNote = async () => {
  if (!newNote.trim()) return;
  setSaving2(true);
  const res = await fetch(`/api/admin/orders/${id}?action=note`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: newNote }),
  });
  const d = await res.json();
  if (d.note) { setNotes(n => [d.note, ...n]); setNewNote(''); }
  setSaving2(false);
};

const addRefund = async () => {
  if (!refAmount) return alert('Enter refund amount.');
  setSaving2(true);
  const res = await fetch(`/api/admin/orders/${id}?action=refund`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: refAmount, method: refMethod, note: refNote }),
  });
  const d = await res.json();
  if (d.refund) { setRefunds(r => [d.refund, ...r]); setRefAmount(''); setRefNote(''); }
  setSaving2(false);
};
```

Add "Confirm Order" button in the status actions block (after existing buttons, before Cancel):
```jsx
{['pending', 'auto_confirmed'].includes(order.status) && (
  <button onClick={confirm} disabled={saving}
    style={{ padding:'9px 14px', background:'#4A7C59', color:'#fff',
      border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
    {saving ? '…' : '✓ Confirm Order'}
  </button>
)}
```

Add RTO button and form (below Cancel button):
```jsx
{order.status === 'sent' && !showRTO && (
  <button onClick={() => setShowRTO(true)}
    style={{ padding:'9px 14px', background:'#fff', color:'#880E4F',
      border:'1.5px solid #880E4F', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
    Mark RTO
  </button>
)}
{showRTO && (
  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
    <input value={rtoReason} onChange={e => setRtoReason(e.target.value)}
      placeholder="Return reason (e.g. 'Not reachable')"
      style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }} />
    <div style={{ display:'flex', gap:8 }}>
      <button onClick={markRTO} disabled={saving}
        style={{ flex:1, padding:'8px', background:'#880E4F', color:'#fff',
          border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
        {saving ? '…' : 'Confirm RTO'}
      </button>
      <button onClick={() => setShowRTO(false)}
        style={{ padding:'8px 14px', background:'#f0ede8', border:'none',
          borderRadius:8, fontSize:'.82rem', cursor:'pointer' }}>
        Cancel
      </button>
    </div>
  </div>
)}
```

Add Notes panel (new card below the existing two cards):
```jsx
<div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
  boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginTop:16 }}>
  <h2 style={{ margin:'0 0 12px', fontSize:'.85rem', fontWeight:700,
    textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>Internal Notes</h2>
  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
    <input value={newNote} onChange={e => setNewNote(e.target.value)}
      placeholder="Add a note…"
      style={{ flex:1, padding:'8px 12px', borderRadius:8,
        border:'1.5px solid #d0c8bc', fontSize:'.82rem' }}
      onKeyDown={e => e.key === 'Enter' && addNote()} />
    <button onClick={addNote} disabled={saving2}
      style={{ padding:'8px 14px', background:'#5C3D1E', color:'#fff',
        border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
      {saving2 ? '…' : 'Add'}
    </button>
  </div>
  {notes.length === 0 && <p style={{ color:'#aaa', fontSize:'.82rem', margin:0 }}>No notes yet.</p>}
  {notes.map(n => (
    <div key={n.id} style={{ padding:'8px 0', borderBottom:'1px solid #f0ede8',
      fontSize:'.83rem', color:'#333' }}>
      <span style={{ color:'#aaa', fontSize:'.72rem', marginRight:8 }}>
        {new Date(n.created_at).toLocaleString('en-IN', { timeZone:'Asia/Kolkata',
          dateStyle:'short', timeStyle:'short' })}
      </span>
      {n.note}
    </div>
  ))}
</div>
```

Add Refunds panel (below Notes):
```jsx
<div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
  boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginTop:16 }}>
  <h2 style={{ margin:'0 0 12px', fontSize:'.85rem', fontWeight:700,
    textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>Refunds</h2>
  <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr auto', gap:8, marginBottom:12, alignItems:'center' }}>
    <input value={refAmount} onChange={e => setRefAmount(e.target.value)}
      placeholder="₹ amount" type="number"
      style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }} />
    <select value={refMethod} onChange={e => setRefMethod(e.target.value)}
      style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }}>
      <option value="upi">UPI</option>
      <option value="bank">Bank transfer</option>
      <option value="cash">Cash</option>
      <option value="other">Other</option>
    </select>
    <input value={refNote} onChange={e => setRefNote(e.target.value)}
      placeholder="Note (optional)"
      style={{ padding:'8px 10px', borderRadius:8, border:'1.5px solid #d0c8bc', fontSize:'.82rem' }} />
    <button onClick={addRefund} disabled={saving2}
      style={{ padding:'8px 14px', background:'#5C3D1E', color:'#fff',
        border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
      {saving2 ? '…' : 'Log'}
    </button>
  </div>
  {refunds.length === 0 && <p style={{ color:'#aaa', fontSize:'.82rem', margin:0 }}>No refunds logged.</p>}
  {refunds.map(r => (
    <div key={r.id} style={{ padding:'8px 0', borderBottom:'1px solid #f0ede8',
      fontSize:'.83rem', color:'#333', display:'flex', gap:12, alignItems:'center' }}>
      <strong style={{ color:'#C62828' }}>₹{r.amount}</strong>
      <span style={{ background:'#f0ede8', padding:'1px 8px', borderRadius:12,
        fontSize:'.7rem', fontWeight:700, color:'#5C3D1E', textTransform:'uppercase' }}>{r.method}</span>
      {r.note && <span style={{ color:'#555' }}>{r.note}</span>}
      <span style={{ color:'#aaa', fontSize:'.72rem', marginLeft:'auto' }}>
        {new Date(r.created_at).toLocaleString('en-IN', { timeZone:'Asia/Kolkata',
          dateStyle:'short', timeStyle:'short' })}
      </span>
    </div>
  ))}
</div>
```

- [ ] **Step 3: Show diff and request commit approval**

```bash
git add pages/api/admin/orders/\[id\].js pages/admin/orders/\[id\].js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: order detail — confirm/RTO buttons, notes panel, refund log"
```

---

## Task 7: Manual WhatsApp send from order detail

**Files:**
- Modify: `pages/admin/orders/[id].js`
- Modify: `lib/whatsapp.js` (add waCustomMessage export)
- Create: `pages/api/admin/orders/wa-send.js`

- [ ] **Step 1: Add waCustomMessage to lib/whatsapp.js**

Add at the bottom of `lib/whatsapp.js`:
```js
/**
 * Free-text WhatsApp message (admin manual send)
 */
export async function waCustomMessage({ mobile, text }) {
  return sendMessage(mobile, {
    type: 'text',
    text: { body: text },
  });
}
```

- [ ] **Step 2: Create wa-send API route**

```js
// pages/api/admin/orders/wa-send.js
import { checkAdminAuth } from '../_auth';
import { waDispatchUpdate, waCustomMessage } from '../../../../lib/whatsapp';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST') return res.status(405).end();

  const { orderId, type, customText } = req.body;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  const { data: order } = await supabase
    .from('orders').select('mobile, name').eq('order_id', orderId).single();
  if (!order) return res.status(404).json({ error: 'Order not found' });

  try {
    if (type === 'dispatch') {
      await waDispatchUpdate({ mobile: order.mobile, name: order.name, orderId });
    } else if (type === 'custom') {
      if (!customText?.trim()) return res.status(400).json({ error: 'Message text required' });
      await waCustomMessage({ mobile: order.mobile, text: customText.trim() });
    } else {
      return res.status(400).json({ error: 'Unknown type' });
    }

    // Log as outbound message
    if (supabase) {
      await supabase.from('wa_outbound').insert({
        to_phone: order.mobile,
        message:  type === 'dispatch' ? `[Dispatch update template] ${orderId}` : customText.trim(),
      }).then(() => {}, () => {});
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 3: Add WhatsApp panel to order detail page**

In `pages/admin/orders/[id].js`, add state:
```js
const [waText,    setWaText]    = useState('');
const [waSending, setWaSending] = useState(false);
const [waMsg,     setWaMsg]     = useState('');
```

Add helper:
```js
const sendWA = async (type) => {
  setWaSending(true); setWaMsg('');
  const res = await fetch('/api/admin/orders/wa-send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: order.order_id, type, customText: waText }),
  });
  const d = await res.json();
  setWaMsg(d.ok ? 'Sent ✓' : `Error: ${d.error}`);
  if (d.ok && type === 'custom') setWaText('');
  setWaSending(false);
};
```

Add WhatsApp panel after the Refunds panel:
```jsx
<div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
  boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginTop:16 }}>
  <h2 style={{ margin:'0 0 12px', fontSize:'.85rem', fontWeight:700,
    textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>Send WhatsApp</h2>
  <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
    <button onClick={() => sendWA('dispatch')} disabled={waSending}
      style={{ padding:'8px 14px', background:'#25D366', color:'#fff',
        border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700, cursor:'pointer' }}>
      {waSending ? '…' : '📦 Dispatch update'}
    </button>
  </div>
  <div style={{ display:'flex', gap:8 }}>
    <textarea value={waText} onChange={e => setWaText(e.target.value)}
      placeholder="Custom message…" rows={3}
      style={{ flex:1, padding:'8px 12px', borderRadius:8,
        border:'1.5px solid #d0c8bc', fontSize:'.82rem', resize:'vertical' }} />
    <button onClick={() => sendWA('custom')} disabled={waSending || !waText.trim()}
      style={{ padding:'8px 14px', background:'#5C3D1E', color:'#fff',
        border:'none', borderRadius:8, fontSize:'.82rem', fontWeight:700,
        cursor:'pointer', alignSelf:'flex-end' }}>
      {waSending ? '…' : 'Send'}
    </button>
  </div>
  {waMsg && <p style={{ marginTop:8, fontSize:'.82rem', color: waMsg.startsWith('Error') ? '#C62828' : '#4A7C59' }}>{waMsg}</p>}
</div>
```

- [ ] **Step 4: Show diff and request commit approval**

```bash
git add lib/whatsapp.js pages/api/admin/orders/wa-send.js pages/admin/orders/\[id\].js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: manual WhatsApp send (dispatch template + custom message) from order detail"
```

---

## Task 8: Bulk actions + CSV export on orders list

**Files:**
- Modify: `pages/admin/orders/index.js`
- Create: `pages/api/admin/orders/bulk.js`

- [ ] **Step 1: Create bulk update API**

```js
// pages/api/admin/orders/bulk.js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

const ALLOWED_STATUSES = ['confirmed', 'sent', 'delivered', 'cancelled'];

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'POST') return res.status(405).end();

  const { orderIds, status } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0)
    return res.status(400).json({ error: 'orderIds required' });
  if (!ALLOWED_STATUSES.includes(status))
    return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });

  const updates = { status, updated_at: new Date().toISOString() };
  if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();

  const { error } = await supabase
    .from('orders').update(updates).in('order_id', orderIds);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ updated: orderIds.length });
}
```

- [ ] **Step 2: Update orders list page with checkboxes, bulk bar, CSV export**

In `pages/admin/orders/index.js`, add state:
```js
const [selected, setSelected] = useState(new Set());
const [bulkStatus, setBulkStatus] = useState('confirmed');
const [bulking, setBulking] = useState(false);
```

Add helper functions:
```js
const toggleSelect = (id) => {
  setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};

const selectAll  = () => setSelected(new Set(orders.map(o => o.order_id)));
const deselectAll = () => setSelected(new Set());

const bulkUpdate = async () => {
  if (!selected.size) return;
  if (!confirm(`Update ${selected.size} orders to "${bulkStatus}"?`)) return;
  setBulking(true);
  await fetch('/api/admin/orders/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderIds: [...selected], status: bulkStatus }),
  });
  setSelected(new Set());
  load();
  setBulking(false);
};

const exportCSV = () => {
  const rows = (selected.size ? orders.filter(o => selected.has(o.order_id)) : orders);
  const header = ['Order ID','Date','Name','Mobile','Email','Address','City','State','Pincode','Pack','Qty','Amount','Method','Status','AWB','Courier'];
  const lines  = rows.map(o => [
    o.order_id,
    new Date(o.created_at).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata' }),
    o.name, o.mobile, o.email || '',
    `"${(o.address || '').replace(/"/g, '""')}"`,
    o.city, o.state, o.pincode,
    o.pack, o.qty, o.price,
    o.method, o.status, o.awb || '', o.courier || '',
  ].join(','));
  const csv  = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `vedayu-orders-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
};
```

Add bulk action bar below the filter chips (visible when at least 1 order is checked, or always):
```jsx
<div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
  <button onClick={selected.size === orders.length ? deselectAll : selectAll}
    style={{ padding:'5px 10px', fontSize:'.72rem', fontWeight:700, borderRadius:6,
      border:'1.5px solid #d0c8bc', background:'#fff', cursor:'pointer' }}>
    {selected.size === orders.length ? 'Deselect all' : `Select all ${orders.length}`}
  </button>
  {selected.size > 0 && (
    <>
      <span style={{ fontSize:'.75rem', color:'#555' }}>{selected.size} selected</span>
      <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
        style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid #d0c8bc',
          fontSize:'.75rem' }}>
        <option value="confirmed">Confirmed</option>
        <option value="sent">Order Sent</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <button onClick={bulkUpdate} disabled={bulking}
        style={{ padding:'5px 12px', background:'#5C3D1E', color:'#fff',
          border:'none', borderRadius:6, fontSize:'.75rem', fontWeight:700, cursor:'pointer' }}>
        {bulking ? '…' : 'Update'}
      </button>
    </>
  )}
  <button onClick={exportCSV}
    style={{ padding:'5px 12px', background:'#f0ede8', color:'#5C3D1E',
      border:'none', borderRadius:6, fontSize:'.72rem', fontWeight:700, cursor:'pointer', marginLeft:'auto' }}>
    ⬇ Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}
  </button>
</div>
```

Update each `OrderCard` to include a checkbox. Wrap the existing `OrderCard` in a `div` with a checkbox:
```jsx
{orders.map(o => (
  <div key={o.order_id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
    <input type="checkbox" checked={selected.has(o.order_id)}
      onChange={() => toggleSelect(o.order_id)}
      style={{ marginTop:14, width:16, height:16, cursor:'pointer', flexShrink:0 }} />
    <div style={{ flex:1 }}>
      <OrderCard order={o} onClick={() => router.push(`/admin/orders/${o.order_id}`)} />
    </div>
  </div>
))}
```

Reset selected when filter/page changes — add `setSelected(new Set())` inside `handleFilter` and `handleSearch`.

- [ ] **Step 3: Show diff and request commit approval**

```bash
git add pages/api/admin/orders/bulk.js pages/admin/orders/index.js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: bulk status update and CSV export on orders list"
```

---

## Task 9: Referral leaderboard

**Files:**
- Create: `pages/api/admin/referrals.js`
- Create: `pages/admin/referrals.js`
- Modify: `components/admin/Layout.js` (add Referrals nav link)

- [ ] **Step 1: Create referrals API**

```js
// pages/api/admin/referrals.js
import { checkAdminAuth } from './_auth';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  // Get all referral records where someone was referred (referrer_id is set)
  const { data, error } = await supabase
    .from('referrals')
    .select('referrer_id, discount, order_id, method')
    .not('referrer_id', 'is', null);

  if (error) return res.status(500).json({ error: error.message });

  // Group by referrer_id
  const map = {};
  for (const r of (data || [])) {
    if (!map[r.referrer_id]) {
      map[r.referrer_id] = { referrerId: r.referrer_id, ordersReferred: 0, totalDiscount: 0 };
    }
    map[r.referrer_id].ordersReferred++;
    map[r.referrer_id].totalDiscount += r.discount || 0;
  }

  // Fetch owner details for each referrer order_id
  const referrerIds = Object.keys(map);
  if (referrerIds.length === 0) return res.json({ leaderboard: [] });

  const { data: ownerRows } = await supabase
    .from('referrals')
    .select('order_id, owner_mobile')
    .in('order_id', referrerIds);

  const mobileMap = {};
  for (const row of (ownerRows || [])) mobileMap[row.order_id] = row.owner_mobile;

  // Attach mobile; fetch names from orders
  const mobiles = [...new Set(Object.values(mobileMap))];
  const { data: customerRows } = await supabase
    .from('orders')
    .select('mobile, name')
    .in('mobile', mobiles)
    .order('created_at', { ascending: true });

  const nameMap = {};
  for (const c of (customerRows || [])) nameMap[c.mobile] = c.name;

  const leaderboard = Object.values(map)
    .map(entry => ({
      ...entry,
      mobile: mobileMap[entry.referrerId] || null,
      name:   nameMap[mobileMap[entry.referrerId]] || 'Unknown',
    }))
    .sort((a, b) => b.ordersReferred - a.ordersReferred)
    .slice(0, 50);

  return res.json({ leaderboard });
}
```

- [ ] **Step 2: Create referrals page**

```js
// pages/admin/referrals.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/admin/Layout';
import PageHeader from '../../components/admin/PageHeader';

const fmtRs = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function AdminReferrals() {
  const router = useRouter();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/referrals')
      .then(r => r.json())
      .then(d => { setData(d.leaderboard || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Referrals">
      <PageHeader title="Referral Leaderboard" />
      {loading
        ? <p style={{ color:'#888' }}>Loading…</p>
        : data.length === 0
          ? <p style={{ color:'#aaa' }}>No referral data yet.</p>
          : (
            <div style={{ background:'#fff', borderRadius:12, overflow:'hidden',
              boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#f5f0e8' }}>
                    {['#','Name','Mobile','Orders referred','Discount given'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left',
                        fontSize:'.72rem', fontWeight:700, textTransform:'uppercase',
                        letterSpacing:'.6px', color:'#888' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={row.referrerId}
                      onClick={() => row.mobile && router.push(`/admin/customers/${row.mobile}`)}
                      style={{ borderBottom:'1px solid #f0ede8', cursor: row.mobile ? 'pointer' : 'default' }}
                      onMouseOver={e => e.currentTarget.style.background = '#faf8f5'}
                      onMouseOut={e  => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', color:'#aaa' }}>{i + 1}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', fontWeight:600, color:'#1a1a1a' }}>{row.name}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', color:'#555', fontFamily:'monospace' }}>{row.mobile || '—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.9rem', fontWeight:800, color:'#4A7C59' }}>{row.ordersReferred}</td>
                      <td style={{ padding:'10px 14px', fontSize:'.83rem', color:'#5C3D1E', fontWeight:600 }}>{fmtRs(row.totalDiscount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      }
    </AdminLayout>
  );
}
```

- [ ] **Step 3: Add Referrals link to Layout nav**

In `components/admin/Layout.js`, add `{ href: '/admin/referrals', label: 'Referrals' }` to the nav links array.

- [ ] **Step 4: Show diff and request commit approval**

```bash
git add pages/api/admin/referrals.js pages/admin/referrals.js components/admin/Layout.js
git diff --staged --stat
# Wait for user approval, then:
git commit -m "feat: referral leaderboard admin page"
```

---

## Self-Review

**Spec coverage check:**
1. ✅ Order status management — Task 6 (confirm, RTO with reason, all transitions)
2. ✅ Bulk actions — Task 8 (checkboxes, bulk status update, select all)
3. ✅ CSV export — Task 8 (client-side, works on filtered + selected orders)
4. ✅ AWB entry UI — already exists in order detail; enhanced by Task 6 (still shows for confirmed/auto_confirmed)
5. ✅ Manual WhatsApp — Task 7 (dispatch template + free-text custom)
6. ✅ Returns/RTO — Task 6 (RTO button with reason field → sets return_reason + returned_at)
7. ✅ Notes on orders — Task 6 (Notes panel with add + list)
8. ✅ Refund tracking — Task 6 (Refund panel with amount/method/note)
9. ✅ Dashboard improvements — Task 5 (today's orders/revenue, awaiting dispatch, RTOs, pending COD)
10. ✅ Referral leaderboard — Task 9
11. ✅ Push notifications — Tasks 2 + 3 + 4 (subscribe UI, test, new order push, RTO push)

**Placeholder scan:** None found.

**Type consistency:** `order_id` used consistently as the join key. `sendPush({ title, body })` signature consistent across all callers. `checkAdminAuth(req)` used in all new API routes.
