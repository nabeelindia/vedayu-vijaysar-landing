# NimbusPost Tracking Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync NimbusPost shipment tracking into Supabase every 2 hours and display a live tracking timeline on each admin order detail page.

**Architecture:** A cached API client (`lib/nimbuspost.js`) handles auth (JWT cached in Vercel KV for 23h) and tracking fetches. A cron job polls all `status='sent'` orders every 2h and upserts the `shipments` table. The admin order detail page fetches shipment data alongside order data and renders a timeline UI. A manual-refresh admin API route allows on-demand sync of a single AWB.

**Tech Stack:** Next.js 14 Pages Router, Supabase (postgres), Vercel KV (`@vercel/kv`), NimbusPost REST API (Bearer token auth)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/nimbuspost.js` | `getToken()` (KV-cached), `trackShipment(awb)` |
| Create | `supabase/migrations/012_shipments_tracking.sql` | Add `history`, `edd`, `rto_status`, `rto_awb`, `last_synced_at` to `shipments` |
| Create | `pages/api/admin/tracking/[awb].js` | Manual refresh endpoint — fetch from NimbusPost, upsert shipments |
| Create | `pages/api/cron/sync-tracking.js` | Cron handler — poll active orders, upsert shipments, update order status |
| Modify | `pages/api/admin/orders/[id].js` | Add shipment row to GET response |
| Modify | `pages/admin/orders/[id].js` | Add tracking timeline UI section |
| Modify | `vercel.json` | Add `sync-tracking` cron entry |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/012_shipments_tracking.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/012_shipments_tracking.sql
alter table shipments
  add column if not exists history        jsonb,
  add column if not exists edd            text,
  add column if not exists rto_status     text,
  add column if not exists rto_awb        text,
  add column if not exists last_synced_at timestamptz;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration runs without error. If `supabase` CLI isn't linked, run it via the Supabase dashboard SQL editor instead.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_shipments_tracking.sql
git commit -m "db: add tracking columns to shipments table"
```

---

## Task 2: NimbusPost API client

**Files:**
- Create: `lib/nimbuspost.js`

- [ ] **Step 1: Create the client**

```js
// lib/nimbuspost.js
import { kv } from '@vercel/kv';

const BASE_URL  = 'https://ship.nimbuspost.com/api';
const TOKEN_KEY = 'nimbus:token';

async function fetchToken() {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.NIMBUSPOST_EMAIL,
      password: process.env.NIMBUSPOST_PASSWORD,
    }),
  });
  const json = await res.json();
  if (!json.status || !json.data) {
    throw new Error(`NimbusPost login failed: ${json.message || JSON.stringify(json)}`);
  }
  return json.data; // JWT string
}

export async function getToken() {
  const cached = await kv.get(TOKEN_KEY).catch(() => null);
  if (cached) return cached;

  const token = await fetchToken();
  await kv.set(TOKEN_KEY, token, { ex: 23 * 60 * 60 }).catch(() => {}); // 23h TTL
  return token;
}

async function fetchTrack(awb, token) {
  const res = await fetch(`${BASE_URL}/shipmentcargo/track/${encodeURIComponent(awb)}`, {
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return { res, json: await res.json() };
}

export async function trackShipment(awb) {
  const token = await getToken();
  let { res, json } = await fetchTrack(awb, token);

  // 401 → clear cached token, retry once with a fresh token
  if (res.status === 401) {
    await kv.del(TOKEN_KEY).catch(() => {});
    const fresh = await fetchToken();
    await kv.set(TOKEN_KEY, fresh, { ex: 23 * 60 * 60 }).catch(() => {});
    ({ res, json } = await fetchTrack(awb, fresh));
  }

  if (!json.status) {
    throw new Error(`NimbusPost track failed for ${awb}: ${json.message || JSON.stringify(json)}`);
  }
  return json.data;
}
```

- [ ] **Step 2: Add env vars to Vercel dashboard**

Go to Vercel → your project → Settings → Environment Variables and add:
- `NIMBUSPOST_EMAIL` = `india+4183@hashcart.com`
- `NIMBUSPOST_PASSWORD` = `tXa2GX3y9P`

Also add them to your local `.env.local` for development:
```
NIMBUSPOST_EMAIL=india+4183@hashcart.com
NIMBUSPOST_PASSWORD=tXa2GX3y9P
```

- [ ] **Step 3: Smoke-test the client locally**

```bash
node -e "
import('./lib/nimbuspost.js').then(async ({ getToken }) => {
  const t = await getToken();
  console.log('token length:', t.length);
}).catch(console.error);
"
```

Expected: prints `token length: <number>` (NimbusPost JWTs are ~200+ chars).

- [ ] **Step 4: Commit**

```bash
git add lib/nimbuspost.js
git commit -m "feat: add NimbusPost API client with KV-cached token"
```

---

## Task 3: Admin manual-refresh tracking endpoint

**Files:**
- Create: `pages/api/admin/tracking/[awb].js`

- [ ] **Step 1: Create the route**

```js
// pages/api/admin/tracking/[awb].js
import { checkAdminAuth } from '../../_auth';
import { supabase }        from '../../../../lib/supabase';
import { trackShipment }   from '../../../../lib/nimbuspost';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).end();
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  const { awb } = req.query;
  if (!awb) return res.status(400).json({ error: 'AWB required' });

  try {
    const data = await trackShipment(awb);

    await supabase.from('shipments').upsert({
      awb,
      status:          data.status          || null,
      rto_status:      data.rto_status       || null,
      rto_awb:         data.rto_awb          || null,
      edd:             data.edd              || null,
      history:         data.history          || [],
      last_synced_at:  new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      raw_event:       data,
    }, { onConflict: 'awb' });

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[tracking refresh]', err.message);
    return res.status(502).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/admin/tracking/\[awb\].js
git commit -m "feat: admin tracking refresh endpoint GET /api/admin/tracking/[awb]"
```

---

## Task 4: Cron job — sync all active shipments

**Files:**
- Create: `pages/api/cron/sync-tracking.js`

- [ ] **Step 1: Create the cron handler**

```js
// pages/api/cron/sync-tracking.js
import { supabase }      from '../../../lib/supabase';
import { trackShipment } from '../../../lib/nimbuspost';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });

  // Fetch up to 50 orders currently in transit
  const { data: orders, error } = await supabase
    .from('orders')
    .select('order_id, awb, status')
    .eq('status', 'sent')
    .not('awb', 'is', null)
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  if (!orders?.length) return res.json({ synced: 0, message: 'No active shipments to sync' });

  const results = { synced: 0, errors: [] };

  for (const order of orders) {
    try {
      const data = await trackShipment(order.awb);

      // Upsert tracking data
      await supabase.from('shipments').upsert({
        awb:             order.awb,
        status:          data.status          || null,
        rto_status:      data.rto_status       || null,
        rto_awb:         data.rto_awb          || null,
        edd:             data.edd              || null,
        history:         data.history          || [],
        last_synced_at:  new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        raw_event:       data,
      }, { onConflict: 'awb' });

      // Auto-update order status on terminal events
      const s = (data.status || '').toLowerCase();
      const now = new Date().toISOString();

      if (s.includes('delivered')) {
        await supabase.from('orders')
          .update({ status: 'delivered', delivered_at: now, updated_at: now })
          .eq('awb', order.awb);
      } else if (s.includes('rto')) {
        await supabase.from('orders')
          .update({ status: 'returned', returned_at: now, updated_at: now })
          .eq('awb', order.awb);
      }

      results.synced++;
    } catch (err) {
      console.error(`[sync-tracking] AWB ${order.awb}:`, err.message);
      results.errors.push({ awb: order.awb, error: err.message });
    }
  }

  console.log('[sync-tracking] done:', results);
  return res.json(results);
}
```

- [ ] **Step 2: Add cron entry to `vercel.json`**

Open `vercel.json`. The current `crons` array ends with `cart-recover`. Add the new entry:

```json
{ "path": "/api/cron/sync-tracking", "schedule": "0 */2 * * *" }
```

The full crons section becomes:
```json
"crons": [
  { "path": "/api/cron/generate-posts",    "schedule": "30 0 * * 1"   },
  { "path": "/api/cron/send-followups",    "schedule": "30 2 * * *"   },
  { "path": "/api/sync-audiences",         "schedule": "0 3 * * *"    },
  { "path": "/api/cron/cod-nudge",         "schedule": "30 4 * * *"   },
  { "path": "/api/cron/cod-hold-reminder", "schedule": "30 11 * * *"  },
  { "path": "/api/cron/cod-auto-confirm",  "schedule": "30 0 * * *"   },
  { "path": "/api/cron/cart-recover",      "schedule": "0 5 * * *"    },
  { "path": "/api/cron/sync-tracking",     "schedule": "0 */2 * * *"  }
]
```

- [ ] **Step 3: Commit**

```bash
git add pages/api/cron/sync-tracking.js vercel.json
git commit -m "feat: cron sync NimbusPost tracking every 2h"
```

---

## Task 5: Extend admin order API to return shipment

**Files:**
- Modify: `pages/api/admin/orders/[id].js` (lines 10–23)

- [ ] **Step 1: Add shipment fetch to GET handler**

Find the GET block (currently lines 10–23). Replace it with:

```js
  if (req.method === 'GET') {
    const [orderRes, verifRes, notesRes, refundsRes, shipmentRes] = await Promise.all([
      supabase.from('orders').select('*').eq('order_id', id).single(),
      supabase.from('cod_verifications').select('*').eq('order_id', id).maybeSingle(),
      supabase.from('order_notes').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('refunds').select('*').eq('order_id', id).order('created_at', { ascending: false }),
      supabase.from('orders').select('awb').eq('order_id', id).single().then(async ({ data: o }) => {
        if (!o?.awb) return { data: null };
        return supabase.from('shipments').select('*').eq('awb', o.awb).maybeSingle();
      }),
    ]);
    if (orderRes.error) return res.status(404).json({ error: 'Order not found' });
    return res.json({
      order:        orderRes.data,
      verification: verifRes.data,
      notes:        notesRes.data    || [],
      refunds:      refundsRes.data  || [],
      shipment:     shipmentRes.data || null,
    });
  }
```

- [ ] **Step 2: Commit**

```bash
git add pages/api/admin/orders/\[id\].js
git commit -m "feat: include shipment tracking in admin order GET response"
```

---

## Task 6: Tracking timeline UI on order detail page

**Files:**
- Modify: `pages/admin/orders/[id].js`

- [ ] **Step 1: Add `shipment` to state and data destructure**

At the top of the component (around line 15, after existing state declarations), add:

```js
  const [shipment,      setShipment]      = useState(null);
  const [refreshing,    setRefreshing]    = useState(false);
```

Find the `useEffect` that calls the order API and sets `setData(d)`. After `setData(d)` add:

```js
      setShipment(d.shipment || null);
```

- [ ] **Step 2: Add refresh handler**

After the existing `markSent` function, add:

```js
  const refreshTracking = async () => {
    if (!order?.awb) return;
    setRefreshing(true);
    try {
      const r = await fetch(`/api/admin/tracking/${order.awb}`);
      const d = await r.json();
      if (d.ok) setShipment(d.data);
    } catch (_) {}
    setRefreshing(false);
  };
```

- [ ] **Step 3: Add tracking timeline section**

Find the closing `</div>` of the Order Details card (around line 200, after the `{order.delivered_at && ...}` row). Add a new card immediately after:

```jsx
          {/* ── Tracking Timeline ── */}
          {order.awb && (
            <div style={{ flex:'1 1 320px', background:'#fff', borderRadius:12,
              padding:'18px 20px', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <h2 style={{ margin:0, fontSize:'.85rem', fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'.7px', color:'#888' }}>📦 Tracking</h2>
                <button onClick={refreshTracking} disabled={refreshing}
                  style={{ fontSize:'.75rem', padding:'4px 10px', borderRadius:6,
                    border:'1px solid #d0c8bc', background:'#fff', cursor:'pointer',
                    color:'#5C3D1E', fontWeight:600 }}>
                  {refreshing ? '…' : '↻ Refresh'}
                </button>
              </div>

              {!shipment && (
                <p style={{ fontSize:'.82rem', color:'#aaa', margin:0 }}>
                  No tracking data yet. Click Refresh to fetch from NimbusPost.
                </p>
              )}

              {shipment && (
                <>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                    <span style={{ fontSize:'.75rem', fontWeight:700, padding:'3px 10px',
                      borderRadius:20, background:'#FFF8EE', border:'1px solid #e8ddd0',
                      color:'#5C3D1E' }}>
                      {shipment.status || '—'}
                    </span>
                    {shipment.rto_status && (
                      <span style={{ fontSize:'.75rem', fontWeight:700, padding:'3px 10px',
                        borderRadius:20, background:'#FFF3E0', border:'1px solid #FFB74D',
                        color:'#E65100' }}>
                        RTO: {shipment.rto_status}
                      </span>
                    )}
                    {shipment.edd && (
                      <span style={{ fontSize:'.75rem', color:'#666', padding:'3px 10px',
                        borderRadius:20, background:'#F5F5F5', border:'1px solid #e0e0e0' }}>
                        EDD: {shipment.edd}
                      </span>
                    )}
                  </div>

                  {Array.isArray(shipment.history) && shipment.history.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                      {shipment.history.map((evt, i) => (
                        <div key={i} style={{ display:'flex', gap:12, paddingBottom:12,
                          borderLeft:'2px solid #e8ddd0', marginLeft:6, paddingLeft:14,
                          position:'relative' }}>
                          <div style={{ position:'absolute', left:-5, top:2, width:8, height:8,
                            borderRadius:'50%', background: i === 0 ? '#5C3D1E' : '#d0c8bc',
                            border:'2px solid #fff' }} />
                          <div>
                            <div style={{ fontSize:'.78rem', fontWeight:600, color:'#1a1a1a' }}>
                              {evt.message || evt.status_code}
                            </div>
                            <div style={{ fontSize:'.72rem', color:'#888', marginTop:2 }}>
                              {evt.location && <span>{evt.location} · </span>}
                              {evt.event_time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {shipment.last_synced_at && (
                    <p style={{ fontSize:'.7rem', color:'#bbb', marginTop:8, marginBottom:0 }}>
                      Last synced: {new Date(shipment.last_synced_at).toLocaleString('en-IN',
                        { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' })} IST
                    </p>
                  )}
                </>
              )}
            </div>
          )}
```

- [ ] **Step 4: Commit**

```bash
git add pages/admin/orders/\[id\].js
git commit -m "feat: tracking timeline on admin order detail page"
```

---

## Task 7: Deploy and verify

- [ ] **Step 1: Push to trigger Vercel deploy**

```bash
git push origin main
```

- [ ] **Step 2: Add env vars to Vercel if not done yet**

Vercel dashboard → Project → Settings → Environment Variables:
- `NIMBUSPOST_EMAIL`
- `NIMBUSPOST_PASSWORD`

After adding, redeploy: Vercel dashboard → Deployments → Redeploy latest.

- [ ] **Step 3: Test manual refresh on a live order**

1. Open an order in the admin panel that has an AWB set
2. Click the **↻ Refresh** button in the Tracking section
3. Expected: tracking timeline appears with events from NimbusPost

- [ ] **Step 4: Test cron manually**

```bash
curl -X GET https://vedayulife.com/api/cron/sync-tracking \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response: `{"synced": N, "errors": []}`

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix: tracking sync review fixes"
git push origin main
```
