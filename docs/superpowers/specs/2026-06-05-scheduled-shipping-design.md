# Scheduled Shipping — Design Spec
**Date:** 2026-06-05  
**Status:** Approved

---

## Overview

Allow customers to schedule their shipment to a later date (up to 14 days ahead) during checkout. The delivery estimate updates dynamically based on the chosen date. Sundays and major Indian national holidays are disabled in the date picker. The scheduled date is stored on the order, surfaced in admin, and referenced in customer-facing WhatsApp and email confirmations.

---

## UI & Checkout Flow (`pages/index.js`)

The feature is opt-in — the default checkout flow is unchanged.

1. **Toggle link** — shown below the delivery estimate banner when the pincode is serviceable:  
   `"🗓 Schedule delivery for a later date →"`  
   Clicking expands the date picker inline.

2. **Date picker** — uses `react-day-picker` (not native `<input type="date">`) so specific days can be visually disabled:
   - Selectable range: tomorrow (IST) through today + 14 calendar days
   - Disabled days: all Sundays + a static list of major Indian national holidays
   - On valid selection: calls `/api/delivery-estimate?pincode=X&fromDate=YYYY-MM-DD` and updates the delivery estimate banner

3. **Updated estimate banner** when a date is scheduled:
   - `📦 Ships: Mon, 16 Jun (scheduled)`
   - `🚚 Expected delivery: by Wed, 18 Jun`

4. **Cancel link** — `"× Ship as soon as possible"` collapses the picker and reverts ETA to default

5. **Form submit** — `scheduledShipDate` (`YYYY-MM-DD` | `null`) added to the submit payload for both COD and prepaid flows

### National Holidays (static list, current year + next)
Republic Day (26 Jan), Holi (varies), Good Friday (varies), Ambedkar Jayanti (14 Apr), Ram Navami (varies), Eid ul-Fitr (varies), Independence Day (15 Aug), Janmashtami (varies), Gandhi Jayanti (2 Oct), Dussehra (varies), Diwali (varies), Guru Nanak Jayanti (varies), Christmas (25 Dec).  
Exact dates for variable holidays hard-coded per year. List lives in `lib/holidays.js`.

---

## Backend Changes

### `/api/delivery-estimate`
- New optional query param: `fromDate` (`YYYY-MM-DD`)
- When present: compute ETA using `fromDate` as the base instead of `new Date()`
- Server validation: `fromDate` must be a valid date, not in the past, not more than 14 days ahead
- Existing behaviour unchanged when `fromDate` is absent

### `/api/submit-cod` and `/api/verify-payment`
- Accept `scheduledShipDate` (`YYYY-MM-DD | null`) in request body
- Server re-validates: not a Sunday, not a holiday, within 14-day window
- Passes through to Supabase insert

### WhatsApp (`lib/whatsapp.js` — `waOrderConfirmed`)
- New optional param: `scheduledShipDate`
- When present: message says `"We'll ship your order on Mon, 16 Jun"` instead of `"within 1–2 business days"`

### Email (`/api/submit-cod`, `/api/verify-payment`)
- Owner notification: add **Scheduled Ship Date** row to order details table when present
- Customer confirmation: same — add **Scheduled Ship Date** row

---

## Database

```sql
ALTER TABLE orders ADD COLUMN scheduled_ship_date date;
```

New migration file: `supabase/migrations/009_scheduled_ship_date.sql`

---

## Admin UI

### Orders List (`pages/admin/orders/index.js`)
- Orders with `scheduled_ship_date` show a **Scheduled** badge (indigo/purple) alongside their current status
- Small secondary line under the order row: `🗓 Ships: Mon, 16 Jun`

### Order Detail (`pages/admin/orders/[id].js`)
- **Scheduled Ship Date** field in the order info section
- **Scheduled** badge in the status timeline

### `components/admin/StatusBadge.js`
- Add `scheduled` variant (indigo color)

---

## Data Flow

```
Customer selects date
  → onChange: validate (not Sunday/holiday)
  → fetch /api/delivery-estimate?pincode=X&fromDate=YYYY-MM-DD
  → update delivery estimate banner

Customer submits order
  → scheduledShipDate in POST body
  → server validates date
  → saved to orders.scheduled_ship_date
  → waOrderConfirmed called with scheduledShipDate
  → email confirmation includes scheduled date row
```

---

## Out of Scope
- Auto-dispatch triggering on the scheduled date (no cron automation)
- Customer ability to modify the scheduled date post-order
- Admin ability to change the scheduled date from the UI
