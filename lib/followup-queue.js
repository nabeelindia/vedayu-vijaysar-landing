/**
 * Post-purchase follow-up email queue using Supabase (followup_queue table).
 *
 * Follow-up schedule:
 *   Day 3  — "Your order is on its way" dispatch nudge
 *   Day 7  — "First week with your Vijaysar glass" usage tips
 *   Day 30 — "One month in" check-in + review request
 *   Day 90 — "90-day ritual complete" + Family Pack upsell
 */

import { supabase } from './supabase';

const MS_PER_DAY = 86_400_000;

export async function enqueueFollowup({ orderId, email, name, pack, price, method, mobile }) {
  // Only queue if customer provided email
  if (!email?.trim()) return;

  const { error } = await supabase.from('followup_queue').upsert(
    {
      order_id: orderId,
      email: email.trim(),
      name,
      pack,
      price,
      method,
      mobile: mobile?.trim() || null,
      order_ts: new Date().toISOString(),
      sent_d3: false,
      sent_d7: false,
      sent_d30: false,
      sent_d90: false,
      unsubscribed: false,
    },
    { onConflict: 'order_id' }
  );
  if (error) throw new Error(`enqueueFollowup ${orderId}: ${error.message}`);
}

export async function getActiveOrders() {
  const { data, error } = await supabase
    .from('followup_queue')
    .select('*')
    .eq('unsubscribed', false);

  if (error) throw new Error(`getActiveOrders: ${error.message}`);
  if (!data?.length) return [];

  return data.map(row => ({
    orderId: row.order_id,
    email: row.email,
    name: row.name,
    pack: row.pack,
    price: row.price,
    method: row.method,
    mobile: row.mobile,
    orderTs: new Date(row.order_ts).getTime(),
    sent: {
      d3: row.sent_d3,
      d7: row.sent_d7,
      d30: row.sent_d30,
      d90: row.sent_d90,
    },
  }));
}

export async function markSent(orderId, day) {
  const VALID_DAYS = ['d3', 'd7', 'd30', 'd90'];
  if (!VALID_DAYS.includes(day)) throw new Error(`markSent: invalid day "${day}"`);
  const { error } = await supabase
    .from('followup_queue')
    .update({ [`sent_${day}`]: true })
    .eq('order_id', orderId);
  if (error) throw new Error(`markSent ${orderId}: ${error.message}`);
}

export function daysSince(orderTs) {
  return Math.floor((Date.now() - orderTs) / MS_PER_DAY);
}
