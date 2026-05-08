/**
 * POST /api/submit-cod
 * Handles Cash on Delivery order submission.
 * Sends an email notification to the store owner via Resend.
 * Returns { success: true } on completion.
 */
import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, mobile, address, city, state, pincode, pack, price, qty } = req.body;

  // Basic server-side validation
  if (!name?.trim() || !mobile?.trim() || !address?.trim() || !pincode?.trim() || !city?.trim() || !state) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!/^[6-9][0-9]{9}$/.test(mobile.trim())) {
    return res.status(400).json({ error: 'Invalid mobile number' });
  }
  if (!/^[1-9][0-9]{5}$/.test(pincode.trim())) {
    return res.status(400).json({ error: 'Invalid pincode' });
  }

  const orderId  = `VED-COD-${Date.now()}`;
  const fullAddr = `${address}, ${city}, ${state} - ${pincode}`;
  const priceStr = '₹' + Number(price).toLocaleString('en-IN');

  // ── Send email via Resend ──────────────────────────────────
  if (process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    'Vedayu Orders <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `🛒 New COD Order — ${pack} — ${priceStr} | ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
            <div style="background:#5C3D1E;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:1.2rem;">🛒 New COD Order — Vedayu</h2>
            </div>
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;width:40%;">Order ID</td><td style="padding:10px 0;">${orderId}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Customer</td><td style="padding:10px 0;">${name}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Mobile</td><td style="padding:10px 0;"><a href="tel:+91${mobile}" style="color:#5C3D1E;">+91 ${mobile}</a></td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">WhatsApp</td><td style="padding:10px 0;"><a href="https://wa.me/91${mobile}" style="color:#25D366;">Chat on WhatsApp</a></td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Address</td><td style="padding:10px 0;">${fullAddr}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:10px 0;">${pack}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Qty</td><td style="padding:10px 0;">${qty} glass(es)</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Amount</td><td style="padding:10px 0;font-size:1.1rem;font-weight:700;color:#5C3D1E;">${priceStr} (COD)</td></tr>
                <tr><td style="padding:10px 0;font-weight:600;color:#3D2610;">Delivery</td><td style="padding:10px 0;color:#4A7C59;font-weight:600;">FREE</td></tr>
              </table>
              <div style="background:#FFF8E1;border-left:4px solid #C9A84C;padding:12px 16px;margin-top:20px;font-size:.82rem;color:#6D4C00;border-radius:0 6px 6px 0;">
                ⚠️ This is a <strong>Cash on Delivery</strong> order. Please dispatch after verifying the address and contact number.
              </div>
            </div>
            <p style="text-align:center;font-size:.74rem;color:#aaa;margin-top:16px;">Vedayu Wellness · vedayulife.myshopify.com</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Don't fail the order if email fails — log and continue
      console.error('Email send failed:', emailErr);
    }
  } else {
    // Log to console if email not configured (useful for dev)
    console.log('=== NEW COD ORDER ===', { orderId, name, mobile, fullAddr, pack, price });
  }

  return res.status(200).json({ success: true, orderId });
}
