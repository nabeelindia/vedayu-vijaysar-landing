# Admin: Create Order & Replacement Order

**Date:** 2026-06-25  
**Status:** Approved for implementation

---

## Overview

Admins can create orders directly from the backend in two scenarios:

1. **Fresh Order** — a manual order for any customer (e.g. phone order, gift, corporate)
2. **Replacement Order** — a free replacement for a previous order, initiated from the original order's detail page

---

## Entry Points

### Fresh Order
- Button: **"+ Create Order"** (top-right of `/admin/orders`)
- Opens: `/admin/orders/new` — a full create-order page

### Replacement Order
- Button: **"🔁 Create Replacement"** on the order detail page `/admin/orders/[id]`
- Opens: `/admin/orders/new?replace=[original_order_id]` — same page, pre-filled mode
- No standalone replacement-only page; one page handles both modes via query param

---

## Database Changes

Add two columns to the `orders` table:

| Column | Type | Notes |
|--------|------|-------|
| `replacement_for` | `text` (nullable) | `order_id` of the original order this replaces |
| `created_by` | `text` (nullable) | `"admin"` for backend-created orders, null for customer orders |

`replacement_for IS NOT NULL` implicitly identifies a replacement order — no separate boolean needed.

---

## Fresh Order Form (`/admin/orders/new`)

### Fields

**Customer**
- Full Name * 
- Mobile * (10-digit)
- Email (optional)

**Delivery Address**
- Address Line * (house, street, area, landmark)
- City *
- State *
- Pincode *

**Pack & Price**
- Pack selector: Pack of 1 (₹499, 1 glass) / Pack of 2 (₹899, 2 glasses) / Pack of 5 (₹1999, 5 glasses) / Custom
- Custom pack: admin types pack label + price manually
- Price auto-fills from pack selection; editable

**Order Details**
- Payment Method: COD / Prepaid / Free
- Order Status: Pending / Confirmed

**Notifications**
- Email + WhatsApp sent automatically on creation (not toggleable — always on per product decision)

**Internal Note** (optional)
- Saved to `order_notes` table immediately after order creation

---

## Replacement Order Form (`/admin/orders/new?replace=[id]`)

### Behaviour
- Page detects `?replace=` query param and fetches the original order on load
- All customer + address fields pre-filled from the original order (editable in case address changed)
- Pack defaults to same pack as original order; admin can change it
- **Price is locked at ₹0** — not editable
- `replacement_for` is set to the original `order_id`
- `method` is set to `"free"` (no payment)
- Status defaults to `"confirmed"`
- Linked badge shown at top: "🔗 Replacement for #ORD-2025-XXXXXX — [Customer Name] · [Pack] · [Method]"
- Email + WhatsApp sent on creation (same as fresh order)

### After Creation
Replacement orders enter the **normal order lifecycle** — same tracking, AWB entry, courier, delivery status flow as any other order. No special post-creation handling.

---

## API: `POST /api/admin/orders`

New endpoint (alongside existing `GET /api/admin/orders`).

### Request body
```json
{
  "name": "Priya Sharma",
  "mobile": "9876543210",
  "email": "priya@example.com",
  "address": "12 MG Road, Andheri West",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400058",
  "pack": "Pack of 2",
  "qty": 2,
  "price": 899,
  "method": "cod",
  "status": "confirmed",
  "note": "Phone order from customer",
  "replacement_for": null
}
```

### Order ID generation
Same prefix/format as existing orders (reuse the existing ID generator).

### DB write order (per CLAUDE.md invariant)
1. `orders.insert()` — FIRST, always
2. `order_notes.insert()` — if note provided
3. `Promise.allSettled([email, whatsapp, push])` — in parallel, failures don't block response

### Response
```json
{ "order_id": "ORD-2025-115001" }
```
Frontend redirects to `/admin/orders/[order_id]` on success.

---

## Order Detail & List: Replacement Indicators

- **Order detail page**: show a "🔁 Replacement for #ORD-..." badge near the order ID when `replacement_for` is set
- **Order card** (list view): show a small `🔁 Replacement` tag on the card
- **Original order detail**: if any replacement orders exist for this order_id, show a "Replacements" section listing them with links

---

## Order List: Filtering

No new filter tab needed initially — replacement orders appear in the normal list. The `replacement_for` badge on the card is sufficient identification.

---

## Constraints & Edge Cases

- Mobile validation: 10 digits, no spaces
- Pincode validation: 6 digits
- Custom pack: require both label and price > 0 (or 0 for free)
- If `orders.insert()` fails: send push alert (same pattern as existing COD/prepaid flows) and return 500 — do not proceed to notifications
- Replacement orders: `price` is hardcoded to `0` on the API side regardless of what the client sends (server enforces it)
- Admin auth required (`checkAdminAuth`) — same as all other admin API routes
