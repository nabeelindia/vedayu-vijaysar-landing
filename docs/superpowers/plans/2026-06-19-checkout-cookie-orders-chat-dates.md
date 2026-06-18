# Checkout Cookie, Orders Admin, Chat Date Separators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix address fields missing from customer cookie, pre-fill address from last order + trigger EDD, hide cancelled/archived from All orders filter, add mobile to OrderCard, and show date separators in WhatsApp and AI chat windows.

**Architecture:** Five isolated edits across five files — no new routes, no schema changes, no shared utilities needed. Each task is independently committable.

**Tech Stack:** Next.js 14 Pages Router, React hooks, Supabase (already wired), plain JS date formatting in IST.

---

## Files Changed

| File | What changes |
|------|-------------|
| `pages/index.js` | Write `house`/`area`/`landmark` into cookie; pre-fill from lookup; trigger EDD after pre-fill |
| `pages/api/admin/orders/index.js` | Exclude `cancelled` from the default `all` filter |
| `components/admin/OrderCard.js` | Add `mobile` to the second line |
| `pages/admin/whatsapp.js` | Date separator chips in Thread message list |
| `pages/admin/chats.js` | Date separator chips in SessionDetail message list |

---

## Task 1: Fix cookie — save house/area/landmark

**Files:**
- Modify: `pages/index.js` (lines ~589 and ~639)

Context: `writeCustomerCookie` is called in two places after order placement (prepaid at ~589, COD at ~639). It currently saves `address` (the combined string) but not the individual fields. The cookie restore at line ~265 already reads `c.house` / `c.area` — they're just never written.

- [ ] **Step 1: Update both writeCustomerCookie calls**

Find the first call (around line 589, inside the prepaid flow):
```js
writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, address: computedAddress, pincode: form.pincode, city: form.city, state: form.state });
```
Replace with:
```js
writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, house: form.house, area: form.area, landmark: form.landmark, pincode: form.pincode, city: form.city, state: form.state });
```

Find the second call (around line 639, inside the COD flow) — same replacement:
```js
writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, house: form.house, area: form.area, landmark: form.landmark, pincode: form.pincode, city: form.city, state: form.state });
```

- [ ] **Step 2: Add landmark to cookie restore useEffect**

The restore `useEffect` (around line 265) currently restores `house` and `area` but not `landmark`. Add it:
```js
useEffect(() => {
  const c = readCustomerCookie();
  if (c?.name) {
    setForm(f => ({
      ...f,
      name:     c.name     || f.name,
      mobile:   c.mobile   || f.mobile,
      email:    c.email    || f.email,
      house:    c.house    || f.house,
      area:     c.area     || f.area,
      landmark: c.landmark || f.landmark,
      pincode:  c.pincode  || f.pincode,
      city:     c.city     || f.city,
      state:    c.state    || f.state,
    }));
    setWelcomeBack(c.name);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 3: Commit**
```bash
git add pages/index.js
git commit -m "fix: save house/area/landmark in customer cookie"
```

---

## Task 2: Pre-fill address from last order + trigger EDD

**Files:**
- Modify: `pages/index.js` (lines ~424–450 `tryLookup`, and ~265–282 cookie restore `useEffect`)

Context: `tryLookup` fires when mobile (10 digits) + email are both entered. It fetches `/api/lookup-customer` which returns `{ name, address, city, state, pincode }` from the last order. Currently it tries to set `f.address` which doesn't exist in the form — so nothing fills. The fix maps `address` → `house` field. After either cookie restore or lookup, if a pincode was populated we must call `handlePincode(pincode)` to trigger the EDD display.

- [ ] **Step 1: Fix tryLookup pre-fill and add EDD trigger**

Replace the `tryLookup` callback (lines ~424–450):
```js
const tryLookup = useCallback(async (mobile, email) => {
  if (!/^[6-9][0-9]{9}$/.test(mobile)) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  clearTimeout(lookupRef.current);
  lookupRef.current = setTimeout(async () => {
    try {
      const res  = await fetch('/api/lookup-customer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mobile, email }),
      });
      const data = await res.json();
      if (data.found) {
        const c = data.customer;
        setForm(f => ({
          ...f,
          name:    f.name    || c.name,
          house:   f.house   || c.address,
          pincode: f.pincode || c.pincode,
          city:    f.city    || c.city,
          state:   f.state   || c.state,
        }));
        if (c.pincode) handlePincode(c.pincode);
        setWelcomeBack(c.name);
      }
    } catch (_) {}
  }, 400);
}, [handlePincode]);
```

- [ ] **Step 2: Trigger EDD after cookie restore**

In the cookie restore `useEffect` (around line 265), add the EDD trigger after `setWelcomeBack`:
```js
useEffect(() => {
  const c = readCustomerCookie();
  if (c?.name) {
    setForm(f => ({
      ...f,
      name:     c.name     || f.name,
      mobile:   c.mobile   || f.mobile,
      email:    c.email    || f.email,
      house:    c.house    || f.house,
      area:     c.area     || f.area,
      landmark: c.landmark || f.landmark,
      pincode:  c.pincode  || f.pincode,
      city:     c.city     || f.city,
      state:    c.state    || f.state,
    }));
    setWelcomeBack(c.name);
    if (c.pincode) handlePincode(c.pincode);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 3: Commit**
```bash
git add pages/index.js
git commit -m "feat: pre-fill address from last order and trigger EDD on cookie restore"
```

---

## Task 3: Admin orders API — exclude cancelled from "all"

**Files:**
- Modify: `pages/api/admin/orders/index.js`

Context: Line 23 currently only filters by `status` when it's explicitly passed. The "all" filter passes nothing, so cancelled orders appear. The fix adds a `.not()` exclusion when no specific status is requested and archived is false.

- [ ] **Step 1: Add cancelled exclusion to the "all" branch**

Replace lines 22–23:
```js
if (method && method !== 'all') query = query.eq('method', method);
if (status && status !== 'all') query = query.eq('status', status);
```
With:
```js
if (method && method !== 'all') query = query.eq('method', method);
if (status && status !== 'all') {
  query = query.eq('status', status);
} else if (!status || status === 'all') {
  // "all" filter: hide cancelled orders (archived already excluded above via eq('archived', false))
  query = query.neq('status', 'cancelled');
}
```

- [ ] **Step 2: Commit**
```bash
git add pages/api/admin/orders/index.js
git commit -m "fix: exclude cancelled orders from the All filter in admin orders"
```

---

## Task 4: OrderCard — add mobile number

**Files:**
- Modify: `components/admin/OrderCard.js`

Context: Line 31 renders `{order.name} · {order.city}`. Adding `order.mobile` makes it easy to call the customer without opening the order detail.

- [ ] **Step 1: Add mobile to the name/city line**

Replace line 31:
```js
<div style={{ fontSize: '.82rem', color: '#333', marginTop: 2 }}>
  {order.name} · {order.city}
</div>
```
With:
```js
<div style={{ fontSize: '.82rem', color: '#333', marginTop: 2 }}>
  {order.name} · {order.mobile} · {order.city}
</div>
```

- [ ] **Step 2: Commit**
```bash
git add components/admin/OrderCard.js
git commit -m "ux: show customer mobile in admin OrderCard"
```

---

## Task 5: Date separator chips in WhatsApp Thread

**Files:**
- Modify: `pages/admin/whatsapp.js`

Context: The `Thread` component renders messages in a loop (lines ~81–98). Messages only show time. We need to detect when the date changes between messages and insert a labeled chip.

- [ ] **Step 1: Add dateSeparatorLabel helper near the top of the file (after fmtTime)**

After line 12 (the `fmtTime` definition), insert:
```js
const msgDateKey = iso => iso
  ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  : null;

const dateSeparatorLabel = (iso) => {
  if (!iso) return null;
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === todayIST) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yIST = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === yIST) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
};
```

- [ ] **Step 2: Update the message loop inside Thread to render date chips**

Find the message rendering loop inside `Thread` (the `conv.messages.map` block, around line 81). Replace it with:
```js
{(() => {
  let lastDate = null;
  return conv.messages.map((m, i) => {
    const isOut = m.direction === 'out';
    const ts = fmtTime(m.created_at || m.timestamp);
    const dateKey = msgDateKey(m.created_at || m.timestamp);
    const showSeparator = dateKey && dateKey !== lastDate;
    if (showSeparator) lastDate = dateKey;
    const separatorLabel = showSeparator ? dateSeparatorLabel(m.created_at || m.timestamp) : null;
    return (
      <div key={i}>
        {separatorLabel && (
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <span style={{ fontSize: '.68rem', color: '#aaa', background: '#f5f0e8',
              padding: '2px 10px', borderRadius: 20 }}>
              {separatorLabel}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOut ? 'flex-end' : 'flex-start' }}>
          <div style={{ maxWidth: '80%', background: isOut ? '#5C3D1E' : '#f0ede8',
            color: isOut ? '#fff' : '#1a1a1a',
            padding: '8px 12px', borderRadius: 10, fontSize: '.84rem', lineHeight: 1.45 }}>
            {m.message || m.bot_replied}
          </div>
          {ts && (
            <span style={{ fontSize: '.62rem', color: '#aaa', marginTop: 2, paddingLeft: 4, paddingRight: 4 }}>
              {ts}
            </span>
          )}
        </div>
      </div>
    );
  });
})()}
```

- [ ] **Step 3: Commit**
```bash
git add pages/admin/whatsapp.js
git commit -m "ux: show date separator chips in WhatsApp chat thread"
```

---

## Task 6: Date separator chips in AI Chats SessionDetail

**Files:**
- Modify: `pages/admin/chats.js`

Context: `SessionDetail` renders `messages.map` (lines ~132–153). Same pattern as WhatsApp.

- [ ] **Step 1: Add the same helpers after fmtTime (line ~11)**

After the existing `fmtTime` definition:
```js
const msgDateKey = iso => iso
  ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  : null;

const dateSeparatorLabel = (iso) => {
  if (!iso) return null;
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const d = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === todayIST) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yIST = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (d === yIST) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });
};
```

- [ ] **Step 2: Update the message loop inside SessionDetail**

Find the `messages.map` block (around line 132). Replace it with:
```js
{(() => {
  let lastDate = null;
  return messages.map((m, i) => {
    const isUser = m.role === 'user';
    const ts = fmtTime(m.timestamp || m.created_at);
    const dateKey = msgDateKey(m.timestamp || m.created_at);
    const showSeparator = dateKey && dateKey !== lastDate;
    if (showSeparator) lastDate = dateKey;
    const separatorLabel = showSeparator ? dateSeparatorLabel(m.timestamp || m.created_at) : null;
    return (
      <div key={i}>
        {separatorLabel && (
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <span style={{ fontSize: '.68rem', color: '#aaa', background: '#f5f0e8',
              padding: '2px 10px', borderRadius: 20 }}>
              {separatorLabel}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
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
      </div>
    );
  });
})()}
```

- [ ] **Step 3: Commit**
```bash
git add pages/admin/chats.js
git commit -m "ux: show date separator chips in AI chat session detail"
```
