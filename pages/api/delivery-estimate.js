/**
 * GET /api/delivery-estimate?pincode=560102&cod=1
 *
 * Returns a delivery estimate for a customer pincode using the bundled
 * pincode-db.json (built from Velocity serviceability CSVs).
 *
 * No external API calls — pure in-memory lookup from zone field.
 * Zone → estimated business days:
 *   A → 1–2 days   (metros / top-tier cities)
 *   B → 2–3 days
 *   D → 3–5 days
 *   E → 5–7 days
 *   F → 7–10 days
 *
 * Response:
 *   { serviceable: true, zone, eta: "2026-05-26", etaFormatted: "Tue, 26 May" }
 *   { serviceable: true, codAvailable: false, zone, reason: "cod_not_available" }
 *   { serviceable: false, reason: "pincode_not_covered" }
 *   { serviceable: false, reason: "invalid_pincode" }
 */

import db from '../../lib/pincode-db.json';

// Zone → [minDays, maxDays] business days from today
const ZONE_DAYS = {
  A: [1, 2],
  B: [2, 3],
  C: [3, 4],
  D: [3, 5],
  E: [5, 7],
  F: [7, 10],
};

const DEFAULT_DAYS = [5, 7]; // fallback for unknown zones

/**
 * Add business days to a date (skips Sundays only — Indian logistics
 * typically delivers on Saturdays). Returns a Date object.
 */
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    // Skip Sundays (0)
    if (result.getDay() !== 0) added++;
  }
  return result;
}

/**
 * Format a Date as "YYYY-MM-DD" in IST.
 */
function toISODate(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA gives YYYY-MM-DD
}

/**
 * Format a Date as "Mon, 26 May" in IST.
 */
function toReadable(date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { pincode, cod = '1' } = req.query;

  if (!pincode || !/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.status(400).json({ serviceable: false, reason: 'invalid_pincode' });
  }

  const dbEntry = db[pincode];
  if (!dbEntry) {
    return res.status(200).json({ serviceable: false, reason: 'pincode_not_covered' });
  }

  const [, , codSupported, zone] = dbEntry;
  const isCod = cod !== '0';

  if (isCod && !codSupported) {
    return res.status(200).json({
      serviceable: true,
      codAvailable: false,
      zone,
      reason: 'cod_not_available',
    });
  }

  // Compute ETA from zone
  const [, maxDays] = ZONE_DAYS[zone] || DEFAULT_DAYS;
  const now = new Date();
  const etaDate = addBusinessDays(now, maxDays);

  const eta = toISODate(etaDate);
  const etaFormatted = toReadable(etaDate);

  // Cache aggressively — zone data changes only when pincode DB is rebuilt
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return res.status(200).json({
    serviceable: true,
    zone,
    eta,
    etaFormatted,
  });
}
