/**
 * POST /api/verify-miswak
 * Verifies the ₹50 Razorpay payment for the miswak upsell.
 * 1. HMAC-SHA256 signature check
 * 2. Stores record in KV (miswak:{orderId})
 * 3. Sends owner notification + customer confirmation email
 */
import crypto    from 'crypto';
import { Resend } from 'resend';
import { kv }    from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    orderId, name, mobile, email,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }

  // ── 1. Verify HMAC-SHA256 signature ──────────────────────────────────────
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  // ── 2. Store in KV (180-day TTL) ─────────────────────────────────────────
  try {
    await kv.set(`miswak:${orderId}`, {
      paid:           true,
      paymentId:      razorpay_payment_id,
      razorpayOrder:  razorpay_order_id,
      amount:         50,
      name, mobile, email,
      paidAt:         Date.now(),
    }, { ex: 15552000 });
  } catch (kvErr) {
    console.error('verify-miswak: KV write failed', kvErr);
  }

  // ── 3. Send emails ────────────────────────────────────────────────────────
  const orderDate = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
  });

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Owner notification
    if (process.env.ORDERS_EMAIL) {
      resend.emails.send({
        from:    'Vedayu Orders <orders@vedayulife.com>',
        to:      process.env.ORDERS_EMAIL,
        subject: `🌿 Miswak Add-on — ${orderId} — ₹50 Paid | ${name || ''}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
            <div style="background:#2d6b40;padding:20px 24px;border-radius:8px 8px 0 0;">
              <h2 style="color:#fff;margin:0;font-size:1.1rem;">🌿 Miswak Upsell — ₹50 Paid</h2>
            </div>
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
              <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;width:40%;">Parent Order</td><td style="padding:9px 0;font-family:monospace;font-weight:700;">${orderId || '—'}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Customer</td><td style="padding:9px 0;">${name || '—'}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Mobile</td><td style="padding:9px 0;">${mobile ? `+91 ${mobile}` : '—'}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Add-on</td><td style="padding:9px 0;color:#2d6b40;font-weight:700;">FREE Miswak + ₹50 shipping</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Payment ID</td><td style="padding:9px 0;font-family:monospace;font-size:.82rem;">${razorpay_payment_id}</td></tr>
                <tr><td style="padding:9px 0;font-weight:600;color:#3D2610;">Date</td><td style="padding:9px 0;">${orderDate} IST</td></tr>
              </table>
              <div style="background:#F0F9F3;border-left:4px solid #4A7C59;padding:14px 16px;margin-top:20px;font-size:.85rem;color:#2d6b40;border-radius:0 6px 6px 0;">
                ✅ Please include <strong>1 Miswak stick</strong> in the shipment box for order <strong>${orderId}</strong>.
              </div>
            </div>
            <p style="text-align:center;font-size:.74rem;color:#aaa;margin-top:16px;">Vedayu Wellness · vedayulife.com</p>
          </div>
        `,
      }).catch(err => console.error('verify-miswak: owner email failed', err));
    }

    // Customer confirmation email
    if (email?.trim()) {
      resend.emails.send({
        from:    'Vedayu <orders@vedayulife.com>',
        to:      email.trim(),
        subject: `🌿 FREE Miswak Added to Your Order — ${orderId}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#2d6b40,#4A7C59);padding:28px 24px;border-radius:8px 8px 0 0;text-align:center;">
              <div style="font-size:2.5rem;margin-bottom:8px;">🌿</div>
              <h1 style="color:#fff;margin:0;font-size:1.35rem;">Your FREE Miswak is Coming!</h1>
              <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:.9rem;">Packed in the same box as your glass</p>
            </div>

            <!-- Body -->
            <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:28px;border-radius:0 0 8px 8px;">

              <p style="margin:0 0 20px;font-size:.95rem;">Hi <strong>${name || 'there'}</strong>,</p>
              <p style="margin:0 0 24px;font-size:.95rem;line-height:1.6;">
                Great news! We&apos;ve added a <strong>FREE Premium Miswak</strong> to your order <strong>${orderId}</strong>.
                It will be packed in the same box as your Vijaysar Wooden Glass — no separate delivery!
              </p>

              <!-- What's in the box -->
              <div style="background:#F0F9F3;border:2px solid #4A7C59;border-radius:10px;padding:18px;margin-bottom:24px;">
                <p style="margin:0 0 12px;font-weight:700;color:#2d6b40;font-size:.9rem;">📦 What&apos;s in Your Box</p>
                <p style="margin:0 0 8px;font-size:.88rem;color:#2C1810;">✅ Vedayu Vijaysar Wooden Glass</p>
                <p style="margin:0;font-size:.88rem;color:#2C1810;">🌿 FREE Premium Miswak Stick (₹50 shipping paid)</p>
              </div>

              <!-- How to use miswak -->
              <div style="background:#FFF8E1;border:1px solid #C9A84C;border-radius:10px;padding:16px 18px;margin-bottom:24px;">
                <p style="margin:0 0 10px;font-weight:700;color:#6D4C00;font-size:.88rem;">🪥 How to Use Your Miswak</p>
                <ol style="margin:0;padding-left:18px;line-height:2;font-size:.85rem;color:#6D4C00;">
                  <li>Remove Miswak from its sealed wrapper</li>
                  <li>Peel back the bark from the tip to expose soft natural bristles</li>
                  <li>Brush gently like a toothbrush — no toothpaste needed!</li>
                  <li>Rinse the tip and store in a cool, dry place</li>
                </ol>
              </div>

              <!-- Track CTA -->
              <div style="text-align:center;margin-bottom:8px;">
                <a href="https://vedayulife.com/track?order=${orderId}"
                  style="display:inline-block;background:#5C3D1E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:.9rem;">
                  📦 Track My Order
                </a>
              </div>

            </div>

            <p style="text-align:center;font-size:.72rem;color:#aaa;margin-top:16px;line-height:1.6;">
              Vedayu Wellness · vedayulife.com<br/>
              <em>This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease.</em>
            </p>
          </div>
        `,
      }).catch(err => console.error('verify-miswak: customer email failed', err));
    }
  }

  return res.status(200).json({ success: true });
}
