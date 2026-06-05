/**
 * POST /api/nimbuspost/webhook
 *
 * NimbusPost pushes real-time status updates here.
 * Configure this URL in your NimbusPost dashboard → Settings → Webhooks.
 *
 * Events handled:
 *  - picked_up         → update KV
 *  - in_transit        → update KV
 *  - out_for_delivery  → update KV
 *  - delivered         → update KV (follow-up email is already scheduled via queue)
 *  - ndr               → update KV, log for manual action
 *  - rto_initiated     → update KV, notify owner
 *  - rto_delivered     → update KV
 */

import { kv } from '@vercel/kv';
import { Resend } from 'resend';
import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Optional: verify webhook secret header
  const secret = process.env.NIMBUSPOST_WEBHOOK_SECRET;
  if (secret) {
    const incomingSecret = req.headers['x-nimbuspost-secret'] || req.headers['x-webhook-secret'];
    if (incomingSecret !== secret) {
      console.warn('NimbusPost webhook: invalid secret');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const body = req.body;
  const awb    = body?.awb    || body?.tracking_number;
  const status = body?.status || body?.current_status;

  if (!awb || !status) {
    return res.status(400).json({ error: 'Missing awb or status' });
  }

  console.log(`NimbusPost webhook: AWB=${awb} STATUS=${status}`);

  const s = status.toLowerCase();

  // Update shipment status in KV (for tracking page)
  try {
    const existing = await kv.get(`nimbuspost:awb:${awb}`);
    await kv.set(`nimbuspost:awb:${awb}`, {
      ...(existing || {}),
      awb,
      status,
      lastUpdated: new Date().toISOString(),
      rawEvent: body,
    }, { ex: 15552000 });

    // Write status back to orders table so admin panel shows live tracking
    if (supabase) {
      const updates = { updated_at: new Date().toISOString() };
      if (s.includes('delivered'))                         { updates.status = 'delivered'; updates.delivered_at = new Date().toISOString(); }
      else if (s.includes('rto'))                          { updates.status = 'returned';  updates.returned_at  = new Date().toISOString(); }
      else if (s.includes('sent') || s.includes('picked')) { updates.status = 'sent';      updates.sent_at      = new Date().toISOString(); }

      if (Object.keys(updates).length > 1) {
        const orderRecord = await kv.get(`nimbuspost:awb_to_order:${awb}`).catch(() => null);
        if (orderRecord?.orderId) {
          await supabase.from('orders').update(updates).eq('order_id', orderRecord.orderId).catch(() => {});
        } else if (awb) {
          await supabase.from('orders').update(updates).eq('awb', awb).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Webhook KV update error:', err);
  }

  // ── Handle specific events ────────────────────────────────────────────────

  // RTO — notify store owner
  if (s.includes('rto') && process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Try to get order ID from KV
      const orderRecord = await kv.get(`nimbuspost:awb_to_order:${awb}`).catch(() => null);
      const orderId = orderRecord?.orderId || 'Unknown';
      const customerName = orderRecord?.name || '';

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
                Log into <a href="https://ship.nimbuspost.com" style="color:#5C3D1E;">NimbusPost dashboard</a> to take NDR action — re-attempt, address change, or confirm RTO.
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('RTO email failed:', emailErr);
    }
  }

  // NDR — log for follow-up (NimbusPost handles WhatsApp nudge automatically)
  if (s.includes('ndr') || s.includes('undelivered')) {
    console.log(`NDR event for AWB ${awb}:`, body);
    // NimbusPost's automated NDR workflow handles WhatsApp + IVR retry.
    // Nothing else needed here unless you want custom logic.
  }

  return res.status(200).json({ received: true });
}
