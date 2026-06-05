/**
 * POST /api/submit-cod
 * Handles Cash on Delivery order submission.
 * Sends:
 *   1. Order notification email to store owner (always)
 *   2. Order confirmation email to customer (if email provided)
 * Returns { success: true, orderId } on completion.
 */
import { Resend } from 'resend';
import { sendCapiPurchase } from '../../lib/meta-capi';
import { enqueueFollowup } from '../../lib/followup-queue';
import { waOrderConfirmed, waCodVerify } from '../../lib/whatsapp';
import { saveCustomer } from '../../lib/customer-cache';
import { createOrder, storeAwbMapping } from '../../lib/velocity';
import { kv } from '@vercel/kv';
import { isNewCustomer } from './referral-validate';
import { generateOrderId } from '../../lib/orders';
import { supabase } from '../../lib/supabase';

const formatUtm = (utm = {}) => {
  if (!Object.keys(utm).length) return 'Direct / Unknown';
  const parts = [
    utm.source   && `Source: ${utm.source}`,
    utm.medium   && `Medium: ${utm.medium}`,
    utm.campaign && `Campaign: ${utm.campaign}`,
    utm.content  && `Content: ${utm.content}`,
    utm.fbclid   && `fbclid: ${utm.fbclid.slice(0, 16)}…`,
  ].filter(Boolean);
  return parts.join(' · ');
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, mobile, email, address, city, state, pincode, pack, price, qty, utm = {}, referrerId } = req.body;

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
  if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // ── New-customer guard: referral discount only applies to first-time customers.
  //    If the mobile has placed any order before, add the ₹50 discount back. ────
  let safePrice = Number(price);
  if (referrerId) {
    const newCust = await isNewCustomer(mobile.trim());
    if (!newCust) {
      safePrice = Math.round(safePrice + 50);
      console.warn(`Referral discount denied — returning customer (COD): ${mobile.trim()}`);
    }
  }

  const orderId   = await generateOrderId('cod');
  const fullAddr  = `${address}, ${city}, ${state} - ${pincode}`;
  const priceStr  = '₹' + safePrice.toLocaleString('en-IN');
  const orderDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

  if (process.env.RESEND_API_KEY && process.env.ORDERS_EMAIL) {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // ── 1. Store owner notification ───────────────────────────
    try {
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
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;width:40%;">Order ID</td><td style="padding:10px 0;font-family:monospace;font-weight:700;">${orderId}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Date & Time</td><td style="padding:10px 0;">${orderDate} IST</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Customer</td><td style="padding:10px 0;">${name}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Mobile</td><td style="padding:10px 0;"><a href="tel:+91${mobile}" style="color:#5C3D1E;">+91 ${mobile}</a></td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">WhatsApp</td><td style="padding:10px 0;"><a href="https://wa.me/91${mobile}" style="color:#25D366;">Chat on WhatsApp</a></td></tr>
                ${email?.trim() ? `<tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Email</td><td style="padding:10px 0;"><a href="mailto:${email}" style="color:#5C3D1E;">${email}</a></td></tr>` : ''}
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Address</td><td style="padding:10px 0;">${fullAddr}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:10px 0;">${pack}</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Qty</td><td style="padding:10px 0;">${qty} glass(es)</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Amount</td><td style="padding:10px 0;font-size:1.1rem;font-weight:700;color:#5C3D1E;">${priceStr} (COD)</td></tr>
                <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:10px 0;font-weight:600;color:#3D2610;">Delivery</td><td style="padding:10px 0;color:#4A7C59;font-weight:600;">FREE</td></tr>
                <tr><td style="padding:10px 0;font-weight:600;color:#3D2610;">📍 Source</td><td style="padding:10px 0;font-size:.85rem;color:#555;">${formatUtm(utm)}</td></tr>
              </table>
              <div style="background:#FFF8E1;border-left:4px solid #C9A84C;padding:12px 16px;margin-top:20px;font-size:.82rem;color:#6D4C00;border-radius:0 6px 6px 0;">
                ⚠️ This is a <strong>Cash on Delivery</strong> order. Please dispatch after verifying the address and contact number.
              </div>
            </div>
            <p style="text-align:center;font-size:.74rem;color:#aaa;margin-top:16px;">Vedayu Wellness · vedayulife.com</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error('Owner notification email failed:', emailErr);
    }

    // ── 2. Customer confirmation email (only if email provided) ─
    if (email?.trim()) {
      try {
        await resend.emails.send({
          from:    'Vedayu <orders@vedayulife.com>',
          to:      email.trim(),
          subject: `✅ Order Confirmed — ${orderId} | Vedayu Vijaysar Wooden Glass`,
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">

              <!-- Header -->
              <div style="background:#5C3D1E;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:1.4rem;">✅ Order Confirmed!</h1>
                <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:.9rem;">Thank you for ordering from Vedayu</p>
              </div>

              <!-- Body -->
              <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:28px;border-radius:0 0 8px 8px;">

                <p style="margin:0 0 20px;font-size:.95rem;">Hi <strong>${name}</strong>,</p>
                <p style="margin:0 0 24px;font-size:.95rem;line-height:1.6;">
                  Your order has been placed successfully! We will dispatch your Vijaysar Wooden Glass within <strong>1–2 business days</strong>. Please keep <strong>${priceStr}</strong> ready to pay the delivery person.
                </p>

                <!-- Order ID box -->
                <div style="background:#FFF8E1;border:2px solid #C9A84C;border-radius:10px;padding:18px;text-align:center;margin-bottom:24px;">
                  <p style="margin:0 0 6px;font-size:.75rem;font-weight:700;color:#6D4C00;text-transform:uppercase;letter-spacing:1px;">Your Order ID</p>
                  <p style="margin:0 0 8px;font-size:1.3rem;font-weight:800;color:#5C3D1E;font-family:monospace;letter-spacing:2px;">${orderId}</p>
                  <p style="margin:0;font-size:.75rem;color:#6D4C00;">Save this ID — use it to track or enquire about your order</p>
                </div>

                <!-- Order details -->
                <table style="width:100%;border-collapse:collapse;font-size:.88rem;margin-bottom:24px;">
                  <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;width:45%;">Product</td><td style="padding:9px 0;">Vedayu Vijaysar Wooden Glass</td></tr>
                  <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Pack</td><td style="padding:9px 0;">${pack}</td></tr>
                  <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Amount to Pay</td><td style="padding:9px 0;font-weight:700;color:#5C3D1E;">${priceStr} (Cash on Delivery)</td></tr>
                  <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Delivery</td><td style="padding:9px 0;color:#4A7C59;font-weight:600;">FREE</td></tr>
                  <tr style="border-bottom:1px solid #f0e8d8;"><td style="padding:9px 0;font-weight:600;color:#3D2610;">Deliver To</td><td style="padding:9px 0;">${fullAddr}</td></tr>
                  <tr><td style="padding:9px 0;font-weight:600;color:#3D2610;">Order Date</td><td style="padding:9px 0;">${orderDate} IST</td></tr>
                </table>

                <!-- How to use -->
                <div style="background:#F0F9F3;border:1px solid #4A7C59;border-radius:8px;padding:16px 18px;margin-bottom:24px;">
                  <p style="margin:0 0 10px;font-weight:700;color:#2d6b40;font-size:.88rem;">📋 How to Use Your Vijaysar Glass</p>
                  <ol style="margin:0;padding-left:18px;line-height:2;font-size:.85rem;color:#2d6b40;">
                    <li>Fill with room temperature water at night</li>
                    <li>Keep overnight for 6–8 hours</li>
                    <li>Drink the infused water first thing in the morning</li>
                    <li>Rinse with plain water only &amp; dry after each use</li>
                  </ol>
                </div>

                <!-- Track order CTA -->
                <div style="text-align:center;margin-bottom:16px;">
                  <a href="https://vedayulife.com/track?order=${orderId}"
                    style="display:inline-block;background:#5C3D1E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:.9rem;">
                    📦 Track My Order
                  </a>
                </div>

                <!-- WhatsApp CTA -->
                <div style="text-align:center;margin-bottom:8px;">
                  <a href="https://wa.me/91${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999'}?text=Hi%20Vedayu!%20My%20order%20ID%20is%20${orderId}.%20I%20have%20a%20query."
                    style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:.9rem;">
                    💬 WhatsApp Us for Order Updates
                  </a>
                </div>

              </div>

              <p style="text-align:center;font-size:.72rem;color:#aaa;margin-top:16px;line-height:1.6;">
                Vedayu Wellness · vedayulife.com<br/>
                <em>This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease.</em>
              </p>
            </div>
          `,
        });
      } catch (customerEmailErr) {
        // Don't fail the order if customer email fails
        console.error('Customer confirmation email failed:', customerEmailErr);
      }
    }

  } else {
    console.log('=== NEW COD ORDER ===', { orderId, name, mobile, email, fullAddr, pack, price });
  }

  // ── Meta CAPI — server-side Purchase event ──────────────────────────────────────
  await sendCapiPurchase({ orderId, price: safePrice, pack, qty, email, mobile: mobile.trim(), name, city, pincode }).catch(() => {});

  // ── Post-purchase follow-up email queue ──────────────────────────────────────
  await enqueueFollowup({ orderId, email, name, pack, price: safePrice, method: 'cod', mobile: mobile.trim() }).catch(() => {});
  await saveCustomer({ mobile, email, name, address, city, state, pincode }).catch(() => {});

  // ── WhatsApp — instant order confirmation ────────────────────────────────────
  await waOrderConfirmed({ mobile: mobile.trim(), name, pack, orderId, price: safePrice }).catch(() => {});

  // ── Velocity Shipping — push order to dashboard for auto-dispatch ────────────
  // Must be awaited before res.json() — Vercel kills the function once the response
  // is sent, so fire-and-forget promises are cut off and orders never reach Velocity.
  if (process.env.VELOCITY_USERNAME && process.env.VELOCITY_PASSWORD && process.env.VELOCITY_WAREHOUSE_ID) {
    try {
      const result = await createOrder({
        orderId, name, mobile: mobile.trim(), address, city, state, pincode,
        email: email?.trim() || undefined,
        pack, qty, price: safePrice, is_cod: true,
      });
      console.log(`Velocity order created: ${orderId}`, result);
      if (result?.awb) {
        await storeAwbMapping({
          orderId, awb: result.awb, shipmentId: result.shipmentId,
          mobile: mobile.trim(), email: email?.trim() || undefined,
          courierName: result.courierName, name,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Velocity order push failed (order still placed):', err.message);
    }
  }

  // ── Referral tracking ────────────────────────────────────────────────────
  // Store this order's mobile as the referral owner so future self-referral checks work
  kv.set(`referral:owner:${orderId}`, mobile.trim(), { ex: 15552000 }).catch(() => {});
  if (referrerId) {
    kv.set(`referral:used:${orderId}`, { referrerId, discount: 50, method: 'cod', at: Date.now() }, { ex: 15552000 }).catch(() => {});
  }

  // ── Persist order to Supabase ────────────────────────────────────────────
  if (supabase) {
    await supabase.from('orders').insert({
      order_id:    orderId,
      method:      'cod',
      status:      'pending',
      name,
      mobile:      mobile.trim(),
      email:       email?.trim() || null,
      address,
      city,
      state,
      pincode,
      pack,
      qty:         Number(qty),
      price:       safePrice,
      utm:         Object.keys(utm).length ? utm : null,
      referrer_id: referrerId || null,
    }).catch(err => console.error('orders insert failed:', err.message));
  }

  // ── COD verification — store record and send WhatsApp ───────────────────
  const normalised = mobile.trim().startsWith('91') ? mobile.trim() : `91${mobile.trim()}`;
  if (supabase) {
    await supabase.from('cod_verifications').insert({
      order_id: orderId,
      mobile:   normalised,
      name,
      status:   'pending',
    }).catch(err => console.error('cod_verifications insert failed:', err.message));
  }

  await kv.set(`cod_verify:${normalised}`, {
    orderId, name, pack, price: safePrice, status: 'pending', createdAt: Date.now(),
  }, { ex: 172800 }).catch(() => {});

  await waCodVerify({
    mobile: mobile.trim(), name, orderId, pack, price: safePrice, address: fullAddr,
  }).catch(() => {});

  return res.status(200).json({ success: true, orderId });
}
