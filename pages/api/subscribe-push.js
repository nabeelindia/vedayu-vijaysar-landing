// Push subscription endpoint — logs the subscription object to console.
// To enable persistent push, store the subscription in your preferred DB.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }

  // Log so you can copy into PUSH_SUBSCRIPTIONS env var if needed
  console.log('[push-sub]', JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }));

  res.status(201).json({ ok: true });
}
