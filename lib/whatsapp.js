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
