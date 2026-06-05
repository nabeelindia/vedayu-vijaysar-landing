import { supabase } from '../../../lib/supabase';
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.NIMBUSPOST_WEBHOOK_SECRET;
  if (secret) {
    const incomingSecret = req.headers['x-nimbuspost-secret'] || req.headers['x-webhook-secret'];
    if (incomingSecret !== secret) return res.status(401).json({ error: 'Unauthorized' });
  }

  const body   = req.body;
  const awb    = body?.awb    || body?.tracking_number;
  const status = body?.status || body?.current_status;

  if (!awb || !status) return res.status(400).json({ error: 'Missing awb or status' });

  console.log(`NimbusPost webhook: AWB=${awb} STATUS=${status}`);

  const s = status.toLowerCase();

  // Upsert shipment status
  await supabase.from('shipments').upsert({
    awb,
    status,
    last_updated_at: new Date().toISOString(),
    raw_event:       body,
  }, { onConflict: 'awb' }).catch(err => console.error('Webhook shipments upsert error:', err));

  // Write status back to orders table
  const statusUpdates = { updated_at: new Date().toISOString() };
  if (s.includes('delivered'))                          { statusUpdates.status = 'delivered'; statusUpdates.delivered_at = new Date().toISOString(); }
  else if (s.includes('rto'))                           { statusUpdates.status = 'returned';  statusUpdates.returned_at  = new Date().toISOString(); }
  else if (s.includes('sent') || s.includes('picked'))  { statusUpdates.status = 'sent';      statusUpdates.sent_at      = new Date().toISOString(); }

  if (Object.keys(statusUpdates).length > 1) {
    await supabase.from('orders').update(statusUpdates).eq('awb', awb).then(() => {}, () => {});
  }

  // RTO — notify owner
  if (s.includes('rto') && process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const { data: shipment } = await supabase
        .from('shipments').select('order_id, name').eq('awb', awb).maybeSingle();

      const orderId      = shipment?.order_id || 'Unknown';
      const customerName = shipment?.name     || '';

      const resend = new Resend(process.env.RESEND_API_KEY);
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
                Log into <a href="https://ship.nimbuspost.com" style="color:#5C3D1E;">NimbusPost dashboard</a> to take NDR action.
              </div>
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('RTO email failed:', emailErr);
    }
  }

  return res.status(200).json({ received: true });
}
