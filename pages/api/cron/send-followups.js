/**
 * /api/cron/send-followups
 *
 * Runs daily at 8 AM IST (2:30 UTC).
 * Sends follow-up emails AND WhatsApp messages for each due touchpoint.
 *
 * Schedule:
 *   Day 0  → WhatsApp: order confirmed (fired at order time, not cron)
 *   Day 3  → Email + WhatsApp: dispatch nudge
 *   Day 7  → Email + WhatsApp: usage tips
 *   Day 30 → Email + WhatsApp: check-in + review request
 *   Day 90 → Email + WhatsApp: ritual complete + upsell
 */

import { Resend } from 'resend';
import { getActiveOrders, markSent, daysSince } from '../../../lib/followup-queue';
import { day3Email, day7Email, day30Email, day90Email } from '../../../lib/followup-emails';
import { waDispatchUpdate, waUsageTips, waUpsell, waRitualComplete } from '../../../lib/whatsapp';

export const config = { maxDuration: 60 };

const SCHEDULE = [
  {
    day: 3,  key: 'd3',
    email: day3Email,
    wa:    (o) => waDispatchUpdate({ mobile: o.mobile, name: o.name, orderId: o.orderId }),
  },
  {
    day: 7,  key: 'd7',
    email: day7Email,
    wa:    (o) => waUsageTips({ mobile: o.mobile, name: o.name }),
  },
  {
    day: 30, key: 'd30',
    email: day30Email,
    wa:    (o) => waUpsell({ mobile: o.mobile, name: o.name }),
  },
  {
    day: 90, key: 'd90',
    email: day90Email,
    wa:    (o) => waRitualComplete({ mobile: o.mobile, name: o.name, pack: o.pack }),
  },
];

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const sent = [];
  const errors = [];

  let orders;
  try {
    orders = await getActiveOrders();
  } catch (err) {
    return res.status(500).json({ error: `KV fetch failed: ${err.message}` });
  }

  for (const order of orders) {
    const days = daysSince(order.orderTs);

    for (const { day, key, email: emailTpl, wa: waTpl } of SCHEDULE) {
      // Allow a 2-day window in case the cron missed a day
      if (days >= day && days <= day + 2 && !order.sent[key]) {
        // ── Email ────────────────────────────────────────────────
        if (resend && order.email) {
          try {
            const { subject, html } = emailTpl(order);
            await resend.emails.send({
              from:    'Vedayu <orders@vedayulife.com>',
              to:      order.email,
              subject,
              html,
            });
            sent.push(`${order.orderId} → email d${day}`);
          } catch (err) {
            errors.push(`${order.orderId} email d${day}: ${err.message}`);
          }
        }

        // ── WhatsApp ─────────────────────────────────────────────
        if (order.mobile) {
          try {
            await waTpl(order);
            sent.push(`${order.orderId} → wa d${day}`);
          } catch (err) {
            errors.push(`${order.orderId} wa d${day}: ${err.message}`);
          }
        }

        await markSent(order.orderId, key);
      }
    }
  }

  return res.status(200).json({ checked: orders.length, sent, errors });
}
