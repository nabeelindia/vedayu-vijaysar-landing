# NimbusPost Tracking Sync — Design Spec

**Date:** 2026-06-10  
**Status:** Approved

## Overview

Integrate NimbusPost tracking API so that:
1. Every order with an AWB shows live tracking status and full event history
2. A background cron syncs all active shipments every 2 hours automatically
3. Order status in Supabase auto-updates when NimbusPost reports delivered/RTO

This is Subsystem 1 of 3 (Admin dashboard view and WhatsApp bot are Subsystems 2 & 3).

## API

**Base URL:** `https://ship.nimbuspost.com/api`

**Auth:** `POST /users/login` → `{ email, password }` → returns JWT in `data` field.  
Token cached in Vercel KV as `nimbus:token` (TTL 23h).

**Track:** `GET /shipmentcargo/track/{awb}` → returns `data.status`, `data.rto_status`, `data.edd`, `data.history[]` (each: `status_code`, `location`, `event_time`, `message`).

## Components

### `lib/nimbuspost.js`
- `getToken()` — check KV for cached token; if missing/expired call login endpoint; cache result 23h; return token string
- `trackShipment(awb)` — GET track endpoint with bearer token; return full data object; throw on API error

### `supabase/migrations/012_shipments_tracking.sql`
Add columns to existing `shipments` table:
- `history jsonb` — full events array from NimbusPost
- `edd text` — estimated delivery date
- `rto_status text` — RTO sub-status from NimbusPost
- `rto_awb text` — RTO AWB if assigned
- `last_synced_at timestamptz` — when this row was last fetched from API

### `pages/api/cron/sync-tracking.js`
- Auth: `Authorization: Bearer ${CRON_SECRET}` header check
- Fetch orders: `SELECT order_id, awb, courier FROM orders WHERE status='sent' AND awb IS NOT NULL LIMIT 50`
- For each AWB: call `trackShipment(awb)`, upsert `shipments` row, update `orders` if terminal status
- Terminal status mapping:
  - NimbusPost status contains `delivered` → `orders.status = 'delivered'`, set `delivered_at`
  - NimbusPost status contains `rto` → `orders.status = 'returned'`, set `returned_at`
- Cron schedule: `"0 */2 * * *"` (every 2 hours)
- Max duration: 60s (Vercel pro) or batched to stay under 10s (hobby)

### `pages/api/admin/tracking/[awb].js`
- GET — fetch latest from NimbusPost for given AWB, upsert shipments, return full tracking data
- Used for manual "Refresh Tracking" button on order detail page
- Auth: admin session cookie (same as other admin routes)

### Order Detail Page (`pages/admin/orders/[id].js`)
- If order has `awb`, show "Tracking" section below order details
- Fetches from `shipments` table via existing order API
- Displays: current status badge, EDD, full history timeline
- "Refresh" button calls `/api/admin/tracking/[awb]` and re-renders

## Database Changes

```sql
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS history jsonb,
  ADD COLUMN IF NOT EXISTS edd text,
  ADD COLUMN IF NOT EXISTS rto_status text,
  ADD COLUMN IF NOT EXISTS rto_awb text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
```

## Env Vars (add to Vercel)

- `NIMBUSPOST_EMAIL` — NimbusPost login email
- `NIMBUSPOST_PASSWORD` — NimbusPost login password

## Error Handling

- Token fetch failure → log error, return 500, cron skips batch gracefully
- Individual AWB tracking failure → log + skip that AWB, continue rest of batch
- NimbusPost 401 → clear KV token, retry once with fresh token

## Sequence

1. Migration → 2. `lib/nimbuspost.js` → 3. Cron route → 4. Admin tracking route → 5. Order detail UI → 6. vercel.json cron entry
