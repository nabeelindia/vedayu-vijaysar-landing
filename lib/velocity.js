/**
 * lib/velocity.js
 * Velocity Shipping (formerly Shipfast) API client for Vedayu
 * Base URL: https://shazam.velocity.in/
 *
 * Features:
 *  - Token auth with KV cache (23hr TTL — token lasts 24hrs)
 *  - createOrder         — create + manifest forward shipment (auto courier)
 *  - getDeliveryEstimate — get ETA + rates for a pincode pair (Rates API)
 *  - getTracking         — track by AWB(s)
 *  - cancelOrder         — cancel by AWB(s)
 *  - storeAwbMapping     — save orderId ↔ awb in KV for tracking lookups
 *  - getAwbByOrderId     — lookup awb from orderId
 *  - getOrdersByPhone    — lookup all orders by phone number
 *  - getOrdersByEmail    — lookup all orders by email
 */

import { kv } from '@vercel/kv';

const BASE_URL     = 'https://shazam.velocity.in/custom/api/v1';
const TOKEN_KV_KEY = 'velocity:auth_token';

// ─── Pack dimensions ─────────────────────────────────────────────────────────
// Actual packed box specs per Vedayu pack.
// weight in kg (Velocity expects kg), dimensions in cm.

const PACK_SPECS = {
  1: { weight: 0.200, length: 8,  breadth: 8,  height: 16 }, // Pack of 1: 200g · 8×8×16 cm
  2: { weight: 0.400, length: 16, breadth: 8,  height: 16 }, // Pack of 2: 400g · 16×8×16 cm
  5: { weight: 0.999, length: 16, breadth: 16, height: 16 }, // Pack of 5: 999g · 16×16×16 cm
};

/** Return dimensions for a given qty. Falls back to Pack of 1 if unknown. */
function packDims(qty) {
  return PACK_SPECS[Number(qty)] || PACK_SPECS[1];
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function fetchToken() {
  const res = await fetch(`${BASE_URL}/auth-token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.VELOCITY_USERNAME, // mobile with country code, e.g. "+919876543210"
      password: process.env.VELOCITY_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Velocity auth HTTP ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error('Velocity auth failed: ' + JSON.stringify(data));
  return data.token; // short token string, valid 24hrs
}

export async function getToken() {
  try {
    const cached = await kv.get(TOKEN_KV_KEY);
    if (cached) return cached;
  } catch (_) {}

  const token = await fetchToken();

  try {
    await kv.set(TOKEN_KV_KEY, token, { ex: 82800 }); // 23hr cache
  } catch (_) {}

  return token;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': token,  // Velocity: no "Bearer" prefix
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Velocity API ${path} HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Delivery Estimate (Rates API) ───────────────────────────────────────────

/**
 * Get shipping rates and ETA for a customer pincode.
 * Called from /api/delivery-estimate when customer enters their pincode.
 * Uses Pack of 1 dimensions as the representative weight for the estimate.
 *
 * @param {object} params
 * @param {string}  params.destination_pincode
 * @param {boolean} params.is_cod
 * @param {number}  params.price — order value (required for COD)
 * @param {number}  [params.qty] — pack quantity (defaults to 1 for the estimate)
 * @returns {{ eta: string|null, carrier: string|null, zone: string|null }}
 */
export async function getDeliveryEstimate({ destination_pincode, is_cod, price, qty = 1 }) {
  const origin = process.env.PICKUP_PINCODE;
  if (!origin) throw new Error('PICKUP_PINCODE env var not set');

  const dims = packDims(qty);
  const body = {
    journey_type:        'forward',
    origin_pincode:      origin,
    destination_pincode: destination_pincode,
    dead_weight:         Math.round(dims.weight * 1000), // Rates API expects grams
    length:              dims.length,
    width:               dims.breadth,
    height:              dims.height,
    payment_method:      is_cod ? 'cod' : 'prepaid',
    ...(is_cod ? { shipment_value: Number(price) || 1 } : {}),
  };

  const data = await apiFetch('/rates', { method: 'POST', body: JSON.stringify(body) });

  const couriers = data?.result?.serviceable_couriers || [];
  if (!couriers.length) {
    return { eta: null, carrier: null, zone: data?.result?.shipment_details?.zone || null };
  }

  // Pick cheapest carrier that provides an ETA; fall back to first carrier
  const withEta = couriers.filter(c => c.expected_delivery?.delivery);
  const best    = withEta[0] || couriers[0];

  return {
    eta:     best?.expected_delivery?.delivery || null,  // "2024-01-19"
    carrier: best?.carrier_name || null,
    zone:    data?.result?.shipment_details?.zone || null,
  };
}

// ─── Order Creation ──────────────────────────────────────────────────────────

/**
 * Create a forward order on Velocity Shipping for manual processing.
 * Endpoint: /forward-order  (NOT /forward-order-orchestration)
 *
 * This creates the order on the Velocity dashboard without assigning
 * a courier or generating an AWB. The team processes it manually from
 * the dashboard. To auto-assign a courier later, call /forward-order-shipment
 * with the returned shipment_id.
 *
 * @param {object} order
 * @param {string}  order.orderId
 * @param {string}  order.name
 * @param {string}  order.mobile
 * @param {string}  order.address
 * @param {string}  order.city
 * @param {string}  order.state
 * @param {string}  order.pincode
 * @param {string}  [order.email]
 * @param {string}  order.pack    — pack name e.g. "Pack of 1"
 * @param {number}  order.qty     — quantity (1 | 2 | 5) — determines dimensions
 * @param {number}  order.price
 * @param {boolean} order.is_cod
 * @returns {{ shipmentId, velocityOrderId }}
 * Note: awb and courierName are null at this stage — assigned when processed manually.
 */
export async function createOrder(order) {
  const now  = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ').slice(0, 16);
  const dims = packDims(order.qty);

  const payload = {
    order_id:              order.orderId,
    order_date:            now,
    billing_customer_name: order.name,
    billing_address:       order.address,
    billing_city:          order.city,
    billing_state:         order.state,
    billing_country:       'India',
    billing_pincode:       order.pincode,
    billing_phone:         order.mobile,
    ...(order.email ? { billing_email: order.email } : {}),
    shipping_is_billing:   true,
    print_label:           true,
    order_items: [{
      name:          order.pack || 'Vijaysar Wooden Glass',
      sku:           `VIJ-GLASS-Q${order.qty || 1}`,
      units:         Number(order.qty || 1),
      selling_price: Number(order.price),
      discount:      0,
      tax:           0,
    }],
    payment_method:  order.is_cod ? 'COD' : 'PREPAID',
    sub_total:       Number(order.price),
    cod_collectible: order.is_cod ? Number(order.price) : 0,
    // Pack-specific dimensions
    length:  dims.length,
    breadth: dims.breadth,
    height:  dims.height,
    weight:  dims.weight,           // kg
    pickup_location: process.env.VELOCITY_PICKUP_LOCATION || 'Vedayu Warehouse',
    warehouse_id:    process.env.VELOCITY_WAREHOUSE_ID,
  };

  const data = await apiFetch('/forward-order', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });

  // Velocity returns status:1 (int) or status:true (bool) on success
  if (!data.status) {
    throw new Error('Velocity order creation failed: ' + JSON.stringify(data));
  }

  const p = data.payload;
  return {
    awb:             null,               // not assigned until manually processed
    shipmentId:      p.shipment_id  || null,
    courierName:     null,
    labelUrl:        null,
    velocityOrderId: p.order_id     || null,
  };
}

// ─── Tracking ────────────────────────────────────────────────────────────────

/**
 * Track one or more AWBs.
 * Returns a map keyed by AWB: { AWB: { tracking_data: {...} } }
 *
 * @param {string|string[]} awbs
 */
export async function getTracking(awbs) {
  const list = Array.isArray(awbs) ? awbs : [awbs];
  const data = await apiFetch('/order-tracking', {
    method: 'POST',
    body:   JSON.stringify({ awbs: list }),
  });
  return data?.result || {};
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────

/**
 * Cancel one or more shipments by AWB (only before pickup).
 * @param {string|string[]} awbs
 */
export async function cancelOrder(awbs) {
  const list = Array.isArray(awbs) ? awbs : [awbs];
  return apiFetch('/cancel-order', {
    method: 'POST',
    body:   JSON.stringify({ awbs: list }),
  });
}

// ─── KV Mappings ─────────────────────────────────────────────────────────────

/**
 * Store order tracking mappings in KV after a shipment is created:
 *   velocity:order:{orderId}     → { orderId, awb, shipmentId, courierName, ... }
 *   velocity:awb:{awb}           → { orderId, name }   ← reverse lookup for webhook
 *   velocity:phone:{mobile}      → [orderId, ...]       ← list (lpush)
 *   velocity:email:{email}       → [orderId, ...]       ← list (lpush)
 *
 * Also checks legacy nimbuspost: keys so tracking still works for old orders.
 */
export async function storeAwbMapping({ orderId, awb, shipmentId, mobile, email, courierName, name }) {
  const record = { orderId, awb, shipmentId, courierName, name: name || '', createdAt: Date.now() };

  try {
    await Promise.all([
      // Forward lookup: orderId → shipment record
      kv.set(`velocity:order:${orderId}`, record, { ex: 15552000 }),

      // Reverse lookup: awb → orderId (used by webhook handler)
      awb ? kv.set(`velocity:awb:${awb}`, { orderId, name: name || '' }, { ex: 15552000 }) : Promise.resolve(),

      // Phone index
      mobile ? kv.lpush(`velocity:phone:${mobile}`, orderId).then(() =>
        kv.expire(`velocity:phone:${mobile}`, 15552000)) : Promise.resolve(),

      // Email index
      email ? kv.lpush(`velocity:email:${email.toLowerCase().trim()}`, orderId).then(() =>
        kv.expire(`velocity:email:${email.toLowerCase().trim()}`, 15552000)) : Promise.resolve(),
    ]);
  } catch (err) {
    console.error('storeAwbMapping KV error:', err);
  }
}

export async function getAwbByOrderId(orderId) {
  try {
    const v = await kv.get(`velocity:order:${orderId}`);
    if (v) return v;
    return await kv.get(`nimbuspost:order:${orderId}`); // legacy fallback
  } catch (_) { return null; }
}

export async function getOrdersByPhone(mobile) {
  try {
    const [v, n] = await Promise.all([
      kv.lrange(`velocity:phone:${mobile}`, 0, 9).catch(() => []),
      kv.lrange(`nimbuspost:phone:${mobile}`, 0, 9).catch(() => []),
    ]);
    return [...new Set([...(v || []), ...(n || [])])].slice(0, 10);
  } catch (_) { return []; }
}

export async function getOrdersByEmail(email) {
  try {
    const key = email.toLowerCase().trim();
    const [v, n] = await Promise.all([
      kv.lrange(`velocity:email:${key}`, 0, 9).catch(() => []),
      kv.lrange(`nimbuspost:email:${key}`, 0, 9).catch(() => []),
    ]);
    return [...new Set([...(v || []), ...(n || [])])].slice(0, 10);
  } catch (_) { return []; }
}
