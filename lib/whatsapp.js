/**
 * WhatsApp Business Cloud API
 * Requires: WA_PHONE_NUMBER_ID, WA_TOKEN (from Meta Business Manager)
 *
 * All messages use pre-approved templates.
 * Template names must match exactly what's approved in Meta Business Manager.
 */

const API_VERSION = 'v21.0';

async function sendMessage(to, body) {
  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token   = process.env.WA_TOKEN;
  if (!phoneId || !token) {
    console.warn('WhatsApp not configured — skipping');
    return null;
  }

  // Normalise Indian number to international format
  const phone = String(to).replace(/\D/g, '');
  const intl  = phone.startsWith('91') ? phone : `91${phone}`;

  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: intl, ...body }),
    }
  );

  const json = await res.json();
  if (!res.ok || json.error) {
    console.error('WhatsApp error:', JSON.stringify(json));
    return null;
  }
  return json;
}

/* ─────────────────────────────────────────────────────────────────────────────
   TEMPLATES
   Register each of these in Meta Business Manager → WhatsApp → Message Templates
   before going live. Use the exact template names below.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Day 0 — Order confirmed
 * Template: vedayu_order_confirmed
 * Variables: {{1}} customer name, {{2}} pack name, {{3}} order ID, {{4}} price
 */
export async function waOrderConfirmed({ mobile, name, pack, orderId, price }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_order_confirmed',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: pack },
          { type: 'text', text: orderId },
          { type: 'text', text: `₹${price}` },
        ],
      }],
    },
  });
}

/**
 * Day 3 — Dispatch notification
 * Template: vedayu_dispatch_update
 * Variables: {{1}} customer name, {{2}} order ID
 */
export async function waDispatchUpdate({ mobile, name, orderId }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_dispatch_update',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: orderId },
        ],
      }],
    },
  });
}

/**
 * Day 7 — Usage tips
 * Template: vedayu_usage_tips
 * Variables: {{1}} customer name
 */
export async function waUsageTips({ mobile, name }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_usage_tips',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [{ type: 'text', text: name }],
      }],
    },
  });
}

/**
 * Day 30 — Upsell bigger pack (email handles review ask)
 * Template: vedayu_review_request (repurposed)
 * Variables: {{1}} customer name
 */
export async function waUpsell({ mobile, name }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_review_request',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [{ type: 'text', text: name }],
      }],
    },
  });
}

/**
 * Day 90 — Glass spent, time to reorder
 * Template: vedayu_ritual_complete
 * Variables: {{1}} customer name
 */
export async function waRitualComplete({ mobile, name }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_ritual_complete',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [{ type: 'text', text: name }],
      }],
    },
  });
}

/**
 * Retargeting — Cart abandon follow-up (sent within 1 hour of abandon)
 * Template: vedayu_cart_abandon
 * Variables: {{1}} name, {{2}} pack name
 */
export async function waCartAbandon({ mobile, name, pack }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cart_abandon',
      language: { code: 'en' },
      components: [{
        type:       'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: pack },
        ],
      }],
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSendingLine() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.getHours() < 18
    ? 'aaj hi bhej denge'
    : 'kal subah bhej denge';
}

// ─── COD Verification Templates ──────────────────────────────────────────────

/**
 * COD order verification — sent immediately after order placement.
 * Template: vedayu_cod_verify (UTILITY, Language: en)
 * Body vars: {{1}} name, {{2}} orderId, {{3}} pack, {{4}} price, {{5}} address, {{6}} sending line
 * Buttons: QUICK_REPLY — "Yes, Send My Order" (CONFIRM_COD), "Cancel Order" (CANCEL_COD)
 *
 * EXACT TEXT TO SUBMIT TO META:
 * ─────────────────────────────
 * Namaste {{1}} ji 🙏 Bahut achha decision liya aapne!
 *
 * Aapka Vedayu Vijaysar Glass ({{3}}, {{4}}) tayyar hai — sirf address confirm karna hai.
 *
 * Hum yahan bhejenge:
 * 📍 {{5}}
 *
 * Sahi hai? Bas *Yes, Send My Order* dabaiye — {{6}}! 🌿
 * ─────────────────────────────
 */
export async function waCodVerify({ mobile, name, orderId, pack, price, address }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cod_verify',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: orderId },
            { type: 'text', text: pack },
            { type: 'text', text: `₹${price}` },
            { type: 'text', text: address },
            { type: 'text', text: getSendingLine() },
          ],
        },
        { type: 'button', sub_type: 'quick_reply', index: '0',
          parameters: [{ type: 'payload', payload: 'CONFIRM_COD' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1',
          parameters: [{ type: 'payload', payload: 'CANCEL_COD' }] },
      ],
    },
  });
}

/**
 * 6-hour nudge for non-responders.
 * Template: vedayu_cod_nudge (UTILITY, Language: en)
 * Body vars: {{1}} name, {{2}} orderId, {{3}} sending line
 * Buttons: QUICK_REPLY — "Yes, Send My Order" (CONFIRM_COD), "Cancel Order" (CANCEL_COD)
 *
 * EXACT TEXT TO SUBMIT TO META:
 * ─────────────────────────────
 * Namaste {{1}} ji 🙏 Aapka Vijaysar Glass ready rakha hai — sirf aapka intezaar ho raha hai!
 *
 * Hazaaron log isko roz subah paani peekar sugar control kar rahe hain 🌿
 *
 * Order {{2}} — {{3}}. Bas ek baar *Yes* dabaiye!
 * ─────────────────────────────
 */
export async function waCodNudge({ mobile, name, orderId }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cod_nudge',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: orderId },
            { type: 'text', text: getSendingLine() },
          ],
        },
        { type: 'button', sub_type: 'quick_reply', index: '0',
          parameters: [{ type: 'payload', payload: 'CONFIRM_COD' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1',
          parameters: [{ type: 'payload', payload: 'CANCEL_COD' }] },
      ],
    },
  });
}

/**
 * Prepaid upsell sent after COD cancellation.
 * Template: vedayu_cod_prepaid_offer (MARKETING, Language: en)
 * Body vars: {{1}} name, {{2}} orderId
 * Button: URL — "Reorder with ₹50 Off" → https://vedayulife.com/?cod_cancel_upsell=1
 *
 * EXACT TEXT TO SUBMIT TO META:
 * ─────────────────────────────
 * Namaste {{1}} ji 🙏 Koi baat nahi! Aapka order {{2}} cancel ho gaya.
 *
 * Agar aap UPI ya card se pay karein toh hum aapko ₹50 ki special discount denge — aur order bhi jaldi bhejenge! 🎁
 *
 * Offer sirf aaj ke liye hai.
 * ─────────────────────────────
 */
export async function waCodPrepaidOffer({ mobile, name, orderId }) {
  return sendMessage(mobile, {
    type: 'template',
    template: {
      name:     'vedayu_cod_prepaid_offer',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: name },
          { type: 'text', text: orderId },
        ],
      }],
    },
  });
}

/**
 * Free-text WhatsApp message (admin manual send)
 */
export async function waCustomMessage({ mobile, text }) {
  return sendMessage(mobile, {
    type: 'text',
    text: { body: text },
  });
}
