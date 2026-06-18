// pages/api/tabbly-webhook.js
// Public endpoint — Tabbly calls this after each call terminates.
import { supabase }      from '../../lib/supabase';
import { scheduleRetry } from '../../lib/tabbly';

const TERMINAL_FAIL = new Set(['BUSY', 'NO_ANSWER', 'FAILED']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!supabase) return res.status(503).json({ error: 'DB not configured' });

  const {
    order_id,
    platform_tag,
    call_status,
    landmark                     = '',
    updated_address_notes        = '',
    customer_cancellation_reason = '',
  } = req.body || {};

  if (!order_id) return res.status(400).json({ error: 'order_id required' });

  // ── Terminal call failure → schedule retry or mark unreachable ──────────
  if (call_status && TERMINAL_FAIL.has(call_status.toUpperCase())) {
    const { data: existing } = await supabase
      .from('tabbly_call_retries')
      .select('attempt')
      .eq('order_id', order_id)
      .order('attempt', { ascending: false })
      .limit(1);

    const lastAttempt = existing?.[0]?.attempt || 0;
    const nextAttempt = lastAttempt + 1;

    if (nextAttempt <= 3) {
      const scheduledAt = await scheduleRetry({ orderId: order_id, attemptNumber: nextAttempt });
      console.log(`[Tabbly] ${call_status} for ${order_id} — retry ${nextAttempt} at ${scheduledAt.toISOString()}`);
      return res.json({ scheduled: true, attempt: nextAttempt, scheduled_at: scheduledAt });
    }

    // Exhausted all 3 retries
    const exhaustNote = `Tabbly: unreachable after 3 attempts. Last call_status: ${call_status}.`;
    const { data: orderRow } = await supabase.from('orders').select('tags').eq('order_id', order_id).single();
    const updatedTags = [...new Set([...(orderRow?.tags || []), 'tabbly_unreachable_fallback'])];

    await Promise.allSettled([
      supabase.from('orders').update({
        status:     'tabbly_unreachable_fallback',
        tags:        updatedTags,
        updated_at:  new Date().toISOString(),
      }).eq('order_id', order_id),
      supabase.from('order_notes').insert({
        order_id,
        note:        exhaustNote,
        created_by: 'tabbly_webhook',
      }),
      // TODO: trigger transactional SMS fallback
      // sendFallbackSMS({ orderId: order_id }).catch(() => {})
    ]);

    console.warn(`[Tabbly] Order ${order_id} marked tabbly_unreachable_fallback`);
    return res.json({ exhausted: true, order_id });
  }

  // ── Platform tag outcomes ───────────────────────────────────────────────
  if (!platform_tag) return res.status(400).json({ error: 'platform_tag or call_status required' });

  const noteLines = [
    landmark                     && `Landmark: ${landmark}`,
    updated_address_notes        && `Address notes: ${updated_address_notes}`,
    customer_cancellation_reason && `Cancellation reason: ${customer_cancellation_reason}`,
  ].filter(Boolean);

  const statusMap = {
    tabbly_pay_link_sent: 'needs_review',
    tabbly_cod_confirmed: 'confirmed',
    tabbly_cod_cancelled: 'cancelled',
  };
  const newStatus = statusMap[platform_tag];
  if (!newStatus) return res.status(400).json({ error: `Unknown platform_tag: ${platform_tag}` });

  const { data: orderRow } = await supabase.from('orders').select('tags').eq('order_id', order_id).single();
  const updatedTags = [...new Set([...(orderRow?.tags || []), platform_tag])];

  await Promise.allSettled([
    supabase.from('orders').update({
      status:     newStatus,
      tags:        updatedTags,
      updated_at:  new Date().toISOString(),
    }).eq('order_id', order_id),

    noteLines.length
      ? supabase.from('order_notes').insert({
          order_id,
          note:        noteLines.join('\n'),
          created_by: 'tabbly_webhook',
        })
      : Promise.resolve(),
  ]);

  console.log(`[Tabbly] ${order_id} → status=${newStatus}, tag=${platform_tag}`);
  return res.json({ ok: true, order_id, status: newStatus, tag: platform_tag });
}
