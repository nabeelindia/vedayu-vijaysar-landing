/**
 * GET /api/pincode-lookup?pin=400001
 * Thin proxy to api.zippopotam.us — called from the browser as a same-origin
 * request so there are zero CORS / CSP / browser-security issues.
 * Response is cached at the CDN edge for 24 h.
 */
export default async function handler(req, res) {
  const pin = String(req.query.pin || '').replace(/\D/g, '');
  if (!/^[1-9]\d{5}$/.test(pin)) {
    return res.status(400).json({ error: 'invalid pincode' });
  }

  try {
    const upstream = await fetch(`https://api.zippopotam.us/in/${pin}`);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'not found' });
    }
    const data = await upstream.json();

    // Cache at CDN for 24 h so repeated lookups are instant
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'upstream failed' });
  }
}
