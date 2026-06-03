/**
 * Meta Conversions API (CAPI) — server-side event sender
 * Fires alongside the browser pixel; Meta deduplicates using event_id.
 * PII is hashed with SHA-256 before sending, as required by Meta.
 */
import crypto from 'crypto';

const PIXEL_ID    = '4274415046037928';
const API_VERSION = 'v21.0';

/** SHA-256 hash — lowercase, trimmed (Meta requirement) */
function h(val) {
  if (!val) return undefined;
  return crypto.createHash('sha256').update(String(val).trim().toLowerCase()).digest('hex');
}

/** Build hashed user_data object from order form fields */
function userData({ name = '', mobile = '', email = '', city = '', pincode = '' }) {
  const parts     = name.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ');

  const obj = {
    em:      h(email),
    ph:      mobile ? h(`91${mobile.replace(/\D/g, '')}`) : undefined,
    fn:      h(firstName),
    ln:      lastName ? h(lastName) : undefined,
    ct:      h(city),
    zp:      h(pincode),
    country: h('in'),
  };

  // Remove undefined keys
  Object.keys(obj).forEach(k => obj[k] === undefined && delete obj[k]);
  return obj;
}

/**
 * Send a Purchase event to Meta CAPI.
 * Call this server-side after a confirmed order.
 *
 * @param {object} opts
 * @param {string} opts.orderId   — used as event_id for deduplication with browser pixel
 * @param {number} opts.price     — order value in INR
 * @param {string} opts.pack      — pack label e.g. "Pack of 2"
 * @param {number} opts.qty       — number of glasses
 * @param {string} [opts.email]
 * @param {string} opts.mobile    — 10-digit Indian mobile
 * @param {string} opts.name      — customer full name
 * @param {string} opts.city
 * @param {string} opts.pincode
 */
export async function sendCapiPurchase(opts) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) { console.warn('META_CAPI_TOKEN not set — skipping CAPI'); return; }

  const event = {
    event_name:       'Purchase',
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         opts.orderId,          // deduplication key — must match browser fbq eventID
    action_source:    'website',
    event_source_url: 'https://vedayulife.com',
    user_data:        userData(opts),
    custom_data: {
      currency:         'INR',
      value:            Number(opts.price),
      content_ids:      ['vijaysar-glass'],
      content_type:     'product',
      content_name:     'Vijaysar Wooden Glass',
      content_category: 'Health & Wellness',
      num_items:        opts.qty || 1,
      order_id:         opts.orderId,
    },
  };

  // Include test_event_code if set (needed for Meta Test Events tab visibility)
  const testCode = process.env.META_CAPI_TEST_CODE;
  const payload  = { data: [event] };
  if (testCode) payload.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${token}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }
    );
    const json = await res.json();
    if (!res.ok) console.error('CAPI error:', JSON.stringify(json));
    else         console.log(`CAPI Purchase sent ✓  events_received=${json.events_received}  order=${opts.orderId}`);
  } catch (err) {
    console.error('CAPI fetch failed:', err.message);
  }
}
