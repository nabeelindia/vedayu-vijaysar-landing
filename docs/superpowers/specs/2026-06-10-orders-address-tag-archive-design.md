# Orders: Address-Changed Tag, Archive, and Date Filter

**Date:** 2026-06-10  
**Status:** Approved

---

## Overview

Three improvements to the admin orders list:

1. **Address-changed tag** — surface when a customer updated their delivery address via WhatsApp so the dispatcher knows to use the new address.
2. **Archive** — let admin hide test/junk orders from all normal views; archived orders live in a dedicated tab and are still searchable.
3. **Date filter** — preset date-range dropdown to quickly scope the order list.

---

## 1. Schema — Migration 011

```sql
alter table orders
  add column if not exists address_changed boolean not null default false,
  add column if not exists archived        boolean not null default false;

create index if not exists orders_archived_idx on orders(archived);
```

---

## 2. Address-Changed Tag

### Webhook (`pages/api/whatsapp-webhook.js`)
When the address-change flow completes (after writing `address: newAddress` to `orders`), also set `address_changed = true` in the same update:

```js
.update({ address: newAddress, address_changed: true, updated_at: now })
```

### OrderCard (`components/admin/OrderCard.js`)
Add a small amber pill badge below the existing badges when `order.address_changed`:

```
📍 Address updated
```

Style: `background: #FFF3E0, color: #E65100` — visually distinct from the status badge.

### Order detail page (`pages/admin/orders/[id].js`)
Show the same badge inline next to the address field value. No action needed — purely informational.

---

## 3. Archive

### Behaviour
- **All normal views** (every filter tab except Archived) append `archived = false` to the Supabase query.
- **Archived tab** queries `archived = true`.
- **Search** (`?search=…`) works in both views — it respects whichever archived state is active.
- **Unarchive** is available from the Archived tab (bulk or individual).

### Orders list page (`pages/admin/orders/index.js`)

**Filter bar** — add "🗂 Archived" as the last tab. Selecting it sets `filter = 'archived'` which is treated specially (not a status filter — triggers `archived=true` query param).

**Bulk actions** — add "Archive" and "Unarchive" to the bulk status `<select>`. Handled as pseudo-statuses client-side; the API call uses a separate `archived` field rather than the `status` field.

**API call logic:**
```
filter === 'archived'  → params.set('archived', 'true')
filter !== 'archived'  → params.set('archived', 'false')   ← always added
```

### Order detail page (`pages/admin/orders/[id].js`)
Add an "Archive order" button in the actions row. When already archived, show "Unarchive" instead. Calls existing `patch({ archived: true/false })`.

### API — `GET /api/admin/orders`
Accept `archived` param (`'true'` / `'false'`). Default to `'false'` when absent so existing callers (e.g. WA confirmations tab) are unaffected.

```js
const archived = req.query.archived === 'true';
query = query.eq('archived', archived);
```

### API — `POST /api/admin/orders/bulk`
Accept `action: 'archive' | 'unarchive'` alongside the existing `status` action:

```js
if (body.action === 'archive')   → update({ archived: true })
if (body.action === 'unarchive') → update({ archived: false })
else                             → update({ status: body.status })  // existing behaviour
```

---

## 4. Date Filter

### UI
A single-select dropdown rendered as a pill button (same style as the method/status filter pills), placed on the right side of the search bar row. Default selection: **"All time"**.

Options and their `date_from` / `date_to` derivations (computed client-side in IST):

| Label        | date_from          | date_to   |
|--------------|--------------------|-----------|
| All time     | —                  | —         |
| Today        | today 00:00 IST    | today     |
| Yesterday    | yesterday 00:00    | yesterday |
| Last 7 days  | today − 6 days     | today     |
| Last 15 days | today − 14 days    | today     |
| Last 30 days | today − 29 days    | today     |
| This month   | 1st of this month  | today     |
| Last month   | 1st of last month  | last day of last month |

### API — `GET /api/admin/orders`
Accept `date_from` and `date_to` as `YYYY-MM-DD` strings. Filter on `created_at`:

```js
if (date_from) query = query.gte('created_at', date_from + 'T00:00:00+05:30');
if (date_to)   query = query.lte('created_at', date_to   + 'T23:59:59+05:30');
```

---

## 5. Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/011_address_changed_archive.sql` | New migration |
| `pages/api/whatsapp-webhook.js` | Set `address_changed = true` on address update |
| `pages/api/admin/orders/index.js` | Add `archived`, `date_from`, `date_to` params |
| `pages/api/admin/orders/bulk.js` | Add `archive` / `unarchive` actions |
| `components/admin/OrderCard.js` | Show address-changed badge |
| `pages/admin/orders/index.js` | Archived tab, date filter dropdown, bulk archive |
| `pages/admin/orders/[id].js` | Address-changed badge, Archive/Unarchive button |

---

## 6. Out of Scope

- No email/WA notification when an order is archived.
- No "auto-archive" of old orders.
- Archived orders are not excluded from CSV export (exporting the current view includes whatever is visible, so exporting from Archived tab exports archived orders).
