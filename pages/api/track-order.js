/**
 * GET /api/track-order?awb=XXX
 * GET /api/track-order?order=VED-COD-XXX
 * GET /api/track-order?phone=9876543210
 * GET /api/track-order?email=customer@example.com
 *
 * Returns tracking info for one or more Velocity shipments.
 * Public endpoint — order IDs are already unguessable.
 */

import {
  getTracking,
  getAwbByOrderId,
  getOrdersByPhone,
  getOrdersByEmail,
} from '../../lib/velocity';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { awb, order, phone, email } = req.query;

  // ── 1. Track by AWB directly ──────────────────────────────────────────────
  if (awb) {
    try {
      const trackMap = await getTracking(awb.trim());
      const trackData = trackMap[awb.trim()]?.tracking_data || null;
      if (!trackData) return res.status(404).json({ success: false, error: 'No shipment found for AWB: ' + awb });
      return res.status(200).json({ success: true, type: 'awb', results: [normalizeTracking(awb, trackData)] });
    } catch (err) {
      return res.status(404).json({ success: false, error: 'Tracking lookup failed: ' + err.message });
    }
  }

  // ── 2. Track by Order ID ──────────────────────────────────────────────────
  if (order) {
    const record = await getAwbByOrderId(order.trim().toUpperCase());
    if (!record?.awb) {
      return res.status(404).json({ success: false, error: 'No shipment found for Order ID: ' + order });
    }
    try {
      const trackMap  = await getTracking(record.awb);
      const trackData = trackMap[record.awb]?.tracking_data || null;
      return res.status(200).json({
        success: true,
        type:    'order',
        results: [normalizeTracking(record.awb, trackData, record)],
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
    return resolveAndReturn(orderIds, 'phone', res);
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
    return resolveAndReturn(orderIds, 'email', res);
  }

  return res.status(400).json({ success: false, error: 'Provide awb, order, phone, or email' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveAndReturn(orderIds, type, res) {
  try {
    const records      = await Promise.all(orderIds.map(id => getAwbByOrderId(id)));
    const validRecords = records.filter(r => r?.awb);

    if (!validRecords.length) {
      return res.status(404).json({ success: false, error: 'Shipments not yet dispatched for these orders' });
    }

    const awbs     = validRecords.map(r => r.awb);
    const trackMap = await getTracking(awbs);

    const results = validRecords.map(record => {
      const trackData = trackMap[record.awb]?.tracking_data || null;
      return normalizeTracking(record.awb, trackData, record);
    });

    return res.status(200).json({ success: true, type, results });
  } catch (err) {
    console.error('resolveAndReturn error:', err);
    return res.status(500).json({ success: false, error: 'Tracking lookup failed. Please try again.' });
  }
}

/**
 * Normalize Velocity tracking response into a consistent shape for the frontend.
 * Velocity response shape:
 *   tracking_data: {
 *     shipment_status: "delivered",
 *     shipment_track: [{ current_status, pickup_date, delivered_date, ... }],
 *     shipment_track_activities: [{ date, activity, location }],
 *     track_url: "..."
 *   }
 */
function normalizeTracking(awb, trackData, record = {}) {
  const activities = trackData?.shipment_track_activities || [];
  const shipment   = trackData?.shipment_track?.[0] || {};
  const status     = trackData?.shipment_status || shipment.current_status || 'Processing';
  const statusCode = normalizeStatus(status);

  return {
    orderId:     record.orderId     || null,
    awb,
    courierName: record.courierName || shipment.courier_name || '',
    status,
    statusCode, // 'pending' | 'picked' | 'transit' | 'out' | 'delivered' | 'failed' | 'rto'
    eta:         shipment.delivered_date || null,
    trackUrl:    trackData?.track_url   || `https://shipfastt.in/track/${awb}`,
    scans: activities.map(a => ({
      status:    a.activity  || '',
      location:  a.location  || '',
      timestamp: a.date      || '',
      remark:    '',
    })),
  };
}

function normalizeStatus(raw = '') {
  const s = raw.toLowerCase().replace(/_/g, ' ');
  if (s.includes('delivered') && !s.includes('rto'))    return 'delivered';
  if (s.includes('out for delivery'))                   return 'out';
  if (s.includes('in transit') || s.includes('transit')) return 'transit';
  if (s.includes('picked'))                             return 'picked';
  if (s.includes('rto'))                                return 'rto';
  if (s.includes('ndr') || s.includes('undelivered') || s.includes('failed')) return 'failed';
  return 'pending';
}
