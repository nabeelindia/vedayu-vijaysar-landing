import { getBotReply, FALLBACK_REPLY } from '../../lib/wa-knowledge';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // ── Webhook verification (GET) ───────────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();
  res.status(200).json({ status: 'ok' }); // ACK immediately

  try {
    const entry   = req.body?.entry?.[0];
    const change  = entry?.changes?.[0]?.value;
    const msgArr  = change?.messages;
    if (!msgArr?.length) return;

    for (const msg of msgArr) {
      if (msg.type !== 'text') continue; // ignore media for now

      const waId    = msg.id;
      const phone   = msg.from;
      const text    = msg.text?.body || '';
      const contact = change?.contacts?.[0]?.profile?.name || null;

      // Dedup — skip if already processed
      const { data: existing } = await supabase
        .from('wa_messages')
        .select('id')
        .eq('wa_id', waId)
        .single();
      if (existing) continue;

      const botReply = getBotReply(text) ?? FALLBACK_REPLY;

      // Send reply via WhatsApp Cloud API
      await sendWAMessage(phone, botReply);

      // Save to Supabase
      await supabase.from('wa_messages').insert({
        wa_id:      waId,
        from_phone: phone,
        from_name:  contact,
        message:    text,
        bot_replied: botReply,
      });

      // Notify admin — browser push + email (fire and forget)
      notifyAdmin({ phone, contact, text, botReply }).catch(console.error);
    }
  } catch (err) {
    console.error('WA webhook error:', err);
  }
}

async function sendWAMessage(to, body) {
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token   = process.env.WA_TOKEN;
  if (!phoneId || !token) return;

  await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
}

async function notifyAdmin({ phone, contact, text, botReply }) {
  const displayName = contact || phone;
  const isFallback  = botReply === FALLBACK_REPLY;

  // ── Browser push notifications ─────────────────────────────────────────
  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  if (subs?.length) {
    const payload = JSON.stringify({
      title: isFallback
        ? `⚠️ Needs reply — ${displayName}`
        : `💬 New WA message — ${displayName}`,
      body:  text.slice(0, 120),
      url:   '/wa-inbox',
    });
    await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          // Remove expired subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        })
      )
    );
  }

  // ── Email notification (only when bot can't answer) ───────────────────
  if (isFallback && process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from:    'Vedayu Bot <bot@vedayulife.com>',
      to:      process.env.ORDERS_EMAIL,
      subject: `⚠️ Customer needs help on WhatsApp — ${displayName}`,
      html: `
        <h2 style="color:#5a3e2b">New WhatsApp message — human reply needed</h2>
        <table style="font-family:sans-serif;font-size:15px;line-height:1.6">
          <tr><td><b>From:</b></td><td>${displayName} (${phone})</td></tr>
          <tr><td><b>Message:</b></td><td>${text}</td></tr>
        </table>
        <p style="margin-top:20px;color:#888">Bot could not answer — please reply directly on WhatsApp.</p>
      `,
    });
  }
}
