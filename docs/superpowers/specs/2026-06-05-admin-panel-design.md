# Admin Backend Panel

**Date:** 2026-06-05  
**Status:** Approved  
**Build order:** 3 of 3  
**Depends on:** Simplified order numbers (lib/orders.js), COD verification improvements (orders table + cod_verifications table)

---

## Overview

A full-featured, mobile-first admin panel living at `/admin` within the existing Next.js app. Protected by a separate `ADMIN_PASSWORD` env var. Absorbs the existing `/insights` page functionality and adds orders, customers, and full COD verification management.

The existing `/insights` page remains unchanged — the admin panel is a superset available via a new route.

---

## Auth

Same pattern as `/insights/login.js` and `/api/insights-auth.js`, but using a different env var:
- `ADMIN_PASSWORD` — separate from `INSIGHTS_PASSWORD`
- Cookie: `admin_token` (separate from `insights_token`)
- Middleware in `middleware.js` extended to protect `/admin/*` (except `/admin/login`)

Login page: `/admin/login` — same design as `/insights/login` (password field, submit, warm brown palette).

---

## Routes

```
/admin                    Dashboard
/admin/orders             Orders list (COD + prepaid)
/admin/orders/[id]        Order detail + COD verification timeline
/admin/customers          Customer directory
/admin/customers/[phone]  Customer profile + order history + WA thread
/admin/whatsapp           WA inbox + COD verification sessions
/admin/analytics          Revenue, UTM, conversion (absorbed from /insights)
/admin/login              Auth page
```

---

## Supabase Schema

### New table: `orders`

Created in `supabase/migrations/004_orders.sql`:

```sql
create table if not exists orders (
  id                  bigserial primary key,
  order_id            text not null unique,   -- VED-C25060501, VED-P25060502
  method              text not null,           -- 'cod' | 'prepaid'
  status              text not null default 'pending',
    -- pending | confirmed | auto_confirmed | sent | delivered | cancelled | returned
  name                text not null,
  mobile              text not null,
  email               text,
  address             text not null,
  city                text not null,
  state               text not null,
  pincode             text not null,
  pack                text not null,
  qty                 int  not null default 1,
  price               int  not null,
  utm                 jsonb,
  referrer_id         text,
  -- NimbusPost fields (populated when order is sent to NimbusPost)
  awb                 text,                   -- assigned AWB number
  courier             text,                   -- courier name
  nimbuspost_order_id text,                   -- NimbusPost internal order ID
  label_url           text,                   -- shipping label PDF URL
  -- Tracking lifecycle timestamps
  sent_at             timestamptz,            -- when marked as sent / AWB assigned
  delivered_at        timestamptz,
  returned_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists orders_mobile_idx   on orders(mobile);
create index if not exists orders_status_idx   on orders(status);
create index if not exists orders_method_idx   on orders(method);
create index if not exists orders_created_idx  on orders(created_at desc);
create index if not exists orders_awb_idx      on orders(awb);
```

**Written by:** `submit-cod.js` (method='cod') and `verify-payment.js` (method='prepaid') immediately on successful order placement.

**Updated by:**
- `whatsapp-webhook.js` — COD confirm/cancel button taps
- `cod-auto-confirm.js` cron — 24h auto-confirm
- `nimbuspost/webhook.js` — shipment status events (currently updates KV only; will also update this table)
- Admin panel PATCH `/api/admin/orders/[id]` — manual status updates (AWB entry, mark delivered, etc.)

---

## API Endpoints (new)

All under `/api/admin/` — each checks `admin_token` cookie before responding.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/orders` | GET | Paginated order list. Query params: `method`, `status`, `search`, `page` |
| `/api/admin/orders/[id]` | GET | Single order with COD verification record joined |
| `/api/admin/orders/[id]` | PATCH | Manual status update (e.g. mark dispatched, cancelled) |
| `/api/admin/customers` | GET | Paginated customer list, aggregated from `orders`. Query: `search`, `page` |
| `/api/admin/customers/[phone]` | GET | Customer profile: all orders + wa_messages + wa_outbound thread |
| `/api/admin/analytics` | GET | Revenue stats (wraps existing `/api/ga-insights` + `/api/clarity-insights` + Supabase queries) |

All list endpoints return: `{ data: [...], total, page, pageSize }`.

---

## UI Layout

### Mobile (< 768px)

```
┌───────────────────────────┐
│ 🌿 Vedayu Admin      [≡] │  ← top bar with page title, no hamburger needed
├───────────────────────────┤
│                           │
│     [page content]        │
│                           │
│                           │
├───────────────────────────┤
│  📦    👥    💬    📊     │  ← fixed bottom nav
│ Orders Custs  WA  Stats  │
└───────────────────────────┘
```

### Desktop (≥ 768px)

```
┌──────────┬────────────────────────────┐
│ 🌿 Admin │                            │
│          │   [page content]           │
│ 📦 Orders│                            │
│ 👥 Custs │                            │
│ 💬 WA    │                            │
│ 📊 Stats │                            │
└──────────┴────────────────────────────┘
```

Left sidebar, fixed. Content scrolls independently.

### Palette

Same as the main site: `#5C3D1E` (primary brown), `#FFF8E1` (warm cream), `#4A7C59` (green for success), `#E53935` (red for cancel/error), `#1a1a1a` (text). Tailwind utility classes.

---

## Section: Dashboard (`/admin`)

Stat cards (2×2 grid on mobile, 4-wide on desktop):
- **Today's Revenue** — sum of confirmed + dispatched + delivered orders today
- **Pending Verifications** — count of COD orders awaiting customer confirmation (tappable → /admin/whatsapp tab 2)
- **Orders Today** — total orders placed today (COD + prepaid)
- **Unread WA Messages** — count of messages with `read_at IS NULL`

Recent orders list (last 10, condensed): order ID, name, pack, price, status badge, time ago.

Quick actions:
- "View pending verifications" → /admin/whatsapp?tab=verifications
- "Open WA inbox" → /admin/whatsapp

---

## Section: Orders (`/admin/orders`)

### List view

Filter bar (chips): All · COD · Prepaid · Pending · Confirmed · Sent · Delivered · Cancelled  
Search bar: by order ID, name, mobile, pincode

Mobile: card per order  
Desktop: table rows

Each order shows:
- Order ID (bold, monospace)
- Customer name + city
- Pack + qty
- Price (₹)
- Method badge (COD / Prepaid)
- Status badge (colour-coded)
- COD verification badge (for COD orders): ✅ Confirmed / ❌ Cancelled / ⏳ Pending / 🤖 Auto
- Created at (relative time)

Tap → order detail page.

### Order detail (`/admin/orders/[id]`)

Full order info card (all fields).

**COD Verification Timeline** (for COD orders only):
```
● Order placed          2026-06-05 14:32
● Verification sent     2026-06-05 14:32
○ Nudge sent            2026-06-05 20:35
● Customer confirmed    2026-06-05 20:41
```

Manual actions (buttons):
- **Order Sent** — prompts for tracking number (AWB), updates status to `sent`, stores AWB in orders table
- **Order Delivered** — marks delivered, records `delivered_at`
- **Cancel Order** — confirmation dialog
- **Resend confirmation message** — (if status is pending, resends the WA verification)

---

## Section: Customers (`/admin/customers`)

Aggregated from `orders` table (group by mobile).

List: name, mobile, city, order count, total spend, last order date.  
Search: by name, mobile, pincode, city.

### Customer profile (`/admin/customers/[phone]`)

Header card: name, mobile, email, city/state, first order date, total orders, total spend.

**Orders tab** — all orders for this customer (same cards as orders list).

**WhatsApp tab** — merged thread of `wa_messages` (inbound) + `wa_outbound` (outbound) + COD verification events, sorted by time. Read-only view. For replies, link to /admin/whatsapp.

---

## Section: WhatsApp (`/admin/whatsapp`)

Two tabs:

**Tab 1 — Inbox** (absorbs existing /insights WA inbox)
- Conversation list on left, message thread on right (or full-screen on mobile)
- Reply box at bottom
- Calls existing `/api/wa-reply` to send messages
- Polls `/api/wa-inbox` every 10s (already implemented)

**Tab 2 — COD Verifications**
- Table of all `cod_verifications` records
- Columns: order ID, customer name, mobile, status badge, created at, verified/cancelled at, nudged
- Filter: All · Pending · Confirmed · Cancelled · Auto-confirmed
- Tap row → opens order detail in a slide-over

---

## Section: Analytics (`/admin/analytics`)

Absorbs all existing `/insights` chart functionality:
- Revenue by day (bar chart)
- UTM source breakdown
- Conversion rate
- GA insights card
- Clarity insights card

Adds new panels:
- **COD vs Prepaid split** — pie or bar, this week
- **Verification rate** — % of COD orders confirmed by customer (vs auto-confirmed vs cancelled)
- **Estimated RTO risk** — count of COD orders sent without customer confirmation

---

## Scalability Architecture

The admin is designed so it can grow without requiring a rewrite. Three principles:

### 1. API-first: frontend is a thin client

Every piece of data the admin UI shows comes from a `/api/admin/*` endpoint — never from direct Supabase calls in page components. This means:
- The frontend can be replaced (e.g. extract to a separate React app, a mobile app, or a Retool dashboard) without changing the backend
- API endpoints can be versioned (`/api/admin/v2/...`) when breaking changes are needed
- New sections (e.g. returns, blog, products) are added by adding new API routes, not touching existing ones

### 2. Shared auth middleware — not per-page checks

Auth is enforced at the edge (`middleware.js`), not in each page. Adding a new page under `/admin/` is automatically protected — no auth code to copy or forget.

Future upgrade path: swap the single `ADMIN_PASSWORD` for Supabase Auth (email+password) by changing only `middleware.js` and `/admin/login.js`. No page or API route changes needed.

### 3. Component library in `components/admin/`

All UI elements (cards, badges, tables, timelines, bottom nav) live in `components/admin/`. Pages assemble components; they don't define UI inline. This means:
- Consistent look across all sections
- New sections reuse existing components
- If the panel is later extracted to a separate app, the component folder moves with it cleanly

### Future scaling path (when needed)

| Trigger | Action |
|---------|--------|
| Need team logins | Swap ADMIN_PASSWORD for Supabase Auth in middleware + login only |
| Need role-based access | Add `role` field to Supabase users table; check in middleware |
| Admin panel becomes too large | Extract `pages/admin/` + `components/admin/` + `pages/api/admin/` into a separate Vercel project pointing to the same Supabase |
| Need real-time updates | Add Supabase Realtime subscription in Layout.js — no page changes needed |

---

## File Structure

```
pages/
  admin/
    index.js            Dashboard
    orders/
      index.js          Orders list
      [id].js           Order detail
    customers/
      index.js          Customer list
      [phone].js        Customer profile
    whatsapp.js         WA inbox + COD verifications
    analytics.js        Analytics
    login.js            Login page

  api/
    admin/
      _auth.js          Shared auth guard (called at top of every admin API route)
      orders/
        index.js        GET list (paginated, filterable)
        [id].js         GET detail · PATCH status
      customers/
        index.js        GET list (paginated, searchable)
        [phone].js      GET profile + order history + WA thread
      analytics.js      GET revenue/verification/RTO stats

components/
  admin/
    Layout.js           Shell: sidebar (desktop) + bottom nav (mobile) + auth check
    OrderCard.js        Order summary card — used in list and customer profile
    StatusBadge.js      Colour-coded pill: pending / confirmed / sent / delivered / cancelled
    VerifyTimeline.js   COD verification event timeline
    StatCard.js         Dashboard metric card
    PageHeader.js       Page title + optional action button

supabase/
  migrations/
    004_orders.sql      orders table (both COD and prepaid)
```

**`_auth.js` pattern** — every admin API route starts with:
```js
import { checkAdminAuth } from './_auth';
export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  // ... route logic
}
```

This keeps auth logic in one place and makes future upgrades (e.g. JWT, Supabase Auth) a single-file change.

---

## Language / Copy Conventions

All admin UI copy follows plain Indian English — no jargon:

| Technical term | Admin panel shows |
|----------------|-------------------|
| dispatch / dispatched | Send order / Order sent |
| pending (pre-confirm) | Waiting for customer reply |
| confirmed / auto_confirmed | Confirmed |
| sent | Order sent |
| delivered | Delivered |
| cancelled | Cancelled |
| returned (RTO) | Returned |
| COD verification | WhatsApp Confirmation |
| AWB | Tracking number |

---

## Middleware Update (`middleware.js`)

```js
// Existing: protects /insights/*
// New addition: protects /admin/* (except /admin/login)
if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
  const token = req.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
}
```

`verifyAdminToken` uses `ADMIN_PASSWORD` (same HMAC approach as existing insights auth, different secret).

---

## NimbusPost Integration Readiness

NimbusPost is already partially integrated (`lib/nimbuspost.js`, `/api/nimbuspost/webhook.js`). This admin panel is designed so the full integration can be wired in later without schema changes.

### What exists today

| Component | State |
|-----------|-------|
| `lib/nimbuspost.js` — `createOrder()`, `createShipment()`, `getTracking()` | ✅ Built |
| `/api/nimbuspost/webhook.js` — receives shipment status updates | ✅ Built (updates KV only) |
| `storeAwbMapping()` — saves orderId ↔ AWB in KV | ✅ Built |

### What this spec adds (NimbusPost-ready)

- `orders` table has `awb`, `courier`, `nimbuspost_order_id`, `label_url`, `sent_at`, `delivered_at`, `returned_at` columns — pre-wired for NimbusPost data
- NimbusPost webhook will be updated to also write `orders.status`, `orders.awb`, `orders.delivered_at`, etc. to Supabase (so admin panel shows live tracking status)

### Future NimbusPost wiring (not in this spec)

When you're ready to integrate fully:
1. `submit-cod.js` and `verify-payment.js` call `nimbuspost.createOrder()` after placing the order — it appears in NimbusPost dashboard for processing
2. Admin panel "Send Order" button calls `nimbuspost.createShipment()` with selected courier, stores AWB in `orders` table
3. NimbusPost webhook updates `orders.status` in Supabase as the shipment moves through delivery stages

The `orders` table schema and the webhook handler are already built to accept this data — no schema migration needed when you integrate.

---

## Non-Goals

- Role-based access control (single admin user for now — upgrade path documented above)
- Product/inventory management
- Blog post editing via admin
- Push notification configuration UI
- Real-time websocket updates (polling is sufficient at current order volume)
