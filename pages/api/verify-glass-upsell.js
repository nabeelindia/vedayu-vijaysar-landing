/**
 * POST /api/verify-glass-upsell
 * 1. HMAC-SHA256 signature check
 * 2. Fetch parent order for shipping address
 * 3. Insert one orders row per selected glass (each with parent_order_id)
 * 4. Send owner email
 */
import crypto            from 'crypto';
import { Resend }        from 'resend';
import { createClient }  from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderId,       // parent order ID
    glasses,       // [{ glass: 2, price: 399 }, ...]
    name, mobile, email,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }
  if (!orderId || !Array.isArray(glasses) || glasses.length === 0) {
    return res.status(400).json({ error: 'orderId and glasses[] are required' });
  }

  // ── 1. Verify HMAC-SHA256 ───────────────────────────────────────────────
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  // ── 2. Fetch parent order for shipping address ──────────────────────────
  const { data: parent, error: fetchErr } = await supabase
    .from('orders')
    .select('name,mobile,email,address,area,landmark,city,state,pincode,utm')
    .eq('order_id', orderId)
    .single();

  if (fetchErr || !parent) {
    console.error('verify-glass-upsell: parent order not found', fetchErr);
    return res.status(400).json({ error: 'Parent order not found' });
  }

  // ── 3. Insert one row per glass (FIRST — before emails) ─────────────────
  const ts         = Date.now();
  const upsellRows = glasses.map((g, i) => ({
    order_id:            `GUPS-${ts}-${i}-${Math.random().toString(36).slice(2,5).toUpperCase()}`,
    parent_order_id:     orderId,
    method:              'prepaid',
    status:              'confirmed',
    name:                parent.name,
    mobile:              parent.mobile,
    email:               parent.email || email || null,
    address:             parent.address,
    area:                parent.area     || null,
    landmark:            parent.landmark || null,
    city:                parent.city,
    state:               parent.state,
    pincode:             parent.pincode,
    pack:                `Glass Add-on × 1 (${g.glass} glass)`,
    qty:                 1,
    price:               Number(g.price),
    utm:                 parent.utm || null,
    // Only first row gets the payment ID (dedup key); rest link via parent_order_id
    razorpay_payment_id: i === 0 ? razorpay_payment_id : null,
  }));

  const { error: insertErr } = await supabase.from('orders').insert(upsellRows);

  if (insertErr) {
    console.error('verify-glass-upsell: CRITICAL — DB insert failed', insertErr);
    return res.status(500).json({ error: 'Order save failed' });
  }

  // ── 4. Owner notification email ─────────────────────────────────────────
  if (process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    const resend    = new Resend(process.env.RESEND_API_KEY);
    const total     = glasses.reduce((s, g) => s + Number(g.price), 0);
    const glassDesc = glasses.map(g => `${g.glass} glass — ₹${g.price}`).join(', ');
    const orderDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
    });

    resend.emails.send({
      from:    'Vedayu Orders <orders@vedayulife.com>',
      to:      process.env.ORDERS_EMAIL,
      subject: `🫙 Glass Add-on — ${orderId} — ₹${total} Paid | ${parent.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
          <div style="background:#5C3D1E;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;font-size:1.1rem;">🫙 Glass Add-on — ₹${total} Paid</h2>
          </div>
          <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
              <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;width:40%;">Parent Order</td><td style="padding:9px 0;font-family:monospace;font-weight:700;">${orderId}</td></tr>
              <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;">Customer</td><td style="padding:9px 0;">${parent.name}</td></tr>
              <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;">Mobile</td><td style="padding:9px 0;">+91 ${parent.mobile}</td></tr>
              <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;">Glasses Added</td><td style="padding:9px 0;color:#5C3D1E;font-weight:700;">${glassDesc}</td></tr>
              <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;">Total Paid</td><td style="padding:9px 0;font-weight:700;">₹${total}</td></tr>
              <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;">Payment ID</td><td style="padding:9px 0;font-family:monospace;font-size:.82rem;">${razorpay_payment_id}</td></tr>
              <tr><td style="padding:9px 0;font-weight:600;">Date</td><td style="padding:9px 0;">${orderDate} IST</td></tr>
            </table>
            <div style="background:#FFF8E1;border-left:4px solid #C9A84C;padding:14px 16px;margin-top:20px;font-size:.85rem;color:#6D4C00;border-radius:0 6px 6px 0;">
              ✅ Please include <strong>${glasses.length} extra Vijaysar glass${glasses.length > 1 ? 'es' : ''}</strong> in the shipment box for order <strong>${orderId}</strong>.
            </div>
          </div>
        </div>
      `,
    }).catch(err => console.error('verify-glass-upsell: owner email failed', err));
  }

  return res.status(200).json({ success: true });
}
