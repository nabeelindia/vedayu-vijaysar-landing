/**
 * GET /api/pincode-lookup?pin=560068
 *
 * Looks up city, state, COD availability and shipping zone for a pincode
 * using the Velocity serviceability export bundled in lib/pincode-db.json.
 *
 * No external API calls — zero latency, zero dependency, zero failure rate.
 * The JSON is ~550KB and is loaded once per cold start then stays in memory.
 *
 * Data format in pincode-db.json:
 *   { "560068": ["Bengaluru", "Karnataka", 1, "D"], ... }
 *   index:           0          1            2   3
 *   [city, state, cod (0|1), zone]
 *
 * To refresh: re-export your Velocity serviceability CSV and run
 *   node scripts/build-pincode-db.mjs
 */

import db from '../../lib/pincode-db.json';

export default function handler(req, res) {
  const pin = String(req.query.pin || '').replace(/\D/g, '');

  if (!/^[1-9]\d{5}$/.test(pin)) {
    return res.status(400).json({ error: 'invalid pincode' });
  }

  const entry = db[pin];

  if (!entry) {
    // Pincode not in Velocity serviceability list — not deliverable
    return res.status(404).json({ error: 'not found', serviceable: false });
  }

  const [city, state, cod, zone] = entry;

  // Cache aggressively — pincode data changes rarely
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
  return res.status(200).json({
    city,
    state,
    pincode:     pin,
    cod:         cod === 1,
    zone,
    serviceable: true,
  });
}
