/**
 * GET /api/pincode-lookup?pin=400001
 *
 * Proxies to India Post's official pincode API (api.postalpincode.in).
 * Returns a normalised { city, state, pincode } object.
 *
 * Why India Post instead of zippopotam.us?
 *  - India-specific → always correct District and State names
 *  - Returns "District" (clean city name) not raw post-office names
 *  - No auth, free, no CORS issues via same-origin proxy
 *
 * Response cached at CDN edge for 24 h — repeated lookups are instant.
 */
export default async function handler(req, res) {
  const pin = String(req.query.pin || '').replace(/\D/g, '');
  if (!/^[1-9]\d{5}$/.test(pin)) {
    return res.status(400).json({ error: 'invalid pincode' });
  }

  try {
    const upstream = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'not found' });
    }

    // India Post response shape:
    // [{ Status: "Success", PostOffice: [{ District, State, Name, ... }] }]
    const data = await upstream.json();
    const record = Array.isArray(data) ? data[0] : data;

    if (record?.Status !== 'Success' || !record?.PostOffice?.length) {
      return res.status(404).json({ error: 'not found' });
    }

    const offices = record.PostOffice;

    // District is the canonical city/district name — use the first entry's District.
    // Some pincodes span multiple districts (rare); the first is always the primary.
    const city  = offices[0].District || '';
    const state = offices[0].State    || '';

    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    return res.status(200).json({ city, state, pincode: pin, offices });

  } catch (err) {
    console.error('pincode-lookup error:', err.message);
    return res.status(500).json({ error: 'lookup failed' });
  }
}
