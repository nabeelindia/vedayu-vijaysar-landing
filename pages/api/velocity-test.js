/**
 * GET /api/velocity-test
 *
 * Diagnostic endpoint — tests Velocity auth + order creation end-to-end.
 * DELETE THIS FILE before going to production / after debugging is done.
 *
 * Hit: https://vedayulife.com/api/velocity-test
 */

import { getToken } from '../../lib/velocity';
import { kv } from '@vercel/kv';

const BASE_URL = 'https://shazam.velocity.in/custom/api/v1';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const report = {
    env: {
      VELOCITY_USERNAME:        !!process.env.VELOCITY_USERNAME,
      VELOCITY_PASSWORD:        !!process.env.VELOCITY_PASSWORD,
      VELOCITY_WAREHOUSE_ID:    process.env.VELOCITY_WAREHOUSE_ID   || '❌ NOT SET',
      VELOCITY_PICKUP_LOCATION: process.env.VELOCITY_PICKUP_LOCATION || '❌ NOT SET (fallback: "Vedayu Warehouse")',
      PICKUP_PINCODE:           process.env.PICKUP_PINCODE           || '❌ NOT SET',
    },
    auth:  null,
    order: null,
  };

  // ── 1. Auth ──────────────────────────────────────────────────
  try {
    const token = await getToken();
    report.auth = { ok: true, tokenPreview: token ? token.slice(0, 8) + '…' : null };
  } catch (err) {
    report.auth = { ok: false, error: err.message };
    return res.status(200).json(report);
  }

  // ── 2. Test order creation ────────────────────────────────────
  const testOrderId = `VED-TEST-${Date.now()}`;
  try {
    const token = await getToken();
    const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace('T', ' ').slice(0, 16);

    const payload = {
      order_id:              testOrderId,
      order_date:            now,
      billing_customer_name: 'Test Customer',
      billing_address:       '123 Test Street',
      billing_city:          'Delhi',
      billing_state:         'Delhi',
      billing_country:       'India',
      billing_pincode:       '110001',
      billing_phone:         '9999999999',
      shipping_is_billing:   true,
      print_label:           true,
      order_items: [{
        name:          'Vijaysar Wooden Glass - Pack of 1',
        sku:           'VIJ-GLASS-Q1',
        units:         1,
        selling_price: 499,
        discount:      0,
        tax:           0,
      }],
      payment_method:  'COD',
      sub_total:       499,
      cod_collectible: 499,
      length:  8,
      breadth: 8,
      height:  16,
      weight:  0.200,
      pickup_location: process.env.VELOCITY_PICKUP_LOCATION || 'Vedayu Warehouse',
      warehouse_id:    process.env.VELOCITY_WAREHOUSE_ID,
    };

    const apiRes = await fetch(`${BASE_URL}/forward-order`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': token,
      },
      body: JSON.stringify(payload),
    });

    const data = await apiRes.json();

    report.order = {
      ok:           apiRes.ok && !!data.status,
      httpStatus:   apiRes.status,
      response:     data,
      payloadSent:  { ...payload, billing_phone: '9999999999' }, // safe to log
    };

    // Clean up test order from KV if it snuck in
    kv.del(`velocity:order:${testOrderId}`).catch(() => {});

  } catch (err) {
    report.order = { ok: false, error: err.message };
  }

  return res.status(200).json(report);
}
