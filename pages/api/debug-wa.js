// Temporary debug endpoint — DELETE after fixing WA issue
// Auth: must pass ?secret=SESSION_SECRET
export default async function handler(req, res) {
  if (req.query.secret !== 'vedayu-debug-2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const phoneId = process.env.WA_PHONE_NUMBER_ID;
  const token   = process.env.WA_TOKEN;

  const env = {
    WA_PHONE_NUMBER_ID: phoneId ? phoneId.slice(0,6) + '...' : 'MISSING',
    WA_TOKEN:           token   ? token.slice(0,8)   + '...' : 'MISSING',
    WA_WABA_ID:         process.env.WA_WABA_ID || 'MISSING',
  };

  if (!phoneId || !token) {
    return res.json({ env, error: 'Missing WA env vars' });
  }

  // 1. Validate token
  let tokenCheck = {};
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${token}`
    );
    tokenCheck = await r.json();
  } catch (e) {
    tokenCheck = { error: e.message };
  }

  // 2. Try sending a real WA message
  let waSend = {};
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '919927075211',
        type: 'template',
        template: {
          name: 'vedayu_order_confirmed',
          language: { code: 'en' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: 'Nabeel' },
              { type: 'text', text: 'Vijaysar Glass (Pack of 1)' },
              { type: 'text', text: 'VDY-DEBUG-001' },
              { type: 'text', text: '₹999' },
            ],
          }],
        },
      }),
    });
    waSend = await r.json();
  } catch (e) {
    waSend = { error: e.message };
  }

  return res.json({ env, tokenCheck: tokenCheck?.data || tokenCheck, waSend });
}
