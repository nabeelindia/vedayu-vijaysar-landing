// lib/tabbly.js
import { supabase } from './supabase';

const TABBLY_ENDPOINT = 'https://www.tabbly.io/dashboard/agents/endpoints/add-campaign-contacts';

/**
 * Fire an outbound Tabbly call for a COD order.
 * Auth: api_key in request body (not Bearer header).
 * Throws on non-2xx from Tabbly.
 */
export async function triggerTabblyCall({ orderId, name, price, address, state: customerState, mobile }) {
  // Read at call time (not module load time) so Next.js doesn't bake in undefined at build
  const apiKey     = process.env.TABBLY_API_KEY;
  const campaignId = process.env.TABBLY_CAMPAIGN_ID;
  const agentId    = process.env.TABBLY_AGENT_ID;

  if (!apiKey || !campaignId || !agentId) {
    console.warn('[Tabbly] TABBLY_API_KEY / TABBLY_CAMPAIGN_ID / TABBLY_AGENT_ID not set — skipping for', orderId);
    return null;
  }
  // Tabbly expects E.164 format without leading + for Indian numbers
  const phoneNumber = mobile.trim().startsWith('91') ? mobile.trim() : `91${mobile.trim()}`;

  const res = await fetch(TABBLY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:              apiKey,
      campaign_id:          campaignId,
      use_agent_id:         agentId,
      phone_number:         phoneNumber,
      participant_identity: name,
      created_by:           'vedayu_system',
      sip_call_id:          `vedayu_${orderId}`,
      custom_first_line:    `Hey, am I speaking with ${name}?`,
      custom_instruction:   `Verify COD order ${orderId} for ₹${price}. Delivery to: ${address}. State: ${customerState}.`,
      custom_identifiers:   JSON.stringify({
        order_id: orderId,
        amount:   String(price),
        address,
        state:    customerState,
      }),
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
