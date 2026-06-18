/**
 * POST /api/razorpay-webhook
 * Razorpay server-to-server webhook — safety net for prepaid orders.
 *
 * Fires independently of the browser. If verify-payment times out or the
 * client disconnects after payment, this catches the payment.captured event
 * and persists the order. Uses razorpay_payment_id as a dedup key so a
 * successful verify-payment + webhook arrival both arrive safely.
 *
 * Setup: Razorpay Dashboard → Settings → Webhooks → add your URL and set
 * RAZORPAY_WEBHOOK_SECRET env var to the generated secret.
 * Event: payment.captured
 */
export const config = {
  api: { bodyParser: false }, // need raw body for HMAC verification
  maxDuration: 10,
};

import crypto from 'crypto';
import { supabase } from '../../lib/supabase';
import { generateOrderId } from '../../lib/orders';
import { sendPush } from '../../lib/push';
import { waOrderConfirmed } from '../../lib/whatsapp';

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const signature = req.headers['x-razorpay-signature'];

  // Verify webhook signature
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set — rejecting webhook');
    return res.status(500).end();
  }

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSig !== signature) {
    console.warn('Razorpay webhook signature mismatch — rejected');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Only handle payment.captured
  if (event.event !== 'payment.captured') {
    return res.status(200).json({ received: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) return res.status(200).json({ received: true });

  const paymentId = payment.id;
  const notes = payment.notes || {};
  const amount = payment.amount; // paise

  // Check if order already saved by verify-payment (dedup by payment_id)
  const { data: existing } = await supabase
    .from('orders')
    .select('order_id')
    .eq('razorpay_payment_id', paymentId)
    .maybeSingle();

  if (existing) {
    // Already saved by verify-payment — nothing to do
    return res.status(200).json({ received: true, already_saved: existing.order_id });
  }

  // Order not in DB — insert it now (verify-payment must have failed/timed out)
  console.warn(`Webhook recovery: ${paymentId} not in DB — inserting order from notes`);

  // Extract fields from Razorpay order notes (set during create-order)
  const name    = notes.customer_name || notes.customer || payment.description || 'Unknown';
  const mobile  = notes.mobile?.replace(/\D/g, '').slice(-10) || '';
  const email   = notes.email?.trim() || null;
  const address = notes.address_line || notes.address || '';
  const city    = notes.city || '';
  const state   = notes.state || '';
  const pincode = notes.pincode || '';
  const pack    = notes.pack || '';
  const qty     = Number(notes.qty) || 1;
  const price   = Math.round((amount || 0) / 100);

  const orderId = await generateOrderId('prepaid');

  const { error: insertErr } = await supabase.from('orders').insert({
    order_id:            orderId,
    method:              'prepaid',
    status:              'confirmed',
    name,
    mobile:              mobile || null,
    email,
    address:             address || '(see Razorpay notes)',
    city:                city || '—',
    state:               state || '—',
    pincode:             pincode || '—',
    pack:                pack || '—',
    qty,
    price,
    razorpay_payment_id: paymentId,
  });

  if (insertErr) {
    console.error('Webhook recovery insert FAILED:', insertErr.message, paymentId);
    await sendPush({
      title: `🚨 Webhook insert failed — ${name || paymentId}`,
      body: `${insertErr.message} | ${paymentId}`,
    }).catch(() => {});
    return res.status(500).json({ error: 'DB insert failed' });
  }

  // Alert admin that we recovered a missed order
  await Promise.allSettled([
    sendPush({
      title: `⚠️ Webhook recovered order — ${name}`,
      body: `${pack} · ₹${price} · ${paymentId} → ${orderId}`,
    }),
    mobile
      ? waOrderConfirmed({ mobile, name, pack, orderId, price, method: 'prepaid' })
      : Promise.resolve(),
  ]);

  console.log(`Webhook recovery success: ${paymentId} → ${orderId}`);
  return res.status(200).json({ received: true, recovered: orderId });
}
