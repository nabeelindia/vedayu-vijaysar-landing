/**
 * lib/velocity.js
 * Velocity Shipping API client for Vedayu
 * Base URL: https://shazam.velocity.in/
 *
 * Features:
 *  - Token auth with KV cache (23hr TTL — token lasts 24hrs)
 *  - createOrder        — create + manifest forward shipment (auto courier)
 *  - getDeliveryEstimate — get ETA + rates for a pincode pair (Rates API)
 *  - getTracking        — track by AWB(s)
 *  - cancelOrder        — cancel by AWB(s)
 *  - storeAwbMapping    — save orderId ↔ awb in KV for tracking lookups
 *  - getAwbByOrderId    — lookup awb from orderId
 *  - getOrdersByPhone   — lookup all orders by phone number
 *  - getOrdersByEmail   — lookup all orders by email
 */

import { kv } from '@vercel/kv';

const BASE_URL    = 'https://shazam.velocity.in/custom/api/v1';
const TOKEN_KV_KEY = 'velocity:auth_token';

// ─── Auth ────────────────────────────────────────────────────────────────────

async function fetchToken() {
  const res = await fetch(`${BASE_URL}/auth-token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.VELOCITY_USERNAME, // e.g. "+919876543210"
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
      'Authorization': token,               // Velocity: no "Bearer" prefix
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
 * Get shipping rates and ETA for a pincode pair.
 * Called from the /api/delivery-estimate route (checkout real-time estimate).
 *
 * @param {object} params
 * @param {string} params.destination_pincode — customer pincode
 * @param {boolean} params.is_cod
 * @param {number} params.price — order value (needed for COD)
 * @returns {{ eta: string|null, carrier: string|null, zone: string|null }}
 */
export async function getDeliveryEstimate({ destination_pincode, is_cod, price }) {
  const origin = process.env.PICKUP_PINCODE;
  if (!origin) throw new Error('PICKUP_PINCODE env var not set');

  const body = {
    journey_type:        'forward',
    origin_pincode:      origin,
    destination_pincode: destination_pincode,
    dead_weight:         Number(process.env.PACKAGE_WEIGHT_GRAMS || 500),
    length:              Number(process.env.PACKAGE_LENGTH_CM    || 15),
    width:               Number(process.env.PACKAGE_BREADTH_CM   || 15),
    height:              Number(process.env.PACKAGE_HEIGHT_CM    || 15),
    payment_method:      is_cod ? 'cod' : 'prepaid',
    ...(is_cod ? { shipment_value: Number(price) || 1 } : {}),
  };

  const data = await apiFetch('/rates', { method: 'POST', body: JSON.stringify(body) });

  const couriers = data?.result?.serviceable_couriers || [];
  if (!couriers.length) return { eta: null, carrier: null, zone: data?.result?.shipment_details?.zone || null };

  // Pick cheapest courier that has an ETA
  const withEta = couriers.filter(c => c.expected_delivery?.delivery);
  const best    = withEta[0] || couriers[0];

  return {
    eta:     best?.expected_delivery?.delivery || null,   // "2024-01-19"
    carrier: best?.carrier_name || null,
    zone:    data?.result?.shipment_details?.zone || null,
  };
}

// ─── Order Creation ──────────────────────────────────────────────────────────

/**
 * Create and manifest a forward shipment on Velocity Shipping.
 * Uses /forward-order-orchestration — creates order + auto-assigns courier + generates AWB.
 *
 * @param {object} order
 * @param {string} order.orderId
 * @param {string} order.name
 * @param {string} order.mobile
 * @param {string} order.address
 * @param {string} order.city
 * @param {string} order.state
 * @param {string} order.pincode
 * @param {string} [order.email]
 * @param {string} order.pack
 * @param {number} order.qty
 * @param {number} order.price
 * @param {boolean} order.is_cod
 * @returns {{ awb, shipmentId, courierName, labelUrl, orderId }}
 */
export async function createOrder(order) {
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ').slice(0, 16);

  const payload = {
    order_id:                order.orderId,
    order_date:              now,
    carrier_id:              '',                // blank = auto-assign via configured rules
    billing_customer_name:   order.name,
    billing_address:         order.address,
    billing_city:            order.city,
    billing_state:           order.state,
    billing_country:         'India',
    billing_pincode:         order.pincode,
    billing_phone:           order.mobile,
    ...(order.email ? { billing_email: order.email } : {}),
    shipping_is_billing:     true,
    print_label:             true,
    order_items: [{
      name:          order.pack || 'Vijaysar Wooden Glass',
      sku:           'VIJ-GLASS-001',
      units:         Number(order.qty || 1),
      selling_price: Number(order.price),
      discount:      0,
      tax:           0,
    }],
    payment_method:  order.is_cod ? 'COD' : 'PREPAID',
    sub_total:       Number(order.price),
    cod_collectible: order.is_cod ? Number(order.price) : 0,
    length:          Number(process.env.PACKAGE_LENGTH_CM    || 15),
    breadth:         Number(process.env.PACKAGE_BREADTH_CM   || 15),
    height:          Number(process.env.PACKAGE_HEIGHT_CM    || 15),
    weight:          Number(process.env.PACKAGE_WEIGHT_GRAMS || 500) / 1000, // Velocity expects kg
    pickup_location: process.env.VELOCITY_PICKUP_LOCATION || 'Vedayu Warehouse',
    warehouse_id:    process.env.VELOCITY_WAREHOUSE_ID,
  };

  const data = await apiFetch('/forward-order-orchestration', {
    method: 'POST',
    body:   JSON.stringify(payload),
  });

  if (!data.status || data.status !== 1) {
    throw new Error('Velocity order creation failed: ' + JSON.stringify(data));
  }

  const p = data.payload;
  return {
    awb:         p.awb_code        || null,
    shipmentId:  p.shipment_id     || null,
    courierName: p.courier_name    || '',
    labelUrl:    p.label_url       || null,
    velocityOrderId: p.order_id    || null,
  };
}

// ─── Tracking ────────────────────────────────────────────────────────────────

/**
 * Track one or more AWBs.
 * Returns a map: { AWB: trackingData }
 *
 * @param {string|string[]} awbs
 */
export async function getTracking(awbs) {
  const list = Array.isArray(awbs) ? awbs : [awbs];
  const data = await apiFetch('/order-tracking', {
    method: 'POST',
    body:   JSON.stringify({ awbs: list }),
  });
  // Response: { result: { "AWB": { tracking_data: { ... } } } }
  return data?.result || {};
}

// ─── Cancel Order ─────────────────────────────────────────────────────────────

/**
 * Cancel one or more shipments (before pickup).
 * @param {string|string[]} awbs
 */
export async function cancelOrder(awbs) {
  const list = Array.isArray(awbs) ? awbs : [awbs];
  const data = await apiFetch('/cancel-order', {
    method: 'POST',
    body:   JSON.stringify({ awbs: list }),
  });
  return data;
}

// ─── KV Mappings ─────────────────────────────────────────────────────────────

/**
 * Store orderId → awb/shipmentId and phone/email → [orderIds] in KV.
 * Uses same key pattern as the old NimbusPost lib so existing tracking pages still work.
 */
export async function storeAwbMapping({ orderId, awb, shipmentId, mobile, email, courierName }) {
  const record = { orderId, awb, shipmentId, courierName, createdAt: Date.now() };

  try {
    await kv.set(`velocity:order:${orderId}`, record, { ex: 15552000 });

    if (mobile) {
      await kv.lpush(`velocity:phone:${mobile}`, orderId);
      await kv.expire(`velocity:phone:${mobile}`, 15552000);
    }

    if (email) {
      const emailKey = email.toLowerCase().trim();
      await kv.lpush(`velocity:email:${emailKey}`, orderId);
      await kv.expire(`velocity:email:${emailKey}`, 15552000);
    }
  } catch (err) {
    console.error('storeAwbMapping KV error:', err);
  }
}

export async function getAwbByOrderId(orderId) {
  try {
    // Check Velocity key first, fall back to legacy NimbusPost key
    const v = await kv.get(`velocity:order:${orderId}`);
    if (v) return v;
    return await kv.get(`nimbuspost:order:${orderId}`);
  } catch (_) { return null; }
}

export async function getOrdersByPhone(mobile) {
  try {
    const [v, n] = await Promise.all([
      kv.lrange(`velocity:phone:${mobile}`, 0, 9).catch(() => []),
      kv.lrange(`nimbuspost:phone:${mobile}`, 0, 9).catch(() => []),
    ]);
    // Deduplicate, most recent first
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
