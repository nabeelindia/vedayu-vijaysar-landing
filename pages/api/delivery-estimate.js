/**
 * GET /api/delivery-estimate?pincode=560102&cod=1&price=999
 *
 * Returns a real-time delivery estimate for a customer pincode.
 * Called from the checkout form after the user enters their pincode.
 *
 * Response:
 *   { eta: "2024-01-19", carrier: "Delhivery Standard", zone: "zone_a", serviceable: true }
 *   { serviceable: false, reason: "pincode_not_covered" }
 */

import { getDeliveryEstimate } from '../../lib/velocity';

// Simple in-memory cache: pincode+type → { eta, carrier, zone, cachedAt }
// Resets on each cold start — that's fine, just avoids hammering the API
// for the same pincode within a single serverless invocation lifecycle.
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { pincode, cod = '1', price = '999' } = req.query;

  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.status(400).json({ serviceable: false, reason: 'invalid_pincode' });
  }

  if (!process.env.VELOCITY_USERNAME || !process.env.VELOCITY_PASSWORD || !process.env.VELOCITY_WAREHOUSE_ID) {
    // Velocity not configured yet — silently skip, don't break checkout
    return res.status(200).json({ serviceable: false, reason: 'not_configured' });
  }

  const isCod = cod !== '0';
  const cacheKey = `${pincode}-${isCod ? 'cod' : 'pre'}-${Math.round(Number(price) / 100) * 100}`;

  // Return cached result if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return res.status(200).json({ serviceable: true, ...cached });
  }

  try {
    const result = await getDeliveryEstimate({
      destination_pincode: pincode,
      is_cod:              isCod,
      price:               Number(price),
    });

    if (!result.eta) {
      return res.status(200).json({ serviceable: false, reason: 'pincode_not_covered' });
    }

    const response = {
      serviceable: true,
      eta:         result.eta,      // "2024-01-19"
      carrier:     result.carrier,
      zone:        result.zone,
      cachedAt:    Date.now(),
    };

    cache.set(cacheKey, response);

    // Format ETA as a readable string e.g. "Mon, 26 May"
    const etaFormatted = result.eta
      ? new Date(result.eta).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
      : null;

    return res.status(200).json({ ...response, etaFormatted });

  } catch (err) {
    console.error('Delivery estimate error:', err.message);
    // Don't break checkout — just return not_configured silently
    return res.status(200).json({ serviceable: false, reason: 'api_error' });
  }
}
