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
  id           bigserial primary key,
  order_id     text not null unique,      -- VED-10001
  method       text not null,             -- 'cod' | 'prepaid'
  status       text not null default 'pending',
    -- pending | confirmed | dispatched | delivered | cancelled | auto_confirmed
  name         text not null,
  mobile       text not null,
  email        text,
  address      text not null,
  city         text not null,
  state        text not null,
  pincode      text not null,
  pack         text not null,
  qty          int  not null default 1,
  price        int  not null,
  utm          jsonb,
  referrer_id  text,
  awb          text,
  courier      text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists orders_mobile_idx    on orders(mobile);
create index if not exists orders_status_idx    on orders(status);
create index if not exists orders_method_idx    on orders(method);
create index if not exists orders_created_idx   on orders(created_at desc);
```

**Written by:** `submit-cod.js` (method='cod') and `verify-payment.js` (method='prepaid') immediately on successful order placement.

**Updated by:** `whatsapp-webhook.js` (COD verify/cancel), `cod-auto-confirm.js` cron, and future dispatch/delivery webhook from Velocity/NimbusPost.

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

Filter bar (chips): All · COD · Prepaid · Pending · Confirmed · Dispatched · Cancelled  
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
- Mark as Dispatched (prompts for AWB number)
- Mark as Delivered
- Cancel Order (confirmation dialog)
- Resend verification (if pending)

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
- **Estimated RTO risk** — count of COD orders dispatched without customer confirmation

---

## File Structure

```
pages/
  admin/
    index.js          Dashboard
    orders/
      index.js        Orders list
      [id].js         Order detail
    customers/
      index.js        Customer list
      [phone].js      Customer profile
    whatsapp.js       WA inbox + verifications
    analytics.js      Analytics
    login.js          Login page
  api/
    admin/
      auth.js         Cookie check helper (shared by all admin API routes)
      orders.js       GET list + pagination
      orders/
        [id].js       GET detail, PATCH status
      customers.js    GET list
      customers/
        [phone].js    GET profile
      analytics.js    GET stats

components/
  admin/
    Layout.js         Shell with sidebar/bottom-nav, auth check
    OrderCard.js      Reusable order card (list + detail)
    StatusBadge.js    Colour-coded status pill
    VerifyTimeline.js COD verification event timeline

supabase/
  migrations/
    004_orders.sql    orders table
```

---

## Middleware Update (`middleware.js`)

Add `/admin` to protected routes (same pattern as existing `/insights` protection):

```js
// Existing: protects /insights/*
// Add: protects /admin/* (except /admin/login)
if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
  const token = req.cookies.get('admin_token')?.value;
  if (!token || !verifyAdminToken(token)) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
}
```

`verifyAdminToken` uses `ADMIN_PASSWORD` (same HMAC approach as existing insights auth).

---

## Non-Goals

- Role-based access control (one admin user is sufficient)
- Product/inventory management
- Blog post editing via admin (Next.js content files work fine as-is)
- Push notification configuration UI
- Real-time websocket updates (polling is sufficient for this volume)
