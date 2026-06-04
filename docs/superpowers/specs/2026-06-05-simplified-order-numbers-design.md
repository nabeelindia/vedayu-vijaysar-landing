# Simplified Order Numbers

**Date:** 2026-06-05  
**Status:** Approved  
**Build order:** 1 of 3 (foundational — admin panel and COD flow depend on this)

---

## Problem

Current order IDs use `VED-COD-${Date.now()}` — 20+ characters, timestamp-based, ugly to read on screen or communicate over the phone.

## Solution

Sequential order numbers starting at **VED-10001**, unified across COD and prepaid. Short, memorable, phone-friendly.

Examples: `VED-10001`, `VED-10002`, `VED-10047`

No COD/prepaid distinction in the number — payment method is visible in the order detail.

---

## Implementation

### Counter mechanism

Use `kv.incr('order_seq')` — Vercel KV's atomic increment. No race conditions under concurrent orders. Starting offset: seed `order_seq` to `9000` so the first call returns `9001` + offset of `1000` = `VED-10001`.

Actually simpler: seed `order_seq` to `0`, add offset of `10000` in the helper:

```js
// lib/orders.js
import { kv } from '@vercel/kv';

export async function generateOrderId() {
  const seq = await kv.incr('order_seq');
  return `VED-${10000 + seq}`;
}
```

First call: seq=1 → `VED-10001`  
Second call: seq=2 → `VED-10002`

### Files to update

**`lib/orders.js`** — new file, exports `generateOrderId()`

**`pages/api/submit-cod.js`**
- Remove: `const orderId = \`VED-COD-${Date.now()}\``
- Add: `const orderId = await generateOrderId()`

**`pages/api/verify-payment.js`** (prepaid)
- Same replacement: remove timestamp ID, use `generateOrderId()`

### Migration note

Existing orders (placed before this change) have long timestamp IDs in KV and emails. They remain unchanged — no migration needed. The new sequence starts fresh at VED-10001 regardless of historical orders.

---

## Error handling

If `kv.incr` fails (KV unavailable), fall back to a timestamp-based ID so the order is never lost:

```js
export async function generateOrderId() {
  try {
    const seq = await kv.incr('order_seq');
    return `VED-${10000 + seq}`;
  } catch {
    return `VED-T${Date.now().toString(36).toUpperCase()}`;
  }
}
```

Fallback IDs start with `VED-T` so they're distinguishable in the admin panel.

---

## Out of scope

- Resetting or skipping numbers
- Per-channel prefixes (COD/prepaid distinction in the ID)
- Displaying order progress via the number (e.g. gap detection)
