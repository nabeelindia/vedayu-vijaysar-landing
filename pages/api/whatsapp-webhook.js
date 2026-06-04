export const config = { maxDuration: 10 }; // Vercel hobby plan max

import { getBotReply, FALLBACK_REPLY } from '../../lib/wa-knowledge';
import webpush from 'web-push';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory dedup: prevents replying twice if Meta sends the same webhook twice
const recentIds = new Set();

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

  // Process FIRST, then ACK — this ensures Vercel doesn't kill the function
  // before the reply is sent. Meta allows up to 20s; Vercel hobby allows 10s.
  try {
    const entry  = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msgArr = change?.messages;

    if (msgArr?.length) {
      for (const msg of msgArr) {
        if (msg.type !== 'text') continue;

        // Dedup
        if (recentIds.has(msg.id)) continue;
        recentIds.add(msg.id);
        if (recentIds.size > 200) recentIds.delete(recentIds.values().next().value);

        const phone   = msg.from;
        const text    = msg.text?.body || '';
        const contact = change?.contacts?.[0]?.profile?.name || phone;

        const botReply   = getBotReply(text) ?? FALLBACK_REPLY;
        const isFallback = botReply === FALLBACK_REPLY;

        console.log(`[WA] ${contact} (${phone}): "${text}" → ${isFallback ? 'FALLBACK' : 'BOT'}`);

        await sendWAMessage(phone, botReply);
        notifyAdmin({ phone, contact, text, isFallback }).catch(console.error);
      }
    }
  } catch (err) {
    console.error('WA webhook error:', err);
  }

  // ACK Meta after processing is done
  return res.status(200).json({ status: 'ok' });
}

async function sendWAMessage(to, body, retries = 3) {
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token   = process.env.WA_TOKEN;
  if (!phoneId || !token) {
    console.error('[WA] WA_PHONE_NUMBER_ID or WA_TOKEN not set');
    return;
  }

  const payload = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 3s timeout per attempt — fits within Vercel's 10s function limit
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    payload,
        signal:  controller.signal,
      });
      clearTimeout(timeout);

      const json = await res.json();
      if (!res.ok) {
        console.error(`[WA] send error (attempt ${attempt}/${retries}):`, JSON.stringify(json));
      } else {
        console.log(`[WA] reply sent to ${to} (attempt ${attempt})`);
        return json;
      }
    } catch (err) {
      console.error(`[WA] send failed (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) {
        console.error(`[WA] all ${retries} attempts exhausted for ${to}`);
        return;
      }
    }
    // Short backoff: 500ms between attempts
    await new Promise(r => setTimeout(r, 500));
  }
}

async function notifyAdmin({ phone, contact, text, isFallback }) {
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

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.PUSH_SUBSCRIPTIONS) return;
  let subs = [];
  try { subs = JSON.parse(process.env.PUSH_SUBSCRIPTIONS); } catch { return; }

  const payload = JSON.stringify({
    title: isFallback ? `⚠️ Needs reply — ${contact}` : `💬 WA — ${contact}`,
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
