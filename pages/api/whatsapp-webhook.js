export const config = {
  maxDuration: 10, // Vercel hobby plan max
  api: { bodyParser: false }, // need raw body for HMAC verification
};

import crypto from 'crypto';
import { getBotReply, FALLBACK_REPLY } from '../../lib/wa-knowledge';
import { supabase } from '../../lib/supabase';
import { sendPush } from '../../lib/push';
import { Resend } from 'resend';
import { kv } from '@vercel/kv';
import { waCodPrepaidOffer, waCodVerify } from '../../lib/whatsapp';

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory dedup: prevents replying twice if Meta sends the same webhook twice
const recentIds = new Set();

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

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

  // Read raw body once (needed for both signature check and parsing)
  const rawBody = await getRawBody(req);

  // ── Signature validation ─────────────────────────────────────────────────
  // Meta signs the raw request body bytes — must validate before JSON.parse.
  if (process.env.WA_APP_SECRET) {
    const sig      = req.headers['x-hub-signature-256'] || '';
    const expectedBuf = Buffer.from('sha256=' + crypto
      .createHmac('sha256', process.env.WA_APP_SECRET)
      .update(rawBody)
      .digest('hex'));
    const sigBuf = Buffer.from(sig);
    // timingSafeEqual requires equal lengths; different length = definitely wrong
    const valid = sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf);
    if (!valid) {
      console.error('[WA] Signature mismatch — possible replay/tamper. sig:', sig.slice(0, 20));
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  // Parse body now that signature is verified
  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Process FIRST, then ACK — this ensures Vercel doesn't kill the function
  // before the reply is sent. Meta allows up to 20s; Vercel hobby allows 10s.
  try {
    const entry  = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const msgArr = change?.messages;

    if (msgArr?.length) {
      for (const msg of msgArr) {
        // ── Interactive button reply (COD verification) ──────────────────
        if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
          if (recentIds.has(msg.id)) continue;
          recentIds.add(msg.id);
          if (recentIds.size > 200) recentIds.delete(recentIds.values().next().value);

          const phone    = msg.from; // already in e164 format e.g. '919876543210'
          const buttonId = msg.interactive.button_reply.id; // 'CONFIRM_COD' | 'CANCEL_COD'
          const record   = await kv.get(`cod_verify:${phone}`).catch(() => null);

          if (!record || record.status !== 'pending') continue;

          if (buttonId === 'CHANGE_ADDRESS') {
            // Set awaiting_address state — next free-text from this phone = new address
            await kv.set(`cod_addr_change:${phone}`, {
              orderId: record.orderId,
              name:    record.name,
              pack:    record.pack,
              price:   record.price,
            }, { ex: 3600 }).catch(() => {}); // 1hr window to reply
            await sendWAMessage(phone,
              `Namaste ${record.name} ji 🙏\n\nPlease type your *complete new delivery address* — house/flat number, area, city, and pincode.\n\n_Example: 42, Green Park, New Delhi - 110016_`
            );
            continue;
          }

          if (buttonId === 'CONFIRM_COD') {
            await kv.set(`cod_verify:${phone}`, { ...record, status: 'confirmed' }, { ex: 172800 }).catch(e => console.error('[WA] KV update failed:', e));
            if (supabase) {
              const { error: cvErr } = await supabase.from('cod_verifications')
                .update({ status: 'confirmed', verified_at: new Date().toISOString() })
                .eq('order_id', record.orderId);
              if (cvErr) console.error('[WA] cod_verifications update failed:', cvErr.message);
              const now = new Date().toISOString();
              const { error: ordErr } = await supabase.from('orders')
                .update({ status: 'confirmed', confirmed_at: now, updated_at: now })
                .eq('order_id', record.orderId);
              if (ordErr) console.error('[WA] orders update failed:', ordErr.message);
              else console.log(`[WA] Order ${record.orderId} confirmed by customer`);
            }
            await sendWAMessage(phone,
              `Namaste ${record.name} ji 🙏 Thank you! Your order ${record.orderId} is confirmed. We will send your order to you — please keep ₹${record.price} ready to give the delivery person.`
            );
            notifyOwnerCodAction({ orderId: record.orderId, name: record.name, action: 'confirmed' }).catch(() => {});

          } else if (buttonId === 'CANCEL_COD') {
            await kv.set(`cod_verify:${phone}`, { ...record, status: 'cancelled' }, { ex: 172800 }).catch(e => console.error('[WA] KV update failed:', e));
            if (supabase) {
              const { error: cvErr } = await supabase.from('cod_verifications')
                .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
                .eq('order_id', record.orderId);
              if (cvErr) console.error('[WA] cod_verifications cancel failed:', cvErr.message);
              const { error: ordErr } = await supabase.from('orders')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('order_id', record.orderId);
              if (ordErr) console.error('[WA] orders cancel failed:', ordErr.message);
              else console.log(`[WA] Order ${record.orderId} cancelled by customer`);
            }
            await waCodPrepaidOffer({ mobile: phone, name: record.name, orderId: record.orderId });
            notifyOwnerCodAction({ orderId: record.orderId, name: record.name, action: 'cancelled' }).catch(() => {});
          }
          continue;
        }

        if (msg.type !== 'text') continue;

        // Dedup
        if (recentIds.has(msg.id)) continue;
        recentIds.add(msg.id);
        if (recentIds.size > 200) recentIds.delete(recentIds.values().next().value);

        const phone   = msg.from;
        const text    = msg.text?.body || '';
        const contact = change?.contacts?.[0]?.profile?.name || phone;

        // ── Address change flow — capture new address ────────────────────
        const addrChange = await kv.get(`cod_addr_change:${phone}`).catch(() => null);
        if (addrChange) {
          const newAddress = text.trim();
          if (newAddress.length < 10) {
            // Too short — ask again
            await sendWAMessage(phone,
              `Yeh address thoda chhota lag raha hai 🙏 Please *poora address* likhein — house number, area, city aur pincode ke saath.\n\n_Example: 42, Green Park, New Delhi - 110016_`
            );
            continue;
          }

          // Update KV record with new address
          const codRecord = await kv.get(`cod_verify:${phone}`).catch(() => null);
          if (codRecord) {
            await kv.set(`cod_verify:${phone}`, { ...codRecord, address: newAddress }, { ex: 172800 }).catch(() => {});
          }

          // Update Supabase orders table
          if (supabase) {
            const now = new Date().toISOString();
            const { error: aOrdErr } = await supabase.from('orders')
              .update({ address: newAddress, address_changed: true, updated_at: now })
              .eq('order_id', addrChange.orderId);
            if (aOrdErr) console.error('[WA] orders address update failed:', aOrdErr.message);
            const { error: aVerfErr } = await supabase.from('cod_verifications')
              .update({ address_updated_at: now })
              .eq('order_id', addrChange.orderId);
            if (aVerfErr) console.error('[WA] cod_verifications address_updated_at failed:', aVerfErr.message);
          }

          // Clear the awaiting state
          await kv.del(`cod_addr_change:${phone}`).catch(() => {});

          // Resend address confirm template with the updated address
          await waCodVerify({
            mobile: phone,
            name:   addrChange.name,
            orderId: addrChange.orderId,
            pack:   addrChange.pack,
            price:  addrChange.price,
            address: newAddress,
          }).catch(() => {});

          // Notify owner of address change
          notifyOwnerAddressChange({ orderId: addrChange.orderId, name: addrChange.name, newAddress }).catch(() => {});
          console.log(`[WA] Address updated for ${addrChange.orderId}: ${newAddress}`);
          continue;
        }

        const botReply   = getBotReply(text) ?? FALLBACK_REPLY;
        const isFallback = botReply === FALLBACK_REPLY;

        console.log(`[WA] ${contact} (${phone}): "${text}" → ${isFallback ? 'FALLBACK' : 'BOT'}`);

        await sendWAMessage(phone, botReply);

        // Persist to DB — awaited so Vercel doesn't kill the function before the write completes
        if (supabase) {
          const { error: dbErr } = await supabase.from('wa_messages').upsert({
            wa_id: msg.id,
            from_phone: phone,
            from_name: contact !== phone ? contact : null,
            message: text,
            bot_replied: botReply,
          }, { onConflict: 'wa_id' });
          if (dbErr) console.error('[WA] DB save error:', dbErr.message);
          else console.log('[WA] message saved to DB');
        } else {
          console.warn('[WA] Supabase not configured — message not persisted');
        }
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

  await sendPush({
    title: isFallback ? `⚠️ Needs reply — ${contact}` : `💬 WA — ${contact}`,
    body:  text,
  });
}

async function notifyOwnerAddressChange({ orderId, name, newAddress }) {
  if (!process.env.RESEND_API_KEY || !process.env.ORDERS_EMAIL) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from:    'Vedayu Orders <orders@vedayulife.com>',
    to:      process.env.ORDERS_EMAIL,
    subject: `📍 Address Updated — ${orderId} | ${name}`,
    html:    `<p style="font-family:sans-serif">Customer <b>${name}</b> updated their delivery address for order <b>${orderId}</b>.</p><p style="font-family:sans-serif"><b>New address:</b> ${newAddress}</p><p style="font-family:sans-serif;color:#888;font-size:13px;">Address has been updated in Supabase. Please use this address for dispatch.</p>`,
  });
}

async function notifyOwnerCodAction({ orderId, name, action }) {
  if (!process.env.RESEND_API_KEY || !process.env.ORDERS_EMAIL) return;
  const emoji  = action === 'confirmed' ? '✅' : '❌';
  const label  = action === 'confirmed' ? 'Confirmed' : 'Cancelled';
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from:    'Vedayu Orders <orders@vedayulife.com>',
    to:      process.env.ORDERS_EMAIL,
    subject: `${emoji} COD ${label} — ${orderId} | ${name}`,
    html: `<p style="font-family:sans-serif">Customer <b>${name}</b> tapped <b>${label}</b> for order <b>${orderId}</b> on WhatsApp.</p>`,
  });
}
