/**
 * POST /api/velocity/webhook
 *
 * Velocity Shipping pushes real-time status updates here.
 * Configure this URL in your Velocity dashboard → Settings → Webhooks.
 *
 * Events handled:
 *  - ready_for_pickup   → log
 *  - in_transit         → update KV
 *  - out_for_delivery   → update KV
 *  - delivered          → update KV
 *  - ndr_raised         → update KV, log for manual action
 *  - rto_initiated      → update KV, email store owner
 *  - rto_delivered      → update KV
 *
 * Velocity webhook docs: Settings → Webhooks in the Velocity dashboard
 */

import { kv } from '@vercel/kv';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Optional: verify a shared secret header
  const secret = process.env.VELOCITY_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-velocity-secret'] || req.headers['x-webhook-secret'];
    if (incoming !== secret) {
      console.warn('Velocity webhook: invalid secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const body = req.body || {};
  const awb    = body.awb_code || body.awb || body.tracking_number;
  const status = body.current_status || body.status || body.shipment_status;

  if (!awb || !status) {
    console.warn('Velocity webhook: missing awb or status', body);
    return res.status(400).json({ error: 'Missing awb or status' });
  }

  console.log(`Velocity webhook: AWB=${awb} STATUS=${status}`, body);

  // ── Update shipment status cache in KV ────────────────────────────────────
  try {
    const existing = await kv.get(`velocity:awb:${awb}`).catch(() => null);
    await kv.set(`velocity:awb:${awb}`, {
      ...(existing || {}),
      awb,
      status,
      lastUpdated: new Date().toISOString(),
      rawEvent:    body,
    }, { ex: 15552000 });
  } catch (err) {
    console.error('Velocity webhook KV update error:', err);
  }

  const s = String(status).toLowerCase();

  // ── RTO — notify store owner ───────────────────────────────────────────────
  if ((s.includes('rto') || s === 'rto_initiated') && process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Try to resolve orderId from AWB
      const orderRecord = await kv.get(`velocity:awb_to_order:${awb}`).catch(() => null);
      const orderId      = orderRecord?.orderId || body.order_id || 'Unknown';
      const customerName = orderRecord?.name   || body.consignee_name || '';

      await resend.emails.send({
        from:    'Vedayu System <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `⚠️ RTO Alert — AWB ${awb}${orderId !== 'Unknown' ? ` | ${orderId}` : ''}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
            <div style="background:#c0392b;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;">⚠️ RTO Initiated — Vedayu</h2>
            </div>
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;width:40%;">Order ID</td><td style="padding:10px 0;font-family:monospace;">${orderId}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">AWB</td><td style="padding:10px 0;font-family:monospace;">${awb}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Customer</td><td style="padding:10px 0;">${customerName}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;">Status</td><td style="padding:10px 0;color:#c0392b;font-weight:700;">${status}</td></tr>
                <tr><td style="padding:10px 0;font-weight:600;">Time</td><td style="padding:10px 0;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              </table>
              <div style="background:#FFF8E1;border-left:4px solid #e67e22;padding:12px 16px;margin-top:20px;font-size:.85rem;color:#6D4C00;border-radius:0 6px 6px 0;">
                Log into the <a href="https://shazam.velocity.in" style="color:#5C3D1E;">Velocity Shipping dashboard</a> to take action — re-attempt, address change, or confirm RTO.
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('RTO email failed:', emailErr);
    }
  }

  // ── NDR — log for follow-up ────────────────────────────────────────────────
  if (s === 'ndr_raised' || s.includes('ndr')) {
    console.log(`NDR event for AWB ${awb}:`, body);
  }

  return res.status(200).json({ received: true });
}
