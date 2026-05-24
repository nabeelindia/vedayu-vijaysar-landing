/**
 * Post-purchase follow-up email queue using Vercel KV (Redis).
 *
 * Storage structure:
 *   followup:active          — Redis SET of all active order IDs
 *   followup:{orderId}       — JSON with customer data + which emails sent
 *
 * Follow-up schedule:
 *   Day 3  — "Your order is on its way" dispatch nudge
 *   Day 7  — "First week with your Vijaysar glass" usage tips
 *   Day 30 — "One month in" check-in + review request
 *   Day 90 — "90-day ritual complete" + Family Pack upsell
 */

import { kv } from '@vercel/kv';

const ACTIVE_SET = 'followup:active';
const MS_PER_DAY = 86_400_000;

export async function enqueueFollowup({ orderId, email, name, pack, price, method }) {
  // Only queue if customer provided email
  if (!email?.trim()) return;

  const data = {
    orderId,
    email: email.trim(),
    name,
    pack,
    price,
    method, // 'cod' | 'prepaid'
    orderTs: Date.now(),
    sent: { d3: false, d7: false, d30: false, d90: false },
  };

  await kv.set(`followup:${orderId}`, data);
  await kv.sadd(ACTIVE_SET, orderId);
}

export async function getActiveOrders() {
  const ids = await kv.smembers(ACTIVE_SET);
  if (!ids?.length) return [];

  const orders = await Promise.all(
    ids.map(id => kv.get(`followup:${id}`))
  );
  return orders.filter(Boolean);
}

export async function markSent(orderId, day) {
  const data = await kv.get(`followup:${orderId}`);
  if (!data) return;

  data.sent[day] = true;

  // If all 4 emails sent — remove from active set (keeps KV clean)
  const allDone = data.sent.d3 && data.sent.d7 && data.sent.d30 && data.sent.d90;
  await kv.set(`followup:${orderId}`, data);
  if (allDone) await kv.srem(ACTIVE_SET, orderId);
}

export function daysSince(orderTs) {
  return Math.floor((Date.now() - orderTs) / MS_PER_DAY);
}
