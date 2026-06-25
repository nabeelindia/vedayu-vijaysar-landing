# Admin Create Order & Replacement Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create fresh orders and free replacement orders from the backend, with customer email + WhatsApp confirmation sent automatically.

**Architecture:** A single new page `/admin/orders/new` handles both fresh and replacement modes via a `?replace=[order_id]` query param. A new `POST /api/admin/orders` endpoint saves the order (DB first, notifications in parallel). Two new DB columns (`replacement_for`, `created_by`) track admin-created and replacement orders. The order detail page gains a "🔁 Create Replacement" button.

**Tech Stack:** Next.js 14 Pages Router, Supabase, Resend (email), WhatsApp via `lib/whatsapp.js`, `lib/orders.js` for order ID generation, `lib/push.js` for push alerts.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `lib/orders.js` | Add `'free'` → `'A'` and `'replacement'` → `'R'` prefix support |
| Create | `supabase/migrations/20260625000000_add_order_admin_fields.sql` | Add `replacement_for`, `created_by` columns |
| Modify | `pages/api/admin/orders/index.js` | Add `POST` handler for admin order creation |
| Create | `pages/admin/orders/new.js` | Create order form (fresh + replacement modes) |
| Modify | `pages/admin/orders/index.js` | Add "+ Create Order" button in page header |
| Modify | `pages/admin/orders/[id].js` | Add "🔁 Create Replacement" button + replacement_for badge + linked replacements section |
| Modify | `components/admin/OrderCard.js` | Show 🔁 Replacement badge when `replacement_for` is set |

---

## Task 1: Extend `generateOrderId` for free and replacement orders

**Files:**
- Modify: `lib/orders.js`

- [ ] **Step 1: Update generateOrderId to accept `'free'` and `'replacement'` methods**

Open `lib/orders.js`. Change the first few lines of `generateOrderId`:

```js
// lib/orders.js  (replace the existing generateOrderId function)

/**
 * Generates order IDs:
 *   cod         → VED-C250605XX
 *   prepaid     → VED-P250605XX
 *   free        → VED-A250605XX  (Admin/free order)
 *   replacement → VED-R250605XX  (Replacement order)
 * Counter resets each IST day. Falls back to base36 suffix if KV is down.
 */
export async function generateOrderId(method) {
  const prefixMap = { cod: 'C', prepaid: 'P', free: 'A', replacement: 'R' };
  const prefix = prefixMap[method];
  if (!prefix) throw new Error(`generateOrderId: invalid method "${method}"`);
  const date   = getISTDate();
  const kvKey  = `order_seq:${date}`;
  try {
    const seq = await kv.incr(kvKey);
    await kv.expire(kvKey, 172800);
    return `VED-${prefix}${date}${String(seq).padStart(2, '0')}`;
  } catch {
    const short = Date.now().toString(36).slice(-4).toUpperCase();
    return `VED-${prefix}F${date}${short}`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/orders.js
git commit -m "feat: extend generateOrderId to support free and replacement order types"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/20260625000000_add_order_admin_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260625000000_add_order_admin_fields.sql

alter table orders
  add column if not exists replacement_for text references orders(order_id) on delete set null,
  add column if not exists created_by text;

comment on column orders.replacement_for is 'order_id of the original order this replaces; null for non-replacements';
comment on column orders.created_by is '"admin" for backend-created orders; null for customer orders';
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies cleanly with no errors. If `supabase` CLI is not available, run the SQL directly in the Supabase SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260625000000_add_order_admin_fields.sql
git commit -m "feat: add replacement_for and created_by columns to orders table"
```

---

## Task 3: API — POST /api/admin/orders

**Files:**
- Modify: `pages/api/admin/orders/index.js`

- [ ] **Step 1: Add POST handler to the existing orders API**

Open `pages/api/admin/orders/index.js`. The file currently only handles `GET`. Add imports at the top and a new `POST` block. Replace the entire file with:

```js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';
import { generateOrderId } from '../../../../lib/orders';
import { Resend } from 'resend';
import { sendPush } from '../../../../lib/push';
import { waOrderConfirmed } from '../../../../lib/whatsapp';

// ─── GET ─────────────────────────────────────────────────────────────────────

function getOrdersQuery({ method, status, search, page, archived, date_from, date_to }) {
  const pageSize = 50;
  const offset   = (parseInt(page || '1') - 1) * pageSize;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  query = query.eq('archived', archived === 'true');

  if (method && method !== 'all') query = query.eq('method', method);
  if (status && status !== 'all') {
    query = query.eq('status', status);
  } else {
    query = query.neq('status', 'cancelled');
  }
  if (search) {
    const safeSearch = search.replace(/[(),.|%_\\]/g, '');
    query = query.or(
      `order_id.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%,pincode.ilike.%${safeSearch}%`
    );
  }
  if (date_from) query = query.gte('created_at', date_from + 'T00:00:00+05:30');
  if (date_to)   query = query.lte('created_at', date_to   + 'T23:59:59.999+05:30');

  return { query, pageSize };
}

// ─── POST helpers ─────────────────────────────────────────────────────────────

function buildOwnerEmail({ orderId, name, mobile, email, address, city, state, pincode,
                            pack, qty, price, method, isReplacement, replacementFor }) {
  const priceStr = isReplacement ? '₹0 (Free Replacement)' : `₹${Number(price).toLocaleString('en-IN')}`;
  const methodLabel = method === 'cod' ? 'COD' : method === 'prepaid' ? 'Prepaid' : 'Free';
  const icon = isReplacement ? '🔁' : method === 'cod' ? '🛒' : '💳';
  const fullAddr = [address, city, state, pincode].filter(Boolean).join(', ');

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
  <div style="background:#5C3D1E;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;font-size:1.2rem;">${icon} ${isReplacement ? 'Replacement' : 'Admin-Created'} Order — Vedayu</h2>
  </div>
  <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;width:40%;">Order ID</td><td style="padding:10px 0;font-family:monospace;font-weight:700;">${orderId}</td></tr>
      ${isReplacement ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Replaces</td><td style="padding:10px 0;font-family:monospace;color:#856404;font-weight:700;">${replacementFor}</td></tr>` : ''}
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Customer</td><td style="padding:10px 0;">${name}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Mobile</td><td style="padding:10px 0;"><a href="tel:+91${mobile}" style="color:#5C3D1E;">+91 ${mobile}</a></td></tr>
      ${email ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Email</td><td style="padding:10px 0;">${email}</td></tr>` : ''}
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Address</td><td style="padding:10px 0;">${fullAddr}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:10px 0;">${pack}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Qty</td><td style="padding:10px 0;">${qty} glass(es)</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Amount</td><td style="padding:10px 0;font-size:1.1rem;font-weight:700;color:${isReplacement ? '#4A7C59' : '#5C3D1E'};">${priceStr}</td></tr>
      <tr><td style="padding:10px 0;font-weight:600;color:#3D2610;">Method</td><td style="padding:10px 0;">${methodLabel}</td></tr>
    </table>
    <div style="background:#FFF8E1;border-left:4px solid #F9A825;padding:12px 16px;margin-top:20px;font-size:.82rem;color:#5C3D1E;border-radius:0 6px 6px 0;">
      ⚙️ This order was <strong>created manually by an admin</strong>.
    </div>
  </div>
</div>`;
}

function buildCustomerEmail({ orderId, name, pack, qty, price, address, city, state, pincode, isReplacement }) {
  const fullAddr = [address, city, state, pincode].filter(Boolean).join(', ');
  const priceStr = isReplacement ? '₹0' : `₹${Number(price).toLocaleString('en-IN')}`;

  return `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
  <div style="background:#5C3D1E;padding:20px 24px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;">Order Confirmed — Vedayu</h2>
  </div>
  <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;">Dear ${name},</p>
    ${isReplacement
      ? `<p style="margin:0 0 16px;">Your replacement order has been created. We will dispatch it to you within 1–2 business days.</p>`
      : `<p style="margin:0 0 16px;">Your order has been confirmed. We will dispatch it within 1–2 business days.</p>`
    }
    <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;width:40%;">Order ID</td><td style="padding:9px 0;font-family:monospace;font-weight:700;">${orderId}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:9px 0;">${pack}</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Qty</td><td style="padding:9px 0;">${qty} glass(es)</td></tr>
      <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Amount</td><td style="padding:9px 0;font-weight:700;">${priceStr}</td></tr>
      <tr><td style="padding:9px 0;font-weight:600;color:#3D2610;">Deliver to</td><td style="padding:9px 0;">${fullAddr}</td></tr>
    </table>
    <p style="margin:20px 0 0;font-size:.82rem;color:#888;">
      Track your order at <a href="https://vedayulife.com/track?order=${orderId}" style="color:#5C3D1E;">vedayulife.com/track</a>
    </p>
  </div>
</div>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { method, status, search, page = '1', archived, date_from, date_to } = req.query;
    const { query, pageSize } = getOrdersQuery({ method, status, search, page, archived, date_from, date_to });
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    const { data, count, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data, total: count, page: parseInt(page), pageSize });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      name, mobile, email,
      address, city, state, pincode,
      pack, qty, price,
      method: paymentMethod,
      status,
      note,
      replacement_for,
    } = req.body;

    // Validate required fields
    const missing = ['name','mobile','address','city','state','pincode','pack','qty'].filter(f => !req.body[f]);
    if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });

    const mobile10 = String(mobile).replace(/\D/g, '');
    if (mobile10.length !== 10) return res.status(400).json({ error: 'Mobile must be 10 digits' });
    if (String(pincode).replace(/\D/g, '').length !== 6) return res.status(400).json({ error: 'Pincode must be 6 digits' });

    const isReplacement = Boolean(replacement_for);
    const idMethod      = isReplacement ? 'replacement' : (paymentMethod || 'cod');
    const finalPrice    = isReplacement ? 0 : Number(price) || 0;
    const finalMethod   = isReplacement ? 'free' : (paymentMethod || 'cod');
    const finalStatus   = status || (isReplacement ? 'confirmed' : 'pending');

    // ── 1. Generate order ID ──────────────────────────────────────────────────
    const orderId = await generateOrderId(idMethod);

    // ── 2. Save to DB FIRST ───────────────────────────────────────────────────
    const { error: ordErr } = await supabase.from('orders').insert({
      order_id:        orderId,
      name:            name.trim(),
      mobile:          mobile10,
      email:           email?.trim() || null,
      address:         address.trim(),
      city:            city.trim(),
      state:           state.trim(),
      pincode:         String(pincode).trim(),
      pack,
      qty:             Number(qty),
      price:           finalPrice,
      method:          finalMethod,
      status:          finalStatus,
      replacement_for: replacement_for || null,
      created_by:      'admin',
    });

    if (ordErr) {
      console.error('[CRITICAL] admin orders.insert() failed:', ordErr.message, 'orderId:', orderId);
      sendPush({
        title: `⚠️ ADMIN ORDER LOST — ${name}`,
        body:  `DB write failed. ${orderId} NOT saved. ${mobile10}`,
      }).catch(() => {});
      return res.status(500).json({ error: 'Failed to save order. Please try again.' });
    }

    // ── 3. Save internal note if provided ─────────────────────────────────────
    if (note?.trim()) {
      await supabase.from('order_notes').insert({ order_id: orderId, note: note.trim() });
    }

    // ── 4. Send notifications in parallel ─────────────────────────────────────
    const priceStr = finalPrice ? `₹${Number(finalPrice).toLocaleString('en-IN')}` : '₹0';

    const notifications = [];

    if (process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      notifications.push(
        resend.emails.send({
          from:    'Vedayu Orders <orders@vedayulife.com>',
          to:      process.env.ORDERS_EMAIL,
          subject: `${isReplacement ? '🔁 Replacement' : '⚙️ Admin'} Order — ${pack} — ${priceStr} | ${name}`,
          html:    buildOwnerEmail({ orderId, name, mobile: mobile10, email, address, city, state, pincode, pack, qty, price: finalPrice, method: finalMethod, isReplacement, replacementFor: replacement_for }),
        })
      );

      if (email?.trim()) {
        notifications.push(
          resend.emails.send({
            from:    'Vedayu <orders@vedayulife.com>',
            to:      email.trim(),
            subject: isReplacement
              ? `Your replacement order is confirmed — ${orderId} | Vedayu`
              : `Order confirmed — ${orderId} | Vedayu`,
            html:    buildCustomerEmail({ orderId, name, pack, qty, price: finalPrice, address, city, state, pincode, isReplacement }),
          })
        );
      }
    }

    notifications.push(
      waOrderConfirmed({ mobile: mobile10, name, pack, orderId, price: finalPrice, scheduledShipDate: null, method: finalMethod })
    );

    notifications.push(
      sendPush({
        title: `${isReplacement ? '🔁 Replacement' : '⚙️ Admin'} order — ${name}`,
        body:  `${pack} · ${priceStr} · ${mobile10}`,
      })
    );

    await Promise.allSettled(notifications);

    return res.status(201).json({ order_id: orderId });
  }

  return res.status(405).end();
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/admin/orders/index.js
git commit -m "feat: POST /api/admin/orders — admin and replacement order creation"
```

---

## Task 4: Create Order Page (`/admin/orders/new`)

**Files:**
- Create: `pages/admin/orders/new.js`

- [ ] **Step 1: Create the page**

```js
// pages/admin/orders/new.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../../components/admin/Layout';
import PageHeader from '../../../components/admin/PageHeader';

const PACKS = [
  { name: 'Pack of 1', qty: 1, price: 499 },
  { name: 'Pack of 2', qty: 2, price: 899 },
  { name: 'Pack of 5', qty: 5, price: 1999 },
];

const inp = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 8,
  border: '1.5px solid #e0d8cc', fontSize: '.85rem',
  color: '#2C1810', outline: 'none', fontFamily: 'inherit',
};
const inpPrefilled = { ...inp, background: '#f5faf6', borderColor: '#c3e6cb', color: '#2d6a4f' };
const row2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const row3 = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 };
const label = { display: 'block', fontSize: '.75rem', fontWeight: 700, color: '#5C3D1E', marginBottom: 4 };
const fieldBox = { marginBottom: 12 };
const sectionTitle = {
  fontSize: '.68rem', fontWeight: 800, letterSpacing: '.1em',
  textTransform: 'uppercase', color: '#a07850', margin: '20px 0 8px',
};

export default function NewOrderPage() {
  const router = useRouter();
  const { replace: replaceId } = router.query;
  const isReplacement = Boolean(replaceId);

  const [origOrder, setOrigOrder]   = useState(null);
  const [loadingOrig, setLoadingOrig] = useState(false);

  const [form, setForm] = useState({
    name: '', mobile: '', email: '',
    address: '', city: '', state: '', pincode: '',
  });
  const [selectedPack, setSelectedPack] = useState(0); // index into PACKS
  const [customPack, setCustomPack]     = useState({ name: '', qty: '', price: '' });
  const [isCustom, setIsCustom]         = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [orderStatus, setOrderStatus]     = useState('confirmed');
  const [note, setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // Load original order if replace mode
  useEffect(() => {
    if (!replaceId) return;
    setLoadingOrig(true);
    fetch(`/api/admin/orders/${replaceId}`)
      .then(r => r.json())
      .then(d => {
        const o = d.order;
        if (!o) { setError('Original order not found'); return; }
        setOrigOrder(o);
        setForm({
          name:    o.name    || '',
          mobile:  o.mobile  || '',
          email:   o.email   || '',
          address: o.address || '',
          city:    o.city    || '',
          state:   o.state   || '',
          pincode: o.pincode || '',
        });
        // Match the same pack if possible
        const idx = PACKS.findIndex(p => p.name === o.pack);
        if (idx >= 0) setSelectedPack(idx);
      })
      .finally(() => setLoadingOrig(false));
  }, [replaceId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const getPack = () => isCustom
    ? { name: customPack.name, qty: Number(customPack.qty), price: Number(customPack.price) }
    : PACKS[selectedPack];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pack = getPack();
    if (isCustom && (!pack.name || !pack.qty)) {
      setError('Enter custom pack name and qty.'); return;
    }

    setSaving(true);
    const body = {
      ...form,
      pack:             pack.name,
      qty:              pack.qty,
      price:            isReplacement ? 0 : pack.price,
      method:           isReplacement ? 'free' : paymentMethod,
      status:           isReplacement ? 'confirmed' : orderStatus,
      note:             note.trim() || undefined,
      replacement_for:  isReplacement ? replaceId : undefined,
    };

    const res = await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error || 'Failed to create order'); return; }
    router.push(`/admin/orders/${data.order_id}`);
  };

  if (loadingOrig) return <AdminLayout title="Create Order"><p style={{ color:'#888' }}>Loading original order…</p></AdminLayout>;

  return (
    <AdminLayout title="Create Order">
      <PageHeader title={isReplacement ? '🔁 Create Replacement Order' : '+ Create New Order'} />

      {/* Replacement: linked badge */}
      {isReplacement && origOrder && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', background: '#fdf4ec',
          border: '1.5px solid #e0c49a', borderRadius: 10,
          fontSize: '.78rem', fontWeight: 700, color: '#856404', marginBottom: 20,
        }}>
          🔗 Replacement for <span style={{ fontFamily: 'monospace' }}>{replaceId}</span>
          <span style={{ fontWeight: 400, color: '#a07850' }}>
            — {origOrder.name} · {origOrder.pack} · {origOrder.method?.toUpperCase()}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        {/* Customer */}
        <div style={sectionTitle}>Customer Information</div>
        <div style={row2}>
          <div style={fieldBox}>
            <label style={label}>Full Name *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.name}
              onChange={set('name')} required placeholder="Priya Sharma" />
          </div>
          <div style={fieldBox}>
            <label style={label}>Mobile *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.mobile}
              onChange={set('mobile')} required placeholder="10-digit mobile" maxLength={10} />
          </div>
        </div>
        <div style={fieldBox}>
          <label style={label}>Email</label>
          <input style={isReplacement ? inpPrefilled : inp} value={form.email}
            onChange={set('email')} type="email" placeholder="Optional" />
        </div>

        {/* Address */}
        <div style={sectionTitle}>Delivery Address</div>
        <div style={fieldBox}>
          <label style={label}>Address Line *</label>
          <input style={isReplacement ? inpPrefilled : inp} value={form.address}
            onChange={set('address')} required placeholder="House no, street, area, landmark" />
        </div>
        <div style={row3}>
          <div style={fieldBox}>
            <label style={label}>City *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.city}
              onChange={set('city')} required placeholder="City" />
          </div>
          <div style={fieldBox}>
            <label style={label}>State *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.state}
              onChange={set('state')} required placeholder="State" />
          </div>
          <div style={fieldBox}>
            <label style={label}>Pincode *</label>
            <input style={isReplacement ? inpPrefilled : inp} value={form.pincode}
              onChange={set('pincode')} required placeholder="6-digit" maxLength={6} />
          </div>
        </div>

        {/* Pack */}
        <div style={sectionTitle}>Pack</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {PACKS.map((p, i) => (
            <div key={p.name}
              onClick={() => { setIsCustom(false); setSelectedPack(i); }}
              style={{
                border: `2px solid ${!isCustom && selectedPack === i ? '#5C3D1E' : '#e0d8cc'}`,
                borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
                background: !isCustom && selectedPack === i ? '#fdf4ec' : '#faf7f3',
              }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#5C3D1E' }}>{p.name}</div>
              <div style={{ fontSize: '.7rem', color: '#888' }}>{p.qty} glass{p.qty > 1 ? 'es' : ''}</div>
              <div style={{ fontSize: '.82rem', fontWeight: 800, color: isReplacement ? '#4A7C59' : '#2C1810', marginTop: 4 }}>
                {isReplacement ? '₹0' : `₹${p.price.toLocaleString('en-IN')}`}
              </div>
            </div>
          ))}
          <div
            onClick={() => setIsCustom(true)}
            style={{
              border: `2px solid ${isCustom ? '#5C3D1E' : '#e0d8cc'}`,
              borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center',
              background: isCustom ? '#fdf4ec' : '#faf7f3',
            }}>
            <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#5C3D1E' }}>Custom</div>
            <div style={{ fontSize: '.7rem', color: '#888' }}>Enter manually</div>
            <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#888', marginTop: 4 }}>—</div>
          </div>
        </div>

        {isCustom && (
          <div style={{ ...row3, marginBottom: 12 }}>
            <div style={fieldBox}>
              <label style={label}>Pack Name *</label>
              <input style={inp} value={customPack.name}
                onChange={e => setCustomPack(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Pack of 3" />
            </div>
            <div style={fieldBox}>
              <label style={label}>Qty *</label>
              <input style={inp} type="number" min="1" value={customPack.qty}
                onChange={e => setCustomPack(p => ({ ...p, qty: e.target.value }))}
                placeholder="3" />
            </div>
            <div style={fieldBox}>
              <label style={label}>Price (₹)</label>
              <input style={inp} type="number" min="0" value={customPack.price}
                onChange={e => setCustomPack(p => ({ ...p, price: e.target.value }))}
                placeholder={isReplacement ? '0' : '1299'} disabled={isReplacement} />
            </div>
          </div>
        )}

        {isReplacement && (
          <div style={{ fontSize: '.75rem', color: '#4A7C59', fontWeight: 700, marginBottom: 12 }}>
            💚 Price automatically set to ₹0 (free replacement)
          </div>
        )}

        {/* Method + Status (fresh orders only) */}
        {!isReplacement && (
          <>
            <div style={sectionTitle}>Order Details</div>
            <div style={row2}>
              <div style={fieldBox}>
                <label style={label}>Payment Method *</label>
                <select style={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="cod">COD (Cash on Delivery)</option>
                  <option value="prepaid">Prepaid (Online paid)</option>
                  <option value="free">Free / Gift</option>
                </select>
              </div>
              <div style={fieldBox}>
                <label style={label}>Order Status *</label>
                <select style={inp} value={orderStatus} onChange={e => setOrderStatus(e.target.value)}>
                  <option value="confirmed">Confirmed (skip confirmation)</option>
                  <option value="pending">Pending (needs confirmation)</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Notifications notice */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#f0f9f4',
          border: '1.5px solid #c3e6cb', borderRadius: 8, marginBottom: 16,
        }}>
          <span style={{ fontSize: '.78rem', color: '#2d6a4f', fontWeight: 600 }}>
            ✉️ Confirmation email + 📲 WhatsApp will be sent to the customer automatically
          </span>
        </div>

        {/* Internal note */}
        <div style={sectionTitle}>
          Internal Note <span style={{ fontWeight: 400, fontSize: '.68rem', color: '#aaa' }}>(optional)</span>
        </div>
        <div style={fieldBox}>
          <textarea style={{ ...inp, resize: 'vertical' }} rows={2} value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={isReplacement ? 'e.g. Original order lost in transit' : 'e.g. Phone order from customer'} />
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: '#FFF3F3', border: '1.5px solid #FFCDD2',
            borderRadius: 8, color: '#C62828', fontSize: '.82rem', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} style={{
          width: '100%', padding: 14, background: saving ? '#c4a882' : '#5C3D1E',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: '.95rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Creating…' : isReplacement ? 'Create Replacement Order →' : 'Create Order →'}
        </button>
      </form>
    </AdminLayout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/admin/orders/new.js
git commit -m "feat: admin create order page (fresh and replacement modes)"
```

---

## Task 5: Add "+ Create Order" button to orders list

**Files:**
- Modify: `pages/admin/orders/index.js`

- [ ] **Step 1: Import useRouter and add button to PageHeader**

In `pages/admin/orders/index.js`, `useRouter` is already imported. Find the `<PageHeader>` line and add an `action` prop:

```js
// Replace:
<PageHeader title={`Orders (${total})`} />

// With:
<PageHeader
  title={`Orders (${total})`}
  action={
    <button
      onClick={() => router.push('/admin/orders/new')}
      style={{
        padding: '8px 16px', background: '#5C3D1E', color: '#fff',
        border: 'none', borderRadius: 8, fontSize: '.8rem',
        fontWeight: 700, cursor: 'pointer',
      }}>
      + Create Order
    </button>
  }
/>
```

- [ ] **Step 2: Commit**

```bash
git add pages/admin/orders/index.js
git commit -m "feat: add Create Order button to orders list header"
```

---

## Task 6: Order detail — replacement button + badges

**Files:**
- Modify: `pages/admin/orders/[id].js`

- [ ] **Step 1: Load replacements in the order detail API**

Open `pages/api/admin/orders/[id].js`. In the `GET` handler, add a replacements query alongside the existing parallel fetches:

```js
// Add to the Promise.all in the GET handler:
const [orderRes, verifRes, notesRes, refundsRes, replRes] = await Promise.all([
  supabase.from('orders').select('*').eq('order_id', id).single(),
  supabase.from('cod_verifications').select('*').eq('order_id', id).maybeSingle(),
  supabase.from('order_notes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  supabase.from('refunds').select('*').eq('order_id', id).order('created_at', { ascending: false }),
  supabase.from('orders').select('order_id,pack,status,created_at').eq('replacement_for', id).order('created_at', { ascending: false }),
]);
```

Then include it in the return:

```js
return res.json({
  order:        orderRes.data,
  verification: verifRes.data,
  notes:        notesRes.data   || [],
  refunds:      refundsRes.data || [],
  replacements: replRes.data    || [],
  shipment,
});
```

Then in `pages/admin/orders/[id].js`, add a `replacements` state and wire it up:

```js
const [replacements, setReplacements] = useState([]);
```

In the `useEffect` that calls `setData(d)`, add:

```js
setReplacements(d.replacements || []);
```

- [ ] **Step 2: Add replacement_for badge near order ID**

Find the block where the order ID / order header is rendered (search for `order.order_id` in the JSX). Add this badge immediately after the order ID display:

```jsx
{order.replacement_for && (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', background: '#fff3cd',
    border: '1.5px solid #ffc107', borderRadius: 20,
    fontSize: '.72rem', fontWeight: 700, color: '#856404', marginTop: 6,
  }}>
    🔁 Replacement for{' '}
    <span
      onClick={() => router.push(`/admin/orders/${order.replacement_for}`)}
      style={{ fontFamily: 'monospace', cursor: 'pointer', textDecoration: 'underline' }}>
      {order.replacement_for}
    </span>
  </div>
)}
```

- [ ] **Step 3: Add "Create Replacement" button in the actions row**

Find where the existing action buttons are rendered (search for `confirmOrder` or the "Confirm" / "Mark Sent" buttons section). Add the replacement button:

```jsx
<button
  onClick={() => router.push(`/admin/orders/new?replace=${order.order_id}`)}
  style={{
    padding: '8px 14px', background: '#fff3cd', color: '#856404',
    border: '1.5px solid #ffc107', borderRadius: 8,
    fontSize: '.8rem', fontWeight: 700, cursor: 'pointer',
  }}>
  🔁 Create Replacement
</button>
```

- [ ] **Step 4: Add "Linked Replacements" section at the bottom**

Before the closing `</AdminLayout>`, add:

```jsx
{replacements.length > 0 && (
  <div style={{ background:'#fff', borderRadius:12, padding:'18px 20px',
    boxShadow:'0 1px 3px rgba(0,0,0,.07)', marginTop:16 }}>
    <h2 style={{ margin:'0 0 12px', fontSize:'.85rem', fontWeight:700,
      textTransform:'uppercase', letterSpacing:'.7px', color:'#888' }}>
      🔁 Replacement Orders ({replacements.length})
    </h2>
    {replacements.map(r => (
      <div key={r.order_id}
        onClick={() => router.push(`/admin/orders/${r.order_id}`)}
        style={{ padding:'10px 12px', background:'#fdf8f0', borderRadius:8,
          border:'1.5px solid #e0d8cc', marginBottom:6, cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:'.85rem', color:'#5C3D1E' }}>
            {r.order_id}
          </div>
          <div style={{ fontSize:'.75rem', color:'#888', marginTop:2 }}>
            {r.pack} · {new Date(r.created_at).toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata', dateStyle:'medium' })}
          </div>
        </div>
        <span style={{ fontSize:'.72rem', fontWeight:700, padding:'3px 10px',
          borderRadius:20, background:'#fff3cd', color:'#856404', border:'1px solid #ffc107' }}>
          {r.status}
        </span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Commit**

```bash
git add "pages/admin/orders/[id].js" "pages/api/admin/orders/[id].js"
git commit -m "feat: replacement button, badge, and linked replacements section on order detail"
```

---

## Task 7: OrderCard — replacement badge

**Files:**
- Modify: `components/admin/OrderCard.js`

- [ ] **Step 1: Add replacement badge**

In `components/admin/OrderCard.js`, inside the right-side column that shows `StatusBadge` and method badge, add after the method badge:

```jsx
{order.replacement_for && (
  <span style={{
    fontSize: '.65rem', fontWeight: 700,
    color: '#856404', background: '#FFF8E1',
    padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
    border: '1px solid #ffc107',
  }}>
    🔁 Replacement
  </span>
)}
```

Also update the left-side method badge to handle `'free'` orders (admin/replacement):

```jsx
// Replace the existing method badge span:
<span style={{ fontSize: '.65rem', fontWeight: 700,
  color: order.method === 'cod' ? '#6D4C00' : order.method === 'prepaid' ? '#2E7D32' : '#5C3D1E',
  background: order.method === 'cod' ? '#FFF8E1' : order.method === 'prepaid' ? '#E8F5E9' : '#f0ede8',
  padding: '2px 7px', borderRadius: 20 }}>
  {order.method === 'cod' ? 'COD' : order.method === 'prepaid' ? 'Prepaid' : 'Free'}
</span>
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/OrderCard.js
git commit -m "feat: show Replacement and Free badges on OrderCard"
```

---

## Task 8: Smoke test and deploy

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test fresh order creation**

1. Go to `/admin/orders`
2. Click "+ Create Order"
3. Fill in all fields (Pack of 1, COD, Confirmed)
4. Submit → should redirect to the new order detail page
5. Verify: order appears in the orders list, `created_by = 'admin'` in DB, push notification received

- [ ] **Step 3: Test replacement order creation**

1. Open any existing order detail page (e.g. `/admin/orders/VED-C250605XX`)
2. Click "🔁 Create Replacement"
3. Verify: form pre-filled with original order's customer + address
4. Change pack if desired, submit
5. Verify: replacement order detail shows "🔁 Replacement for [original_id]" badge
6. Go back to original order → should show "🔁 Replacement Orders (1)" section
7. Check orders list → replacement card should show "🔁 Replacement" badge

- [ ] **Step 4: Deploy**

```bash
git push origin main
```

Vercel auto-deploys on push to `main`. Monitor the Vercel dashboard for build success.
