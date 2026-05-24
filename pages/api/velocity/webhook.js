/**
 * POST /api/velocity/webhook
 *
 * Receives real-time shipment events from Velocity Shipping (Shipfast).
 * Register this URL in: Velocity dashboard → Settings → Webhooks
 * Subscribe to: Status Change, Tracking Addition (and QC Update if needed)
 * Authentication Method: None (or API Key if you set VELOCITY_WEBHOOK_SECRET)
 *
 * Velocity must receive HTTP 200 within 10 seconds or it retries up to 3×.
 *
 * IP whitelist (Velocity's outbound IPs):
 *   15.207.255.190
 *   13.202.145.74
 *
 * ─── Payload shapes ────────────────────────────────────────────────────────
 *
 * Status Change:
 * {
 *   event: "status_change",
 *   event_id: "...",
 *   event_timestamp: "2025-12-18T16:46:11+05:30",
 *   data: {
 *     shipment_id: "SHI...",
 *     tracking_number: "PD9148818",      ← AWB
 *     order_id: "ORD...",               ← Velocity internal ID
 *     order_external_id: "VED-COD-...", ← our orderId
 *     status: "delivered",
 *     sub_status: "",
 *     carrier_name: "Pikndel",
 *     ndr_reason: "",
 *     estimated_delivery_date: "...",
 *     original_edd: "",
 *     shipment_type: "forward",
 *     tracking_url: "https://shipfastt.in/track/PD9148818"
 *   }
 * }
 *
 * Tracking Addition:
 * {
 *   event: "tracking_addition",
 *   data: {
 *     tracking_number: "...", order_external_id: "...", status: "...",
 *     new_tracking: { tracking_id, event_date_time, location, remarks },
 *     tracking_url: "..."
 *   }
 * }
 *
 * QC Update: event: "qc_update" (not used for forward orders)
 */

import { kv } from '@vercel/kv';
import { Resend } from 'resend';

export default async function handler(req, res) {
  // Must return 200 fast — Velocity times out after 10 seconds
  if (req.method !== 'POST') return res.status(405).end();

  // Optional API key auth (set Authentication Method = API Key in Velocity dashboard
  // and add the same key as VELOCITY_WEBHOOK_SECRET in Vercel env vars)
  const secret = process.env.VELOCITY_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-api-key'] || req.headers['authorization'] || req.headers['x-webhook-secret'];
    if (incoming !== secret) {
      console.warn('Velocity webhook: auth mismatch');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const body       = req.body || {};
  const event      = body.event;                           // "status_change" | "tracking_addition" | "qc_update"
  const data       = body.data || {};
  const awb        = data.tracking_number;                 // courier AWB e.g. "PD9148818"
  const orderId    = data.order_external_id;               // our ID e.g. "VED-COD-1748000000000"
  const status     = data.status;                          // e.g. "delivered"
  const eventId    = body.event_id;

  if (!event || !awb) {
    console.warn('Velocity webhook: missing event or tracking_number', body);
    return res.status(400).json({ error: 'Missing event or tracking_number' });
  }

  console.log(`Velocity webhook [${event}] AWB=${awb} orderId=${orderId} status=${status} eventId=${eventId}`);

  // ── Handle each event type ────────────────────────────────────────────────

  if (event === 'status_change') {
    await handleStatusChange({ awb, orderId, status, data });
  } else if (event === 'tracking_addition') {
    await handleTrackingAddition({ awb, orderId, status, data });
  } else if (event === 'qc_update') {
    // QC only applies to returns — log only
    console.log(`Velocity QC update AWB=${awb} status=${data.qc_status}`);
  }

  // Always return 200 quickly
  return res.status(200).json({ received: true });
}

// ─── Status Change ────────────────────────────────────────────────────────────

async function handleStatusChange({ awb, orderId, status, data }) {
  const s = String(status).toLowerCase();

  // Update shipment status in KV
  try {
    const existing = await kv.get(`velocity:awb:${awb}`).catch(() => null);
    await kv.set(`velocity:awb:${awb}`, {
      ...(existing || {}),
      awb,
      orderId:     orderId || existing?.orderId || null,
      status,
      carrierName: data.carrier_name || existing?.carrierName || '',
      trackingUrl: data.tracking_url || '',
      edd:         data.estimated_delivery_date || null,
      ndrReason:   data.ndr_reason || null,
      lastUpdated: new Date().toISOString(),
    }, { ex: 15552000 });
  } catch (err) {
    console.error('Velocity webhook KV update error:', err);
  }

  // ── RTO alert → email owner ────────────────────────────────────────────────
  if (s === 'rto_initiated' && process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Resolve customer name from KV if we have the orderId
      let customerName = '';
      if (orderId) {
        const orderRecord = await kv.get(`velocity:order:${orderId}`).catch(() => null);
        customerName = orderRecord?.name || '';
      }

      await resend.emails.send({
        from:    'Vedayu System <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `⚠️ RTO Initiated — ${orderId || awb}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
            <div style="background:#c0392b;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;">⚠️ RTO Initiated — Vedayu</h2>
            </div>
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;width:40%;">Order ID</td><td style="padding:10px 0;font-family:monospace;">${orderId || '—'}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">AWB</td><td style="padding:10px 0;font-family:monospace;">${awb}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Carrier</td><td style="padding:10px 0;">${data.carrier_name || '—'}</td></tr>
                ${customerName ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Customer</td><td style="padding:10px 0;">${customerName}</td></tr>` : ''}
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Status</td><td style="padding:10px 0;color:#c0392b;font-weight:700;">RTO Initiated</td></tr>
                <tr><td style="padding:10px 0;font-weight:600;">Time</td><td style="padding:10px 0;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              </table>
              <div style="background:#FFF8E1;border-left:4px solid #e67e22;padding:12px 16px;margin-top:20px;font-size:.85rem;color:#6D4C00;border-radius:0 6px 6px 0;">
                Log into the <a href="https://shazam.velocity.in" style="color:#5C3D1E;">Velocity Shipping dashboard</a> to take action — re-attempt delivery, update address, or confirm RTO.
              </div>
            </div>
          </div>
        `,
      });
      console.log(`RTO email sent for ${orderId || awb}`);
    } catch (emailErr) {
      console.error('RTO email failed:', emailErr);
    }
  }

  // ── NDR — log for manual follow-up ────────────────────────────────────────
  if (s === 'ndr_raised' || s === 'need_attention') {
    console.log(`NDR raised: AWB=${awb} orderId=${orderId} reason=${data.ndr_reason || 'unknown'}`);
    // Velocity's built-in NDR workflow handles automated re-attempt prompts.
    // Add custom logic here if needed (e.g. WhatsApp nudge, Slack alert).
  }
}

// ─── Tracking Addition ────────────────────────────────────────────────────────

async function handleTrackingAddition({ awb, orderId, status, data }) {
  // Append the new tracking event to the AWB's KV record
  try {
    const key      = `velocity:awb:${awb}`;
    const existing = await kv.get(key).catch(() => null);
    const events   = existing?.trackingEvents || [];

    events.unshift({                       // newest first
      timestamp: data.new_tracking?.event_date_time || new Date().toISOString(),
      location:  data.new_tracking?.location  || '',
      remarks:   data.new_tracking?.remarks   || '',
    });

    await kv.set(key, {
      ...(existing || { awb, orderId }),
      status,
      trackingUrl:    data.tracking_url || existing?.trackingUrl || '',
      trackingEvents: events.slice(0, 50), // keep last 50 events
      lastUpdated:    new Date().toISOString(),
    }, { ex: 15552000 });
  } catch (err) {
    console.error('Velocity webhook tracking KV error:', err);
  }
}
