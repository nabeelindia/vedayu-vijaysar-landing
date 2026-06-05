/**
 * lib/nimbuspost.js
 * NimbusPost API client for Vedayu
 *
 * Features:
 *  - Token auth with KV cache (23hr TTL — token lasts 24hrs)
 *  - checkServiceability — get available couriers + rates for a pincode pair
 *  - createShipment     — create shipment with manually chosen courier
 *  - getTracking        — single AWB tracking
 *  - getBulkTracking    — multiple AWBs
 *  - getNdr             — list NDR orders
 *  - updateNdr          — take action on NDR (re-attempt / RTO / address change)
 *  - storeAwbMapping    — save orderId ↔ awb in KV for tracking lookups
 *  - getAwbByOrderId    — lookup awb from orderId
 *  - getOrdersByPhone   — lookup all orders by phone number
 */

import { kv } from '@vercel/kv';

const BASE_URL = 'https://api.nimbuspost.com/v1';
const TOKEN_KV_KEY = 'nimbuspost:auth_token';

// ─── Auth ────────────────────────────────────────────────────────────────────

async function fetchToken() {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email:    process.env.NIMBUSPOST_EMAIL,
      password: process.env.NIMBUSPOST_PASSWORD,
    }),
  });
  const data = await res.json();
  if (!data.status || !data.data) throw new Error('NimbusPost login failed: ' + JSON.stringify(data));
  return data.data; // JWT string
}

export async function getToken() {
  // Try KV cache first
  try {
    const cached = await kv.get(TOKEN_KV_KEY);
    if (cached) return cached;
  } catch (_) {}

  const token = await fetchToken();

  // Cache for 23 hours (token expires in 24hr)
  try {
    await kv.set(TOKEN_KV_KEY, token, { ex: 82800 });
  } catch (_) {}

  return token;
}

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return data;
}

// ─── Serviceability ──────────────────────────────────────────────────────────

/**
 * Check which couriers can deliver from pickup → delivery pincode.
 * Returns array of couriers with rates, ETA and performance metrics.
 *
 * @param {object} params
 * @param {string} params.pickup_pincode
 * @param {string} params.delivery_pincode
 * @param {number} params.weight_grams
 * @param {boolean} params.is_cod
 * @param {number} params.cod_amount
 * @returns {Array} couriers sorted by rate ascending
 */
export async function checkServiceability({ pickup_pincode, delivery_pincode, weight_grams, is_cod, cod_amount }) {
  const data = await apiFetch('/courier/serviceability', {
    method: 'POST',
    body: JSON.stringify({
      pickup_pincode:   pickup_pincode,
      delivery_pincode: delivery_pincode,
      weight:           weight_grams,
      cod:              is_cod ? 1 : 0,
      cod_amount:       cod_amount || 0,
    }),
  });

  if (!data.status) throw new Error('Serviceability check failed: ' + JSON.stringify(data));

  // Sort by total rate ascending so cheapest is first
  const couriers = (data.data || []).sort((a, b) => (a.total_charges || 0) - (b.total_charges || 0));
  return couriers;
}

/**
 * Pick the best courier for a COD order:
 * - Must support COD
 * - Lowest rate
 * Falls back to first available if none specifically support COD.
 */
export function pickBestCourier(couriers) {
  const codCouriers = couriers.filter(c => c.cod === 1 || c.is_cod === 1 || c.cod === true);
  return codCouriers[0] || couriers[0] || null;
}

// ─── Shipment Creation ───────────────────────────────────────────────────────

/**
 * Create a shipment on NimbusPost.
 * Courier is selected manually (no auto-assign).
 *
 * @param {object} order  — customer order details
 * @param {string} courierId — from checkServiceability result
 * @returns {object} { awb, shipment_id, label_url, ...}
 */
export async function createShipment(order, courierId) {
  const payload = {
    order_number:     order.orderId,
    shipping_charges: 0,
    discount:         0,
    cod_charges:      0,
    payment_type:     order.is_cod ? 1 : 2,   // 1=COD, 2=Prepaid
    order_amount:     Number(order.price),
    package_weight:   Number(process.env.PACKAGE_WEIGHT_GRAMS || 500),
    package_length:   Number(process.env.PACKAGE_LENGTH_CM    || 15),
    package_breadth:  Number(process.env.PACKAGE_BREADTH_CM   || 15),
    package_height:   Number(process.env.PACKAGE_HEIGHT_CM    || 15),
    consignee: {
      name:      order.name,
      address:   order.address,
      address_2: '',
      city:      order.city,
      state:     order.state,
      pincode:   order.pincode,
      phone:     order.mobile,
    },
    pickup: {
      warehouse_name: process.env.PICKUP_WAREHOUSE_NAME || 'Vedayu Main',
      name:           process.env.PICKUP_NAME           || 'Vedayu Wellness',
      address:        process.env.PICKUP_ADDRESS        || '',
      city:           process.env.PICKUP_CITY           || '',
      state:          process.env.PICKUP_STATE          || '',
      pincode:        process.env.PICKUP_PINCODE        || '',
      phone:          process.env.PICKUP_PHONE          || '',
    },
    product_details: {
      name:       order.pack || 'Vijaysar Wooden Glass',
      category:   'Health Products',
      hsn_code:   '',
      quantity:   Number(order.qty || 1),
      unit_price: Number(order.price),
      total_value: Number(order.price),
    },
    courier_id: courierId,
  };

  const data = await apiFetch('/shipment/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!data.status) throw new Error('NimbusPost shipment creation failed: ' + JSON.stringify(data));
  return data.data; // { awb, shipment_id, label_url, courier_name, ... }
}

/**
 * Create an order in NimbusPost (no courier assigned, no AWB).
 * The order appears in your NimbusPost dashboard for manual processing.
 * Called automatically after every Vedayu order is placed.
 */
export async function createOrder(order) {
  const payload = {
    order_number:     order.orderId,
    shipping_charges: 0,
    discount:         0,
    cod_charges:      0,
    payment_type:     order.is_cod ? 1 : 2,   // 1=COD, 2=Prepaid
    order_amount:     Number(order.price),
    package_weight:   Number(process.env.PACKAGE_WEIGHT_GRAMS || 500),
    package_length:   Number(process.env.PACKAGE_LENGTH_CM    || 15),
    package_breadth:  Number(process.env.PACKAGE_BREADTH_CM   || 15),
    package_height:   Number(process.env.PACKAGE_HEIGHT_CM    || 15),
    consignee: {
      name:      order.name,
      address:   order.address,
      address_2: '',
      city:      order.city,
      state:     order.state,
      pincode:   order.pincode,
      phone:     order.mobile,
    },
    pickup: {
      warehouse_name: process.env.PICKUP_WAREHOUSE_NAME || 'Vedayu Main',
      name:           process.env.PICKUP_NAME           || 'Vedayu Wellness',
      address:        process.env.PICKUP_ADDRESS        || '',
      city:           process.env.PICKUP_CITY           || '',
      state:          process.env.PICKUP_STATE          || '',
      pincode:        process.env.PICKUP_PINCODE        || '',
      phone:          process.env.PICKUP_PHONE          || '',
    },
    product_details: {
      name:        order.pack || 'Vijaysar Wooden Glass',
      category:    'Health Products',
      hsn_code:    '',
      quantity:    Number(order.qty || 1),
      unit_price:  Number(order.price),
      total_value: Number(order.price),
    },
  };

  const data = await apiFetch('/orders/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!data.status) throw new Error('NimbusPost order creation failed: ' + JSON.stringify(data));
  return data.data; // { order_id, ... }
}

// ─── Tracking ────────────────────────────────────────────────────────────────

/**
 * Track a single shipment by AWB number.
 * Returns array of tracking events, newest first.
 */
export async function getTracking(awb) {
  const data = await apiFetch(`/tracking/${awb}`);
  if (!data.status) throw new Error('Tracking fetch failed: ' + JSON.stringify(data));
  return data.data;
}

/**
 * Track multiple AWBs in one call.
 */
export async function getBulkTracking(awbs) {
  const data = await apiFetch('/shipment/track', {
    method: 'POST',
    body: JSON.stringify({ awbs }),
  });
  if (!data.status) throw new Error('Bulk tracking failed: ' + JSON.stringify(data));
  return data.data;
}

// ─── NDR ─────────────────────────────────────────────────────────────────────

/**
 * Get list of Non-Delivery Report orders.
 * @param {number} page - pagination (1-based)
 */
export async function getNdr(page = 1) {
  const data = await apiFetch('/ndr', {
    method: 'POST',
    body: JSON.stringify({ page, per_page: 20 }),
  });
  if (!data.status) throw new Error('NDR fetch failed: ' + JSON.stringify(data));
  return data.data;
}

/**
 * Submit an action for an NDR shipment.
 * @param {string} awb
 * @param {string} action  — 'reattempt' | 'rto' | 'address_change'
 * @param {string} [newAddress] — required if action === 'address_change'
 */
export async function updateNdr(awb, action, newAddress) {
  const payload = { awb, action };
  if (action === 'address_change' && newAddress) {
    payload.new_address = newAddress;
  }
  const data = await apiFetch('/ndr', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!data.status) throw new Error('NDR update failed: ' + JSON.stringify(data));
  return data.data;
}

// ─── Supabase Mappings for Tracking ──────────────────────────────────────────

import { supabase } from './supabase.js';

export async function storeAwbMapping({ orderId, awb, mobile, email, name, nimbuspostOrderId, labelUrl }) {
  try {
    await supabase.from('shipments').upsert({
      order_id:            orderId,
      awb:                 awb || null,
      courier:             'nimbuspost',
      nimbuspost_order_id: nimbuspostOrderId || null,
      mobile:              mobile || null,
      email:               email?.toLowerCase().trim() || null,
      name:                name || null,
      label_url:           labelUrl || null,
      last_updated_at:     new Date().toISOString(),
    }, { onConflict: 'order_id' });
  } catch (err) {
    console.error('storeAwbMapping error:', err);
  }
}

export async function getAwbByOrderId(orderId) {
  try {
    const { data } = await supabase
      .from('shipments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();
    return data || null;
  } catch { return null; }
}

export async function getOrdersByPhone(mobile) {
  try {
    const { data } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('mobile', mobile)
      .order('created_at', { ascending: false })
      .limit(10);
    return (data || []).map(r => r.order_id);
  } catch { return []; }
}

export async function getOrdersByEmail(email) {
  try {
    const { data } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('email', email.toLowerCase().trim())
      .order('created_at', { ascending: false })
      .limit(10);
    return (data || []).map(r => r.order_id);
  } catch { return []; }
}
