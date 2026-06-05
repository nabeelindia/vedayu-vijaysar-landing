# Scheduled Shipping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers schedule their shipment to a later date (up to 14 days ahead) at checkout, with delivery estimates updating accordingly, and admins able to view and edit the scheduled date.

**Architecture:** A static holiday list + Sunday-blocking drives a `react-day-picker` in the checkout form. The existing `/api/delivery-estimate` gains a `fromDate` param. Both order-submit APIs store `scheduled_ship_date`. Admin orders list and order detail expose the field, with inline editing via the existing PATCH endpoint.

**Tech Stack:** Next.js (Pages Router), React, Supabase, `react-day-picker` v9, `lib/whatsapp.js`, Resend email

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `lib/holidays.js` | **Create** | Static list of blocked dates (Sundays computed dynamically, holidays hardcoded) |
| `pages/api/delivery-estimate.js` | **Modify** | Accept optional `fromDate` query param |
| `package.json` | **Modify** | Add `react-day-picker` |
| `pages/index.js` | **Modify** | Schedule toggle + DayPicker + updated ETA display |
| `pages/api/submit-cod.js` | **Modify** | Accept + validate + save `scheduledShipDate` |
| `pages/api/verify-payment.js` | **Modify** | Accept + validate + save `scheduledShipDate` |
| `supabase/migrations/009_scheduled_ship_date.sql` | **Create** | `ALTER TABLE orders ADD COLUMN scheduled_ship_date date` |
| `lib/whatsapp.js` | **Modify** | `waOrderConfirmed` accepts `scheduledShipDate`, changes message |
| `components/admin/StatusBadge.js` | **Modify** | Add `scheduled` variant |
| `components/admin/OrderCard.js` | **Modify** | Show scheduled badge + date line |
| `pages/admin/orders/index.js` | **Modify** | Pass `scheduled_ship_date` through to OrderCard |
| `pages/admin/orders/[id].js` | **Modify** | Show + inline-edit scheduled ship date |
| `pages/api/admin/orders/[id].js` | **Modify** | Allow `scheduled_ship_date` in PATCH `allowed` list |

---

## Task 1: Create `lib/holidays.js`

**Files:**
- Create: `lib/holidays.js`

- [ ] **Step 1: Create the file**

```js
// lib/holidays.js
// Returns Set of 'YYYY-MM-DD' strings that are non-shipping days.
// Includes Indian national holidays for 2025–2026 + Sundays are handled separately.

const HOLIDAYS = new Set([
  // 2025
  '2025-01-26', // Republic Day
  '2025-03-14', // Holi
  '2025-03-31', // Id-ul-Fitr (Eid)
  '2025-04-14', // Ambedkar Jayanti / Dr. B.R. Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-08-15', // Independence Day
  '2025-08-16', // Janmashtami
  '2025-10-02', // Gandhi Jayanti
  '2025-10-02', // Dussehra (same day 2025)
  '2025-10-20', // Diwali (Lakshmi Puja)
  '2025-11-05', // Guru Nanak Jayanti
  '2025-12-25', // Christmas
  // 2026
  '2026-01-26', // Republic Day
  '2026-03-03', // Holi
  '2026-03-20', // Id-ul-Fitr (Eid)
  '2026-04-03', // Good Friday
  '2026-04-14', // Ambedkar Jayanti
  '2026-08-15', // Independence Day
  '2026-08-04', // Janmashtami
  '2026-10-02', // Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-08', // Diwali (Lakshmi Puja)
  '2026-11-24', // Guru Nanak Jayanti
  '2026-12-25', // Christmas
]);

/**
 * Returns true if the given Date is a non-shipping day:
 * Sunday (getDay() === 0) or a national holiday.
 */
export function isBlockedDay(date) {
  if (date.getDay() === 0) return true; // Sunday
  const iso = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  return HOLIDAYS.has(iso);
}

/**
 * Returns the Set of holiday date strings (for react-day-picker's `disabled` prop).
 */
export function getHolidayDates() {
  return [...HOLIDAYS].map(iso => new Date(iso));
}

export default HOLIDAYS;
```

- [ ] **Step 2: Commit**

```bash
git add lib/holidays.js
git commit -m "feat: add holidays utility for shipping day blocking"
```

---

## Task 2: Extend `/api/delivery-estimate` with `fromDate`

**Files:**
- Modify: `pages/api/delivery-estimate.js`

- [ ] **Step 1: Add `fromDate` support**

In `pages/api/delivery-estimate.js`, replace the handler export with:

```js
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { pincode, cod = '1', fromDate } = req.query;

  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.status(400).json({ serviceable: false, reason: 'invalid_pincode' });
  }

  const dbEntry = db[pincode];
  if (!dbEntry) {
    return res.status(200).json({ serviceable: false, reason: 'pincode_not_covered' });
  }

  const [, , codSupported, zone] = dbEntry;
  const isCod = cod !== '0';

  if (isCod && !codSupported) {
    return res.status(200).json({
      serviceable: true,
      codAvailable: false,
      zone,
      reason: 'cod_not_available',
    });
  }

  // Determine base date: fromDate param or now
  let baseDate = new Date();
  if (fromDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return res.status(400).json({ serviceable: false, reason: 'invalid_fromDate' });
    }
    const parsed = new Date(fromDate + 'T00:00:00+05:30');
    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + 14);
    if (isNaN(parsed.getTime()) || parsed < now.setHours(0,0,0,0) || parsed > maxDate) {
      return res.status(400).json({ serviceable: false, reason: 'invalid_fromDate' });
    }
    baseDate = parsed;
  }

  // Compute ETA from zone
  const [, maxDays] = ZONE_DAYS[zone] || DEFAULT_DAYS;
  const etaDate = addBusinessDays(baseDate, maxDays);

  const eta = toISODate(etaDate);
  const etaFormatted = toReadable(etaDate);

  res.setHeader('Cache-Control', fromDate
    ? 'no-store'
    : 'public, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).json({ serviceable: true, zone, eta, etaFormatted });
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/delivery-estimate.js
git commit -m "feat: delivery-estimate accepts fromDate param"
```

---

## Task 3: Install `react-day-picker`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install react-day-picker
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('react-day-picker'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-day-picker"
```

---

## Task 4: Checkout UI — schedule toggle + date picker

**Files:**
- Modify: `pages/index.js`

This task adds the scheduling UI to the checkout form. The feature is opt-in — a toggle link below the existing delivery estimate banner.

- [ ] **Step 1: Add imports at top of `pages/index.js`**

After the existing imports at the top of the file, add:

```js
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { isBlockedDay, getHolidayDates } from '../lib/holidays';
```

- [ ] **Step 2: Add state variables**

In the component body, alongside the existing `deliveryEst` / `shipsBy` state declarations (around line 183), add:

```js
const [scheduleOpen,    setScheduleOpen]    = useState(false);
const [scheduledDate,   setScheduledDate]   = useState(null); // Date object | null
```

- [ ] **Step 3: Add `handleScheduledDate` callback**

After the existing pincode/delivery-estimate `useEffect` (around line 420), add:

```js
const handleScheduledDate = async (date) => {
  if (!date) {
    setScheduledDate(null);
    // Revert to default ETA
    if (form.pincode?.length === 6) {
      const est = await fetch(`/api/delivery-estimate?pincode=${form.pincode}&cod=1`).then(r => r.json());
      if (est?.serviceable && est?.etaFormatted) setDeliveryEst(`by ${est.etaFormatted}`);
    }
    return;
  }
  setScheduledDate(date);
  const fromDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const est = await fetch(`/api/delivery-estimate?pincode=${form.pincode}&cod=1&fromDate=${fromDate}`).then(r => r.json());
  if (est?.serviceable && est?.etaFormatted) setDeliveryEst(`by ${est.etaFormatted}`);
};
```

- [ ] **Step 4: Add `scheduledDateFormatted` helper**

Just below `handleScheduledDate`, add:

```js
const scheduledDateFormatted = scheduledDate
  ? scheduledDate.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata' })
  : null;
```

- [ ] **Step 5: Replace the delivery estimate banner JSX**

Find the existing delivery estimate banner block (around line 1734):

```jsx
{(deliveryEst || shipsBy) && (
  <div style={{ background:'#F0F9F3', border:'1px solid #4A7C59', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:'.88rem', color:'#2d6b40' }}>
    {shipsBy && (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: deliveryEst ? 5 : 0 }}>
        📦 <span>Ships: <strong>{shipsBy.label}</strong>{shipsBy.note && <span style={{ fontWeight:400, color:'#4A7C59', marginLeft:6 }}>· {shipsBy.note}</span>}</span>
      </div>
    )}
    {deliveryEst && (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        🚚 <span>Expected delivery: <strong>{deliveryEst}</strong></span>
      </div>
    )}
  </div>
)}
```

Replace with:

```jsx
{(deliveryEst || shipsBy) && (
  <div style={{ background:'#F0F9F3', border:'1px solid #4A7C59', borderRadius:8, padding:'10px 14px', marginBottom:6, fontSize:'.88rem', color:'#2d6b40' }}>
    {shipsBy && (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: deliveryEst ? 5 : 0 }}>
        📦 <span>Ships: <strong>{scheduledDate ? scheduledDateFormatted + ' (scheduled)' : shipsBy.label}</strong>{!scheduledDate && shipsBy.note && <span style={{ fontWeight:400, color:'#4A7C59', marginLeft:6 }}>· {shipsBy.note}</span>}</span>
      </div>
    )}
    {deliveryEst && (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        🚚 <span>Expected delivery: <strong>{deliveryEst}</strong></span>
      </div>
    )}
  </div>
)}

{/* Schedule for later toggle */}
{(deliveryEst || shipsBy) && !scheduleOpen && (
  <button
    type="button"
    onClick={() => setScheduleOpen(true)}
    style={{ background:'none', border:'none', color:'#4A7C59', fontSize:'.82rem', fontWeight:600, cursor:'pointer', padding:'2px 0', marginBottom:10, textDecoration:'underline' }}
  >
    🗓 Schedule delivery for a later date →
  </button>
)}

{scheduleOpen && (() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const maxDate  = new Date(today); maxDate.setDate(maxDate.getDate() + 14);
  const holidayDates = getHolidayDates();
  return (
    <div style={{ background:'#fff', border:'1px solid #4A7C59', borderRadius:8, padding:'12px 14px', marginBottom:10 }}>
      <div style={{ fontSize:'.82rem', fontWeight:600, color:'#2d6b40', marginBottom:8 }}>Choose a ship date:</div>
      <DayPicker
        mode="single"
        selected={scheduledDate}
        onSelect={handleScheduledDate}
        fromDate={tomorrow}
        toDate={maxDate}
        disabled={[
          { dayOfWeek: [0] },
          ...holidayDates,
        ]}
        styles={{
          root: { fontSize: '.82rem' },
          caption: { color: '#2d6b40', fontWeight: 700 },
          day_selected: { backgroundColor: '#4A7C59', color: '#fff' },
        }}
      />
      <button
        type="button"
        onClick={() => { setScheduleOpen(false); handleScheduledDate(null); }}
        style={{ background:'none', border:'none', color:'#888', fontSize:'.78rem', cursor:'pointer', textDecoration:'underline', marginTop:4 }}
      >
        × Ship as soon as possible
      </button>
    </div>
  );
})()}
```

- [ ] **Step 6: Pass `scheduledShipDate` in the COD submit payload**

Find where the COD form is submitted (search for `submit-cod` in index.js). In the fetch body object for `/api/submit-cod`, add:

```js
scheduledShipDate: scheduledDate
  ? scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  : null,
```

- [ ] **Step 7: Pass `scheduledShipDate` in the Razorpay / prepaid payload**

Find where `/api/create-order` or the Razorpay handler is called with customer data, and add the same field:

```js
scheduledShipDate: scheduledDate
  ? scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  : null,
```

- [ ] **Step 8: Commit**

```bash
git add pages/index.js
git commit -m "feat: scheduled shipping toggle and date picker in checkout"
```

---

## Task 5: Supabase migration

**Files:**
- Create: `supabase/migrations/009_scheduled_ship_date.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/009_scheduled_ship_date.sql
alter table orders add column if not exists scheduled_ship_date date;
create index if not exists orders_scheduled_idx on orders(scheduled_ship_date)
  where scheduled_ship_date is not null;
```

- [ ] **Step 2: Run the migration against your Supabase project**

In the Supabase dashboard SQL editor (or via CLI if configured), run the contents of the file above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_scheduled_ship_date.sql
git commit -m "feat: add scheduled_ship_date column to orders"
```

---

## Task 6: Accept `scheduledShipDate` in `/api/submit-cod`

**Files:**
- Modify: `pages/api/submit-cod.js`

- [ ] **Step 1: Import `isBlockedDay` at top**

Add after existing imports:

```js
import { isBlockedDay } from '../../lib/holidays';
```

- [ ] **Step 2: Destructure `scheduledShipDate` from request body**

Find the existing destructure line:
```js
const { name, mobile, email, address, city, state, pincode, pack, price, qty, utm = {}, referrerId } = req.body;
```

Add `scheduledShipDate` to it:
```js
const { name, mobile, email, address, city, state, pincode, pack, price, qty, utm = {}, referrerId, scheduledShipDate } = req.body;
```

- [ ] **Step 3: Validate `scheduledShipDate` after the existing validation block**

After the existing validation checks (pincode, mobile, etc.), add:

```js
let safeScheduledDate = null;
if (scheduledShipDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledShipDate)) {
    return res.status(400).json({ error: 'Invalid scheduled ship date format' });
  }
  const d = new Date(scheduledShipDate + 'T00:00:00+05:30');
  const now = new Date(); now.setHours(0,0,0,0);
  const max = new Date(now); max.setDate(max.getDate() + 14);
  if (isNaN(d.getTime()) || d <= now || d > max || isBlockedDay(d)) {
    return res.status(400).json({ error: 'Invalid scheduled ship date' });
  }
  safeScheduledDate = scheduledShipDate;
}
```

- [ ] **Step 4: Add `scheduled_ship_date` to the Supabase `orders` insert**

Find the `supabase.from('orders').insert({` block and add:

```js
scheduled_ship_date: safeScheduledDate,
```

- [ ] **Step 5: Pass `safeScheduledDate` to `waOrderConfirmed`**

Find:
```js
await waOrderConfirmed({ mobile: mobile.trim(), name, pack, orderId, price: safePrice }).catch(() => {});
```

Replace with:
```js
await waOrderConfirmed({ mobile: mobile.trim(), name, pack, orderId, price: safePrice, scheduledShipDate: safeScheduledDate }).catch(() => {});
```

- [ ] **Step 6: Add `Scheduled Ship Date` row to owner notification email**

In the owner email HTML, find the `<tr>` for `Delivery` and add after it:

```js
${safeScheduledDate ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">🗓 Scheduled Ship Date</td><td style="padding:10px 0;font-weight:700;color:#5C3D1E;">${safeScheduledDate}</td></tr>` : ''}
```

- [ ] **Step 7: Add `Scheduled Ship Date` row to customer confirmation email**

In the customer email HTML, find the `<tr>` for `Order Date` and add after it:

```js
${safeScheduledDate ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">🗓 Scheduled Ship Date</td><td style="padding:9px 0;font-weight:700;color:#5C3D1E;">${safeScheduledDate}</td></tr>` : ''}
```

- [ ] **Step 8: Commit**

```bash
git add pages/api/submit-cod.js
git commit -m "feat: submit-cod accepts and stores scheduledShipDate"
```

---

## Task 7: Accept `scheduledShipDate` in `/api/verify-payment`

**Files:**
- Modify: `pages/api/verify-payment.js`

- [ ] **Step 1: Import `isBlockedDay`**

```js
import { isBlockedDay } from '../../lib/holidays';
```

- [ ] **Step 2: Destructure `scheduledShipDate` from request body**

Find the existing destructure and add `scheduledShipDate`:

```js
const {
  razorpay_order_id, razorpay_payment_id, razorpay_signature,
  amount, pack, qty,
  name, mobile, email, address, city, state, pincode,
  utm = {}, referrerId,
  scheduledShipDate,
} = req.body;
```

- [ ] **Step 3: Validate after signature check**

After the signature verification block, add:

```js
let safeScheduledDate = null;
if (scheduledShipDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledShipDate)) {
    return res.status(400).json({ error: 'Invalid scheduled ship date format' });
  }
  const d = new Date(scheduledShipDate + 'T00:00:00+05:30');
  const now = new Date(); now.setHours(0,0,0,0);
  const max = new Date(now); max.setDate(max.getDate() + 14);
  if (isNaN(d.getTime()) || d <= now || d > max || isBlockedDay(d)) {
    return res.status(400).json({ error: 'Invalid scheduled ship date' });
  }
  safeScheduledDate = scheduledShipDate;
}
```

- [ ] **Step 4: Add to Supabase orders insert**

Find `supabase.from('orders').insert({` and add:

```js
scheduled_ship_date: safeScheduledDate,
```

- [ ] **Step 5: Pass to `waOrderConfirmed`**

Find:
```js
await waOrderConfirmed({ mobile: mobile.trim(), name, pack, orderId, price: finalPrice }).catch(() => {});
```

Replace with:
```js
await waOrderConfirmed({ mobile: mobile.trim(), name, pack, orderId, price: finalPrice, scheduledShipDate: safeScheduledDate }).catch(() => {});
```

- [ ] **Step 6: Add scheduled date row to both emails** (same pattern as Task 6 Steps 6–7)

In the owner notification email HTML, after the `Delivery` row:
```js
${safeScheduledDate ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">🗓 Scheduled Ship Date</td><td style="padding:10px 0;font-weight:700;color:#5C3D1E;">${safeScheduledDate}</td></tr>` : ''}
```

In the customer confirmation email HTML, after the `Order Date` row:
```js
${safeScheduledDate ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">🗓 Scheduled Ship Date</td><td style="padding:9px 0;font-weight:700;color:#5C3D1E;">${safeScheduledDate}</td></tr>` : ''}
```

- [ ] **Step 7: Commit**

```bash
git add pages/api/verify-payment.js
git commit -m "feat: verify-payment accepts and stores scheduledShipDate"
```

---

## Task 8: Update `waOrderConfirmed` for scheduled date

**Files:**
- Modify: `lib/whatsapp.js`

The existing `vedayu_order_confirmed` WhatsApp template uses 4 body parameters: `{{1}}` name, `{{2}}` pack, `{{3}}` orderId, `{{4}}` price. When a scheduled date is present we send a plain text message instead of the template (since template variables can't be conditionally changed without a new template approval).

- [ ] **Step 1: Update `waOrderConfirmed`**

Find the existing `waOrderConfirmed` function and replace it:

```js
export async function waOrderConfirmed({ mobile, name, pack, orderId, price, scheduledShipDate }) {
  if (scheduledShipDate) {
    // Format date for display: '2026-06-16' → 'Tue, 16 Jun'
    const d = new Date(scheduledShipDate + 'T00:00:00+05:30');
    const formatted = d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata' });
    return sendMessage(mobile, {
      type: 'text',
      text: {
        body: `Hi ${name}! ✅ Your Vedayu order (${orderId}) for ${pack} has been placed.\n\n🗓 *Scheduled ship date: ${formatted}*\n\nWe'll dispatch it on that date. Amount to pay on delivery: ₹${price}.\n\nTrack your order: https://vedayulife.com/track?order=${orderId}`,
        preview_url: false,
      },
    });
  }
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_order_confirmed',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: pack },
          { type: 'text', text: orderId },
          { type: 'text', text: `₹${price}` },
        ],
      }],
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/whatsapp.js
git commit -m "feat: waOrderConfirmed includes scheduled ship date in message"
```

---

## Task 9: Admin — `scheduled` StatusBadge variant

**Files:**
- Modify: `components/admin/StatusBadge.js`

- [ ] **Step 1: Add `scheduled` to `STATUS_CONFIG`**

Find `STATUS_CONFIG` and add:

```js
scheduled: { label: 'Scheduled', bg: '#EDE7F6', color: '#4527A0' },
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/StatusBadge.js
git commit -m "feat: add scheduled variant to StatusBadge"
```

---

## Task 10: Admin — Orders list shows scheduled badge + date

**Files:**
- Modify: `components/admin/OrderCard.js`

- [ ] **Step 1: Update `OrderCard` to show scheduled info**

Replace the entire `OrderCard` component with:

```jsx
import StatusBadge from './StatusBadge';

const fmt = n => `₹${Number(n).toLocaleString('en-IN')}`;
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtShortDate = (iso) => {
  const d = new Date(iso + 'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata' });
};

export default function OrderCard({ order, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      borderLeft: `4px solid ${order.method === 'cod' ? '#C9A84C' : '#4A7C59'}`,
    }}>
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.88rem', color: '#5C3D1E' }}>
          {order.order_id}
        </div>
        <div style={{ fontSize: '.82rem', color: '#333', marginTop: 2 }}>
          {order.name} · {order.city}
        </div>
        <div style={{ fontSize: '.75rem', color: '#888', marginTop: 2 }}>
          {order.pack} · {fmt(order.price)} · {timeAgo(order.created_at)}
        </div>
        {order.scheduled_ship_date && (
          <div style={{ fontSize: '.72rem', color: '#4527A0', marginTop: 3, fontWeight: 600 }}>
            🗓 Ships: {fmtShortDate(order.scheduled_ship_date)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <StatusBadge status={order.status} small />
        {order.scheduled_ship_date && <StatusBadge status="scheduled" small />}
        <span style={{ fontSize: '.65rem', fontWeight: 700,
          color: order.method === 'cod' ? '#6D4C00' : '#2E7D32',
          background: order.method === 'cod' ? '#FFF8E1' : '#E8F5E9',
          padding: '2px 7px', borderRadius: 20 }}>
          {order.method === 'cod' ? 'COD' : 'Prepaid'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/OrderCard.js
git commit -m "feat: OrderCard shows scheduled badge and ship date"
```

---

## Task 11: Admin PATCH endpoint — allow `scheduled_ship_date`

**Files:**
- Modify: `pages/api/admin/orders/[id].js`

- [ ] **Step 1: Add `scheduled_ship_date` to the `allowed` list**

Find:
```js
const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                 'sent_at', 'delivered_at', 'returned_at', 'return_reason', 'confirmed_at'];
```

Replace with:
```js
const allowed = ['status', 'awb', 'courier', 'nimbuspost_order_id', 'label_url',
                 'sent_at', 'delivered_at', 'returned_at', 'return_reason', 'confirmed_at',
                 'scheduled_ship_date'];
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/admin/orders/\[id\].js
git commit -m "feat: admin PATCH allows scheduled_ship_date update"
```

---

## Task 12: Admin Order Detail — show and inline-edit scheduled date

**Files:**
- Modify: `pages/admin/orders/[id].js`

- [ ] **Step 1: Add state for inline edit**

In the component, after the existing `useState` declarations (around line 20), add:

```js
const [editingSchedule,  setEditingSchedule]  = useState(false);
const [scheduleInput,    setScheduleInput]    = useState('');
```

- [ ] **Step 2: Add `saveScheduledDate` handler**

After the existing `patch` function, add:

```js
const saveScheduledDate = async () => {
  await patch({ scheduled_ship_date: scheduleInput || null });
  setEditingSchedule(false);
};
```

- [ ] **Step 3: Add the scheduled date row to the Order Details table**

Find the `<Row label="Placed at" .../>` line and add after it:

```jsx
<tr style={{ borderBottom:'1px solid #f0ede8' }}>
  <td style={{ padding:'9px 0', fontWeight:600, color:'#555', width:'40%', fontSize:'.85rem' }}>🗓 Scheduled Ship Date</td>
  <td style={{ padding:'9px 0', fontSize:'.85rem', color:'#1a1a1a' }}>
    {editingSchedule ? (
      <span style={{ display:'flex', gap:6, alignItems:'center' }}>
        <input
          type="date"
          value={scheduleInput}
          onChange={e => setScheduleInput(e.target.value)}
          style={{ padding:'4px 8px', borderRadius:6, border:'1.5px solid #4A7C59', fontSize:'.82rem' }}
        />
        <button onClick={saveScheduledDate} disabled={saving}
          style={{ padding:'4px 10px', background:'#4A7C59', color:'#fff', border:'none', borderRadius:6, fontSize:'.78rem', fontWeight:700, cursor:'pointer' }}>
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={() => setEditingSchedule(false)}
          style={{ padding:'4px 8px', background:'none', border:'none', color:'#888', fontSize:'.78rem', cursor:'pointer' }}>
          Cancel
        </button>
      </span>
    ) : (
      <span style={{ display:'flex', gap:8, alignItems:'center' }}>
        <span>{order.scheduled_ship_date
          ? new Date(order.scheduled_ship_date + 'T00:00:00+05:30').toLocaleDateString('en-IN',
              { weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata' })
          : '—'}</span>
        <button
          onClick={() => { setScheduleInput(order.scheduled_ship_date || ''); setEditingSchedule(true); }}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.8rem', color:'#4A7C59', padding:0 }}
          title="Edit scheduled date"
        >✏️</button>
      </span>
    )}
  </td>
</tr>
```

- [ ] **Step 4: Add `Scheduled` badge next to the status badge in the Order Details header**

Find:
```jsx
<StatusBadge status={order.status} small />
```

Replace with:
```jsx
<StatusBadge status={order.status} small />
{order.scheduled_ship_date && <StatusBadge status="scheduled" small />}
```

- [ ] **Step 5: Commit**

```bash
git add pages/admin/orders/\[id\].js
git commit -m "feat: admin order detail shows and allows editing of scheduled ship date"
```

---

## Self-Review Checklist

- [x] `lib/holidays.js` — covers 2025 and 2026 holidays, `isBlockedDay` used in server validation in Tasks 6 & 7
- [x] `fromDate` in delivery estimate — validates range, disables caching when used
- [x] `react-day-picker` installed before UI task
- [x] UI: toggle only appears when pincode is serviceable; cancelling reverts ETA; `scheduledShipDate` flows to both COD and prepaid submit payloads
- [x] Both submit APIs import `isBlockedDay` and validate server-side
- [x] Migration adds `scheduled_ship_date date` column
- [x] `waOrderConfirmed` — falls back to template for non-scheduled orders; sends plain text with date for scheduled
- [x] Admin PATCH `allowed` list updated before order detail edit task
- [x] `StatusBadge` `scheduled` variant added before `OrderCard` and order detail tasks
- [x] Admin order detail: inline edit uses native `<input type="date">` (no day restrictions — admin override as per spec)
- [x] All type names consistent: `scheduledShipDate` (JS camelCase), `scheduled_ship_date` (DB/API snake_case)
