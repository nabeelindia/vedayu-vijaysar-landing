// lib/tabbly.js
import { supabase } from './supabase';

const TABBLY_API_URL    = process.env.TABBLY_API_URL    || 'https://api.tabbly.ai/v1/calls/outbound';
const TABBLY_AUTH_TOKEN = process.env.TABBLY_AUTH_TOKEN;

/**
 * Fire an outbound Tabbly call for a COD order.
 * Throws on non-2xx from Tabbly.
 */
export async function triggerTabblyCall({ orderId, name, price, address, state: customerState }) {
  if (!TABBLY_AUTH_TOKEN) {
    console.warn('[Tabbly] TABBLY_AUTH_TOKEN not set — skipping call trigger for', orderId);
    return null;
  }
  const res = await fetch(TABBLY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TABBLY_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      order_id:                   orderId,
      customer_name:              name,
      order_total_amount:         price,
      shipping_address:           address,
      customer_language_or_state: customerState,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[Tabbly] API ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Returns true if the current IST wall-clock time is within the call window
 * (10:00 AM – 10:00 PM IST, i.e. hour >= 10 and hour < 22).
 */
export function isWithinCallWindow() {
  const istHour = Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
  return istHour >= 10 && istHour < 22;
}

/**
 * Returns the next 10:15 AM IST as a Date.
 * Used to snap out-of-window retry times to the next morning slot.
 */
export function nextCallWindowStart() {
  const now     = new Date();
  const istDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const todayWindow = new Date(`${istDate}T10:15:00+05:30`);
  if (todayWindow > now) return todayWindow;
  const tomorrow = new Date(todayWindow);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Calculates the scheduled_at time for retry attempt N (1-indexed).
 * Backoff: attempt 1 → +2h, attempt 2 → +4h, attempt 3 → +8h.
 * If computed time falls outside 10am-10pm IST, snaps to next 10:15 AM IST.
 */
export function calculateRetryTime(attemptNumber) {
  const backoffHours = [2, 4, 8];
  const hours        = backoffHours[Math.min(attemptNumber - 1, 2)];
  const scheduled    = new Date(Date.now() + hours * 60 * 60 * 1000);

  const istHour = Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(scheduled)
  );
  if (istHour < 10 || istHour >= 22) return nextCallWindowStart();
  return scheduled;
}

/**
 * Inserts a pending retry row into tabbly_call_retries.
 * Returns the scheduled Date.
 */
export async function scheduleRetry({ orderId, attemptNumber }) {
  const scheduledAt = calculateRetryTime(attemptNumber);
  const { error } = await supabase.from('tabbly_call_retries').insert({
    order_id:     orderId,
    attempt:      attemptNumber,
    scheduled_at: scheduledAt.toISOString(),
    status:       'pending',
  });
  if (error) throw new Error(`[Tabbly] scheduleRetry DB error: ${error.message}`);
  return scheduledAt;
}
