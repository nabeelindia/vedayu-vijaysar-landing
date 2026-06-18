# Design Spec: Checkout Cookie, Orders Admin Improvements, Chat Date Separators

**Date:** 2026-06-19  
**Scope:** Three independent improvements across checkout, admin orders, and admin chat panels.

---

## 1. Checkout: Cookie + Address Pre-fill + EDD Trigger

### Problem
- The `vedayu_customer` cookie saves `name`, `mobile`, `email`, `pincode`, `city`, `state` but **never writes** `house`, `area`, or `landmark`. Those fields are read from the cookie but are always empty.
- The `lookup-customer` API returns the DB `address` column (a combined string like "123 MG Road, Bandra"), but the form has separate `house` / `area` / `landmark` fields. Pre-fill logic sets `f.address` which doesn't exist in the form — so nothing is actually filled.
- When pincode is pre-filled from cookie or lookup, the delivery-estimate (EDD) is never triggered because `handlePincode` is only called on user keystrokes.

### Fix

**1a. Cookie write** (`pages/index.js` → `writeCustomerCookie` calls)  
Add `house`, `area`, `landmark` to every `writeCustomerCookie` invocation.

**1b. Cookie restore** (`pages/index.js` → restore `useEffect`)  
Already reads `c.house` / `c.area` — works automatically once they're written. Add `landmark: c.landmark || f.landmark`.

**1c. Lookup pre-fill** (`pages/index.js` → `tryLookup`)  
The orders table stores only a combined `address` string (no separate columns — schema change not required). Map `data.customer.address` → `house` field as a best-effort pre-fill. Leave `area` and `landmark` empty so the customer can review.

```js
// inside tryLookup, when data.found:
setForm(f => ({
  ...f,
  name:    f.name    || c.name,
  house:   f.house   || c.address,   // combined address → house field
  pincode: f.pincode || c.pincode,
  city:    f.city    || c.city,
  state:   f.state   || c.state,
}));
```

**1d. EDD trigger after pre-fill**  
After cookie restore AND after lookup pre-fill, call `handlePincode(pincode)` if a pincode was populated. This fires the delivery estimate and shows the EDD badge immediately.

```js
// in cookie restore useEffect, after setForm:
if (c?.pincode) handlePincode(c.pincode);

// in tryLookup, after setForm:
if (c.pincode && !form.pincode) handlePincode(c.pincode);
```

**Note:** `handlePincode` is defined with `useCallback` — the cookie restore `useEffect` currently has an eslint-disable comment for its deps. The pincode call can go inside the same effect without issue.

---

## 2. Admin Orders: Hide Cancelled/Archived from "All" + Better Card Fields

### Problem
- The `all` filter shows cancelled and archived orders, making it noisy for day-to-day ops.
- `OrderCard` shows name + city but not the customer's mobile number, which is frequently needed.

### Fix

**2a. API: exclude cancelled + archived from "all"** (`pages/api/admin/orders/index.js`)  
When the request has no `status` param and `archived=false`, add a server-side filter:
```js
.not('status', 'in', '("cancelled","archived")')
```
The "archived" filter tab still explicitly passes `archived=true` so it continues to work. The "cancelled" tab still passes `status=cancelled` so it continues to work.

**2b. OrderCard: add mobile** (`components/admin/OrderCard.js`)  
Change the second line from `{order.name} · {order.city}` to `{order.name} · {order.mobile} · {order.city}`.

---

## 3. Inline Date Separators in WhatsApp and AI Chat Windows

### Problem
Conversations span multiple days but messages only show time (e.g., `02:35 pm`), making it impossible to tell when a conversation crossed midnight.

### Fix

**Shared helper:** A `dateSeparatorLabel(iso)` function that returns:
- `"Today"` if the message date is today (IST)
- `"Yesterday"` if it's yesterday
- `"15 Jun"` (day + short month) otherwise

**Insertion logic:** When rendering the message list, track the last rendered date. Before each message, compare its date to the previous. If different, render a centered date chip above the message.

```jsx
// date chip style
<div style={{ textAlign: 'center', margin: '8px 0' }}>
  <span style={{ fontSize: '.68rem', color: '#aaa', background: '#f5f0e8',
    padding: '2px 10px', borderRadius: 20 }}>
    {label}
  </span>
</div>
```

**Affected files:**
- `pages/admin/whatsapp.js` → `Thread` component, message loop
- `pages/admin/chats.js` → `SessionDetail` component, message loop

Both files already have `fmtTime` — add `dateSeparatorLabel` alongside it, or extract to a shared inline helper since both files are self-contained.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `pages/index.js` | Save `house`/`area`/`landmark` in cookie; trigger EDD after pre-fill |
| `pages/api/admin/orders/index.js` | Exclude `cancelled`/`archived` from `all` filter |
| `components/admin/OrderCard.js` | Add `mobile` to card display |
| `pages/admin/whatsapp.js` | Date separator chips in Thread message list |
| `pages/admin/chats.js` | Date separator chips in SessionDetail message list |

No database schema changes. No new API routes.
