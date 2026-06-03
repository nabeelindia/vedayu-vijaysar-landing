import { getBotReply, FALLBACK_REPLY } from '../../lib/wa-knowledge';
import webpush from 'web-push';
import { Resend } from 'resend';

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
  res.status(200).json({ status: 'ok' }); // ACK Meta immediately

  try {
    const entry  = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msgArr = change?.messages;
    if (!msgArr?.length) return;

    for (const msg of msgArr) {
      if (msg.type !== 'text') continue;

      const phone   = msg.from;
      const text    = msg.text?.body || '';
      const contact = change?.contacts?.[0]?.profile?.name || phone;

      const botReply   = getBotReply(text) ?? FALLBACK_REPLY;
      const isFallback = botReply === FALLBACK_REPLY;

      // Send WhatsApp reply
      await sendWAMessage(phone, botReply);

      console.log(`[WA] ${contact} (${phone}): "${text}" → ${isFallback ? 'FALLBACK' : 'BOT'}`);

      // Notify admin
      await notifyAdmin({ phone, contact, text, botReply, isFallback });
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
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });
}

async function notifyAdmin({ phone, contact, text, isFallback }) {
  // ── Email (always on fallback, so admin knows a human reply is needed) ──
  if (isFallback && process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from:    'Vedayu Bot <bot@vedayulife.com>',
      to:      process.env.ORDERS_EMAIL,
      subject: `⚠️ WA message needs reply — ${contact}`,
      html: `
        <h2 style="color:#5a3e2b;font-family:sans-serif">WhatsApp — human reply needed</h2>
        <table style="font-family:sans-serif;font-size:15px;line-height:1.8">
          <tr><td><b>From:</b></td><td>${contact} &nbsp;(${phone})</td></tr>
          <tr><td><b>Message:</b></td><td>${text}</td></tr>
        </table>
        <p style="color:#888;font-family:sans-serif;font-size:13px;margin-top:20px">
          Bot could not answer — please reply directly on WhatsApp.
        </p>
      `,
    }).catch(err => console.error('Email error:', err));
  }

  // ── Browser push (requires VAPID keys + active subscriptions) ───────────
  if (!process.env.VAPID_PUBLIC_KEY) return;

  const pushEndpointsRaw = process.env.PUSH_SUBSCRIPTIONS;
  if (!pushEndpointsRaw) return;

  let subs = [];
  try { subs = JSON.parse(pushEndpointsRaw); } catch { return; }

  const payload = JSON.stringify({
    title: isFallback ? `⚠️ Needs reply — ${contact}` : `💬 WA message — ${contact}`,
    body:  text.slice(0, 120),
  });

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(err => console.error('Push error:', err.message))
    )
  );
}
