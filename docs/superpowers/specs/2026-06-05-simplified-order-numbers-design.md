# Simplified Order Numbers

**Date:** 2026-06-05  
**Status:** Approved  
**Build order:** 1 of 3 (foundational — admin panel and COD flow depend on this)

---

## Problem

Current order IDs use `VED-COD-${Date.now()}` — 20+ characters, timestamp-based, ugly to read on screen or communicate over the phone.

## Solution

Order numbers are built from three components — no separator, compact and readable:

```
VED - C - 250605 - 01
 │    │      │      └─ daily sequence: 01, 02 … 09, 10, 11 … (resets each IST day)
 │    │      └─ date in IST (YYMMDD)
 │    └─ payment type: C (COD) or P (Prepaid)
 └─ brand prefix
```

Examples (June 5, 2025):
- `VED-C25060501` — 1st COD order of the day
- `VED-P25060502` — 2nd order of the day, prepaid
- `VED-C25060510` — 10th COD order of the day

The counter resets every IST midnight. Each day starts fresh from 01. Date is embedded so you always know when an order was placed just from its ID.

---

## Implementation

### Counter mechanism

A per-day KV key `order_seq:YYMMDD` incremented atomically. 48-hour TTL ensures yesterday's key expires cleanly.

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

export async function generateOrderId(method) {
  const prefix = method === 'prepaid' ? 'P' : 'C';
  const date   = getISTDate();
  const kvKey  = `order_seq:${date}`;

  try {
    const seq = await kv.incr(kvKey);
    await kv.expire(kvKey, 172800); // 48h TTL
    const seqStr = String(seq).padStart(2, '0'); // 01, 02 … 10, 11
    return `VED-${prefix}${date}${seqStr}`;
  } catch {
    // Fallback: VED-CF250605A3B2 (F = fallback, base36 microseconds)
    const short = Date.now().toString(36).slice(-4).toUpperCase();
    return `VED-${prefix}F${date}${short}`;
  }
}
```

Flow:
- 1st order of the day (COD): seq=1 → `VED-C25060501`
- 2nd order of the day (Prepaid): seq=2 → `VED-P25060502`
- 10th order of the day (COD): seq=10 → `VED-C25060510`
- Next day resets: seq=1 → `VED-C25060601`

Fallback IDs contain `F` after the type letter — easy to spot in the admin panel.

### Files to update

**`lib/orders.js`** — new file, exports `generateOrderId(method)`

**`pages/api/submit-cod.js`**
- Remove: `const orderId = \`VED-COD-${Date.now()}\``
- Add: `const orderId = await generateOrderId('cod')`

**`pages/api/verify-payment.js`** (prepaid)
- Remove timestamp ID
- Add: `const orderId = await generateOrderId('prepaid')`

### Migration note

Existing orders retain their long timestamp IDs. No migration needed — the new per-day sequence starts fresh.

---

## Out of scope

- Global sequence (non-resetting) — intentionally excluded; daily reset keeps IDs short
- Skipping numbers or reserving ranges
