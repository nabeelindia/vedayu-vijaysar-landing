# Orders: Address-Changed Tag, Archive, and Date Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an address-changed badge on orders that customers updated via WhatsApp, an archive feature to hide test orders, and a date-range preset filter to the admin orders list.

**Architecture:** Schema migration adds two boolean columns (`address_changed`, `archived`) to `orders`. The webhook sets `address_changed` when a customer changes their address. The admin API gains `archived`, `date_from`, `date_to` query params. The frontend adds an Archived tab, date preset dropdown, archive button, and address-changed badge — all wired to the existing `load()` + `patch()` pattern.

**Tech Stack:** Next.js 14 Pages Router, Supabase (postgres), React state, existing `components/admin/` component system.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `supabase/migrations/011_address_changed_archive.sql` | Create | Adds `address_changed`, `archived` columns + index |
| `pages/api/whatsapp-webhook.js` | Modify | Sets `address_changed = true` on address update |
| `pages/api/admin/orders/index.js` | Modify | Adds `archived`, `date_from`, `date_to` query params |
| `pages/api/admin/orders/[id].js` | Modify | Allows `archived` in PATCH allowlist |
| `pages/api/admin/orders/bulk.js` | Modify | Adds `archive` / `unarchive` actions |
| `components/admin/OrderCard.js` | Modify | Shows address-changed badge |
| `pages/admin/orders/index.js` | Modify | Archived tab, date preset dropdown, bulk archive, pagination reset |
| `pages/admin/orders/[id].js` | Modify | Address-changed badge near address, Archive/Unarchive button |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/011_address_changed_archive.sql`

- [ ] **Create the migration file**

```sql
-- supabase/migrations/011_address_changed_archive.sql
alter table orders
  add column if not exists address_changed boolean not null default false,
  add column if not exists archived        boolean not null default false;

create index if not exists orders_archived_idx on orders(archived);
```

- [ ] **Push to Supabase**

```bash
npx supabase db push
```

Expected: `Applying migration 011_address_changed_archive.sql...` then `Finished supabase db push.`

- [ ] **Commit**

```bash
git add supabase/migrations/011_address_changed_archive.sql
git commit -m "feat: add address_changed and archived columns to orders"
```

---

## Task 2: Webhook — Set address_changed on Address Update

**Files:**
- Modify: `pages/api/whatsapp-webhook.js` (address-change section, around line 173)

- [ ] **Find the address update block** — it currently reads:

```js
const { error: aOrdErr } = await supabase.from('orders')
  .update({ address: newAddress, updated_at: now })
  .eq('order_id', addrChange.orderId);
```

- [ ] **Add `address_changed: true` to the update**

```js
const { error: aOrdErr } = await supabase.from('orders')
  .update({ address: newAddress, address_changed: true, updated_at: now })
  .eq('order_id', addrChange.orderId);
```

- [ ] **Commit**

```bash
git add pages/api/whatsapp-webhook.js
git commit -m "feat: set address_changed=true when customer updates delivery address"
```

---

## Task 3: API — Orders list supports archived + date filters

**Files:**
- Modify: `pages/api/admin/orders/index.js`

- [ ] **Replace the entire file** with the following (adds `archived`, `date_from`, `date_to` while preserving all existing logic):

```js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });
  if (req.method !== 'GET') return res.status(405).end();

  const { method, status, search, page = '1', archived, date_from, date_to } = req.query;
  const pageSize = 50;
  const offset   = (parseInt(page) - 1) * pageSize;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  // archived filter — default false so normal views never show archived orders
  query = query.eq('archived', archived === 'true');

  if (method && method !== 'all') query = query.eq('method', method);
  if (status && status !== 'all') query = query.eq('status', status);
  if (search) {
    query = query.or(
      `order_id.ilike.%${search}%,name.ilike.%${search}%,mobile.ilike.%${search}%,pincode.ilike.%${search}%`
    );
  }

  if (date_from) query = query.gte('created_at', date_from + 'T00:00:00+05:30');
  if (date_to)   query = query.lte('created_at', date_to   + 'T23:59:59+05:30');

  const { data, count, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.json({ data, total: count, page: parseInt(page), pageSize });
}
```

- [ ] **Commit**

```bash
git add pages/api/admin/orders/index.js
git commit -m "feat: orders API supports archived, date_from, date_to filters"
```

---

## Task 4: API — Allow `archived` in order PATCH; bulk archive/unarchive

**Files:**
- Modify: `pages/api/admin/orders/[id].js`
- Modify: `pages/api/admin/orders/bulk.js`

- [ ] **In `pages/api/admin/orders/[id].js`**, find the `allowed` array in the PATCH block and add `'archived'`:

```js
const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                 'sent_at', 'delivered_at', 'returned_at', 'return_reason', 'confirmed_at',
                 'scheduled_ship_date', 'archived'];
```

- [ ] **Replace `pages/api/admin/orders/bulk.js`** entirely:

```js
import { checkAdminAuth } from '../_auth';
import { supabase } from '../../../../lib/supabase';

const ALLOWED_STATUSES = ['confirmed', 'sent', 'delivered', 'cancelled'];

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabase)             return res.status(503).json({ error: 'DB not configured' });
  if (req.method !== 'POST') return res.status(405).end();

  const { orderIds, status, action } = req.body;
  if (!Array.isArray(orderIds) || orderIds.length === 0)
    return res.status(400).json({ error: 'orderIds required' });

  let updates;

  if (action === 'archive') {
    updates = { archived: true,  updated_at: new Date().toISOString() };
  } else if (action === 'unarchive') {
    updates = { archived: false, updated_at: new Date().toISOString() };
  } else {
    if (!ALLOWED_STATUSES.includes(status))
      return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    updates = { status, updated_at: new Date().toISOString() };
    if (status === 'delivered') updates.delivered_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('orders').update(updates).in('order_id', orderIds);
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ updated: orderIds.length });
}
```

- [ ] **Commit**

```bash
git add pages/api/admin/orders/\[id\].js pages/api/admin/orders/bulk.js
git commit -m "feat: allow archived field in order PATCH; bulk archive/unarchive actions"
```

---

## Task 5: OrderCard — Address-changed badge

**Files:**
- Modify: `components/admin/OrderCard.js`

- [ ] **Add the badge** after the `{order.scheduled_ship_date && <StatusBadge status="scheduled" small />}` line:

```jsx
{order.address_changed && (
  <span style={{
    fontSize: '.65rem', fontWeight: 700,
    color: '#E65100', background: '#FFF3E0',
    padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
  }}>
    📍 Address updated
  </span>
)}
```

- [ ] **Commit**

```bash
git add components/admin/OrderCard.js
git commit -m "feat: show address-updated badge on OrderCard"
```

---

## Task 6: Order Detail — Address-changed badge + Archive button

**Files:**
- Modify: `pages/admin/orders/[id].js`

- [ ] **Add archive state** near the top of the component, after existing state declarations:

```js
const archiving = saving; // reuse saving state — archive uses patch() which sets saving
```

No new state variable needed — `patch()` already sets `saving`.

- [ ] **Find the address display** in the order detail render. It shows `data.order.address` (or similar field row). Add the badge immediately after the address value. Search for `address` in the render — it appears in a table row. Add after the address cell value:

```jsx
{order.address_changed && (
  <span style={{
    marginLeft: 8, fontSize: '.72rem', fontWeight: 700,
    color: '#E65100', background: '#FFF3E0',
    padding: '2px 8px', borderRadius: 20,
  }}>
    📍 Address updated
  </span>
)}
```

- [ ] **Find the actions row** (where `confirmOrder`, `markRTO`, Cancel buttons live — around line 190–225). Add an Archive/Unarchive button at the end of that group:

```jsx
<button
  onClick={() => {
    const next = !order.archived;
    if (confirm(next ? 'Archive this order? It will be hidden from the main list.' : 'Unarchive this order?')) {
      patch({ archived: next });
    }
  }}
  disabled={saving}
  style={{
    padding: '8px 16px', borderRadius: 8, border: '1.5px solid #d0c8bc',
    background: order.archived ? '#fff' : '#f0ede8',
    color: order.archived ? '#2E7D32' : '#888',
    fontSize: '.8rem', fontWeight: 700, cursor: 'pointer',
  }}
>
  {order.archived ? '📤 Unarchive' : '🗂 Archive'}
</button>
```

- [ ] **Commit**

```bash
git add "pages/admin/orders/[id].js"
git commit -m "feat: address-changed badge and archive button on order detail"
```

---

## Task 7: Orders List — Archived tab, date filter, bulk archive, pagination reset

**Files:**
- Modify: `pages/admin/orders/index.js`

This is the largest change. Read the current file fully before editing.

- [ ] **Add `dateRange` state** near the other state declarations (after `const [bulking, setBulking] = useState(false)`):

```js
const [dateRange, setDateRange] = useState('');
```

- [ ] **Add the date-range helper** above the component (after imports):

```js
// Returns { date_from, date_to } as YYYY-MM-DD strings in IST, or {} for 'all'
function getDateParams(range) {
  if (!range) return {};
  const toIST = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const today = new Date();
  const yyyymmdd = (d) => toIST(d);
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

  if (range === 'today') {
    const d = yyyymmdd(today);
    return { date_from: d, date_to: d };
  }
  if (range === 'yesterday') {
    const d = yyyymmdd(addDays(today, -1));
    return { date_from: d, date_to: d };
  }
  if (range === 'last7')  return { date_from: yyyymmdd(addDays(today, -6)),  date_to: yyyymmdd(today) };
  if (range === 'last15') return { date_from: yyyymmdd(addDays(today, -14)), date_to: yyyymmdd(today) };
  if (range === 'last30') return { date_from: yyyymmdd(addDays(today, -29)), date_to: yyyymmdd(today) };
  if (range === 'thisMonth') {
    const d = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    return { date_from: yyyymmdd(first), date_to: yyyymmdd(today) };
  }
  if (range === 'lastMonth') {
    const d = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const firstThisMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const lastOfLastMonth = new Date(firstThisMonth - 1);
    const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1);
    return { date_from: yyyymmdd(firstOfLastMonth), date_to: yyyymmdd(lastOfLastMonth) };
  }
  return {};
}
```

- [ ] **Update the `load` function** to accept and pass `dr` (dateRange) and `arch` (archived via filter):

```js
const load = (f = filter, s = search, p = page, dr = dateRange) => {
  setLoading(true);
  const params = new URLSearchParams({ page: p });
  if (f === 'archived') {
    params.set('archived', 'true');
  } else {
    params.set('archived', 'false');
    if (['cod', 'prepaid'].includes(f)) params.set('method', f);
    else if (f !== 'all') params.set('status', f);
  }
  if (s) params.set('search', s);
  const { date_from, date_to } = getDateParams(dr);
  if (date_from) params.set('date_from', date_from);
  if (date_to)   params.set('date_to', date_to);
  fetch(`/api/admin/orders?${params}`).then(r => r.json()).then(d => {
    setOrders(d.data || []);
    setTotal(d.total || 0);
    setLoading(false);
  });
};
```

- [ ] **Update `handleFilter`** to also reset dateRange:

```js
const handleFilter = (f) => {
  setSelected(new Set()); setFilter(f); setPage(1);
  load(f, search, 1, dateRange);
};
```

- [ ] **Add `handleDateRange`** after `handleFilter`:

```js
const handleDateRange = (dr) => {
  setSelected(new Set()); setDateRange(dr); setPage(1);
  load(filter, search, 1, dr);
};
```

- [ ] **Update `handleSearch`**:

```js
const handleSearch = (e) => {
  if (e.key === 'Enter') { setSelected(new Set()); setPage(1); load(filter, e.target.value, 1, dateRange); }
};
```

- [ ] **Update the `useEffect`** to pass dateRange:

```js
useEffect(() => { load(filter, search, page, dateRange); }, []);
```

- [ ] **Update the Prev/Next pagination buttons** so they pass dateRange:

```jsx
{page > 1 && (
  <button onClick={() => { const p = page-1; setPage(p); load(filter, search, p, dateRange); }}
    style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid #e0d8cc',
      background:'#fff', cursor:'pointer', fontSize:'.82rem' }}>← Prev</button>
)}
<span style={{ fontSize:'.8rem', color:'#888' }}>
  Page {page} · {total} orders
</span>
<button onClick={() => { const p = page+1; setPage(p); load(filter, search, p, dateRange); }}
  style={{ padding:'6px 14px', borderRadius:8, border:'1.5px solid #e0d8cc',
    background:'#fff', cursor:'pointer', fontSize:'.82rem' }}>Next →</button>
```

- [ ] **Add `'archived'` to the FILTERS array**:

```js
const FILTERS = ['all','cod','prepaid','pending','confirmed','auto_confirmed','sent','delivered','cancelled','archived'];
```

- [ ] **Update filter button labels** — the filter bar maps FILTERS to buttons. Update the label function to handle `'archived'`:

Find the existing filter bar render. The buttons currently use the filter value as the label. Replace the label expression so `'archived'` renders as `'🗂 Archived'`:

```jsx
{FILTERS.map(f => (
  <button key={f} onClick={() => handleFilter(f)}
    style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer',
      fontSize:'.75rem', fontWeight:700,
      background: filter === f ? '#5C3D1E' : '#f0ede8',
      color: filter === f ? '#fff' : '#555' }}>
    {f === 'all' ? 'All'
      : f === 'auto_confirmed' ? 'Auto-confirmed'
      : f === 'archived' ? '🗂 Archived'
      : f.charAt(0).toUpperCase() + f.slice(1)}
  </button>
))}
```

- [ ] **Add date filter dropdown** — place it on the same row as the search bar, to the right. Replace the search `<input>` block with a wrapper div:

```jsx
<div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
  <input type="search" placeholder="Search by name, mobile, order ID, pincode…"
    value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearch}
    style={{ flex:1, padding:'10px 14px', borderRadius:10,
      border:'1.5px solid #e0d8cc', fontSize:'.88rem', outline:'none' }} />
  <select value={dateRange} onChange={e => handleDateRange(e.target.value)}
    style={{ padding:'10px 12px', borderRadius:10, border:'1.5px solid #e0d8cc',
      fontSize:'.82rem', background:'#fff', color: dateRange ? '#5C3D1E' : '#888',
      fontWeight: dateRange ? 700 : 400, cursor:'pointer', outline:'none', flexShrink:0 }}>
    <option value="">All time</option>
    <option value="today">Today</option>
    <option value="yesterday">Yesterday</option>
    <option value="last7">Last 7 days</option>
    <option value="last15">Last 15 days</option>
    <option value="last30">Last 30 days</option>
    <option value="thisMonth">This month</option>
    <option value="lastMonth">Last month</option>
  </select>
</div>
```

- [ ] **Update bulk status `<select>`** to include Archive / Unarchive options:

```jsx
<select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
  style={{ padding:'5px 8px', borderRadius:6, border:'1.5px solid #d0c8bc', fontSize:'.75rem' }}>
  <option value="confirmed">Confirmed</option>
  <option value="sent">Sent</option>
  <option value="delivered">Delivered</option>
  <option value="cancelled">Cancelled</option>
  <option value="__archive__">🗂 Archive</option>
  <option value="__unarchive__">📤 Unarchive</option>
</select>
```

- [ ] **Update `bulkUpdate`** to handle archive/unarchive pseudo-statuses:

```js
const bulkUpdate = async () => {
  if (!selected.size) return;
  if (!confirm(`Update ${selected.size} order(s)?`)) return;
  setBulking(true);

  const body = { orderIds: [...selected] };
  if (bulkStatus === '__archive__')   { body.action = 'archive'; }
  else if (bulkStatus === '__unarchive__') { body.action = 'unarchive'; }
  else { body.status = bulkStatus; }

  await fetch('/api/admin/orders/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  setSelected(new Set());
  load();
  setBulking(false);
};
```

- [ ] **Commit**

```bash
git add pages/admin/orders/index.js
git commit -m "feat: archived tab, date filter, bulk archive/unarchive on orders list"
```

---

## Task 8: Deploy

- [ ] **Deploy to production**

```bash
vercel --prod
```

Expected: `Production: https://vedayulife.com` with `READY` state.

- [ ] **Smoke test**
  1. Open `/admin/orders` — verify all existing filters still work, no 'archived' orders visible.
  2. Open an order → tap "🗂 Archive" → confirm → order disappears from list.
  3. Switch to "🗂 Archived" tab → archived order appears; "📤 Unarchive" restores it.
  4. Change date filter to "Today" → only today's orders show.
  5. Select multiple orders → bulk "🗂 Archive" → they disappear.
  6. (If a test order has `address_changed=true` in DB) open it → "📍 Address updated" badge visible.

- [ ] **Final commit (if any fixes needed after smoke test)**

```bash
git add -p
git commit -m "fix: post-deploy smoke test fixes"
```
