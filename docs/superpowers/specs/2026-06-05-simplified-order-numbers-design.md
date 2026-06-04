# Simplified Order Numbers

**Date:** 2026-06-05  
**Status:** Approved  
**Build order:** 1 of 3 (foundational — admin panel and COD flow depend on this)

---

## Problem

Current order IDs use `VED-COD-${Date.now()}` — 20+ characters, timestamp-based, ugly to read on screen or communicate over the phone.

## Solution

Sequential order numbers with three components:

```
VED - C - 10001 - 250605
 │    │     │       └─ short date (YYMMDD in IST)
 │    │     └─ sequential number starting at 10001
 │    └─ payment type: C (COD) or P (Prepaid)
 └─ brand prefix
```

Examples:
- `VED-C10001-250605` — COD order #10001 placed on 5 Jun 2025
- `VED-P10002-250605` — Prepaid order #10002 placed on 5 Jun 2025

The date component lets you instantly know when the order was placed without opening it. The C/P prefix makes payment type visible at a glance in any list, email, or SMS.

---

## Implementation

### Counter mechanism

`kv.incr('order_seq')` — Vercel KV's atomic increment. No race conditions under concurrent orders.

```js
// lib/orders.js
import { kv } from '@vercel/kv';

export async function generateOrderId(method) {
  const seq    = await kv.incr('order_seq');
  const prefix = method === 'prepaid' ? 'P' : 'C';

  // Short date in IST (YYMMDD)
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yy  = String(ist.getFullYear()).slice(2);
  const mm  = String(ist.getMonth() + 1).padStart(2, '0');
  const dd  = String(ist.getDate()).padStart(2, '0');
  const date = `${yy}${mm}${dd}`;

  return `VED-${prefix}${10000 + seq}-${date}`;
}
```

First COD call:     seq=1 → `VED-C10001-250605`  
First prepaid call: seq=2 → `VED-P10002-250605`

### Files to update

**`lib/orders.js`** — new file, exports `generateOrderId(method)`

**`pages/api/submit-cod.js`**
- Remove: `const orderId = \`VED-COD-${Date.now()}\``
- Add: `const orderId = await generateOrderId('cod')`

**`pages/api/verify-payment.js`** (prepaid)
- Remove timestamp ID
- Add: `const orderId = await generateOrderId('prepaid')`

### Migration note

Existing orders (placed before this change) retain their long timestamp IDs in KV, emails, and Velocity. No migration needed — the new sequence starts fresh from VED-C10001.

---

## Error handling

If `kv.incr` fails (KV unavailable), fall back to a short base36 timestamp so the order is never lost:

```js
export async function generateOrderId(method) {
  const prefix = method === 'prepaid' ? 'P' : 'C';
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const yy  = String(ist.getFullYear()).slice(2);
  const mm  = String(ist.getMonth() + 1).padStart(2, '0');
  const dd  = String(ist.getDate()).padStart(2, '0');
  const date = `${yy}${mm}${dd}`;

  try {
    const seq = await kv.incr('order_seq');
    return `VED-${prefix}${10000 + seq}-${date}`;
  } catch {
    // Fallback: VED-CF-A3B2-250605 (F = fallback, base36 suffix)
    const short = Date.now().toString(36).slice(-4).toUpperCase();
    return `VED-${prefix}F-${short}-${date}`;
  }
}
```

Fallback IDs contain `F` after the type prefix — distinguishable in the admin panel.

---

## Out of scope

- Resetting the sequence counter
- Daily-reset sequences (e.g. order #1 every new day)
- Displaying order progress via the number (gap detection)
