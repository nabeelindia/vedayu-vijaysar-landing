/**
 * GET /api/track-order?awb=XXX
 * GET /api/track-order?order=VED-COD-XXX
 * GET /api/track-order?phone=9876543210
 * GET /api/track-order?email=customer@example.com
 *
 * Returns tracking info for one or more shipments.
 * Public endpoint — no auth required (order IDs are already unguessable).
 */

import {
  getTracking,
  getBulkTracking,
  getAwbByOrderId,
  getOrdersByPhone,
  getOrdersByEmail,
} from '../../lib/nimbuspost';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { awb, order, phone, email } = req.query;

  // ── 1. Track by AWB directly ──────────────────────────────────────────────
  if (awb) {
    try {
      const tracking = await getTracking(awb.trim());
      return res.status(200).json({ success: true, type: 'awb', results: [normalizeTracking(awb, tracking)] });
    } catch (err) {
      return res.status(404).json({ success: false, error: 'No shipment found for AWB: ' + awb });
    }
  }

  // ── 2. Track by Order ID ──────────────────────────────────────────────────
  if (order) {
    const record = await getAwbByOrderId(order.trim().toUpperCase());
    if (!record?.awb) {
      return res.status(404).json({ success: false, error: 'No shipment found for Order ID: ' + order });
    }
    try {
      const tracking = await getTracking(record.awb);
      return res.status(200).json({
        success: true,
        type: 'order',
        results: [normalizeTracking(record.awb, tracking, record)],
      });
    } catch (err) {
      return res.status(404).json({ success: false, error: 'Tracking data unavailable. Try again shortly.' });
    }
  }

  // ── 3. Track by Phone ─────────────────────────────────────────────────────
  if (phone) {
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9][0-9]{9}$/.test(cleaned)) {
      return res.status(400).json({ success: false, error: 'Invalid mobile number' });
    }
    const orderIds = await getOrdersByPhone(cleaned);
    if (!orderIds.length) {
      return res.status(404).json({ success: false, error: 'No orders found for this number' });
    }
    return await resolveAndReturn(orderIds, 'phone', res);
  }

  // ── 4. Track by Email ─────────────────────────────────────────────────────
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }
    const orderIds = await getOrdersByEmail(email);
    if (!orderIds.length) {
      return res.status(404).json({ success: false, error: 'No orders found for this email' });
    }
    return await resolveAndReturn(orderIds, 'email', res);
  }

  return res.status(400).json({ success: false, error: 'Provide awb, order, phone, or email' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveAndReturn(orderIds, type, res) {
  try {
    // Fetch AWBs for each order ID
    const { getAwbByOrderId } = await import('../../lib/nimbuspost');
    const records = await Promise.all(orderIds.map(id => getAwbByOrderId(id)));
    const validRecords = records.filter(Boolean);

    if (!validRecords.length) {
      return res.status(404).json({ success: false, error: 'Shipments not yet created for these orders' });
    }

    const awbs = validRecords.map(r => r.awb);
    const trackingMap = await getBulkTracking(awbs);

    const results = validRecords.map(record => {
      const tracking = trackingMap[record.awb] || null;
      return normalizeTracking(record.awb, tracking, record);
    });

    return res.status(200).json({ success: true, type, results });
  } catch (err) {
    console.error('resolveAndReturn error:', err);
    return res.status(500).json({ success: false, error: 'Tracking lookup failed. Please try again.' });
  }
}

/**
 * Normalize NimbusPost tracking response into a consistent shape for the frontend.
 */
function normalizeTracking(awb, tracking, record = {}) {
  // NimbusPost returns scan history as array — newest first
  const scans = Array.isArray(tracking?.scans) ? tracking.scans
    : Array.isArray(tracking)                  ? tracking
    : [];

  const latestScan = scans[0] || {};
  const status     = latestScan.status || tracking?.current_status || 'Processing';
  const statusCode = normalizeStatus(status);

  return {
    orderId:     record.orderId || null,
    awb,
    courierName: record.courierName || tracking?.courier_name || '',
    status,
    statusCode,   // 'pending' | 'picked' | 'transit' | 'out' | 'delivered' | 'failed' | 'rto'
    eta:         tracking?.expected_delivery_date || null,
    scans:       scans.map(s => ({
      status:    s.status || s.activity || '',
      location:  s.location || s.city || '',
      timestamp: s.timestamp || s.date || s.time || '',
      remark:    s.remark || s.description || '',
    })),
  };
}

function normalizeStatus(raw = '') {
  const s = raw.toLowerCase();
  if (s.includes('delivered'))            return 'delivered';
  if (s.includes('out for delivery'))     return 'out';
  if (s.includes('transit') || s.includes('in transit')) return 'transit';
  if (s.includes('picked'))               return 'picked';
  if (s.includes('rto') || s.includes('return')) return 'rto';
  if (s.includes('ndr') || s.includes('undelivered') || s.includes('failed')) return 'failed';
  return 'pending';
}
