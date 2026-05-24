/**
 * scripts/build-pincode-db.mjs
 *
 * Converts a Velocity serviceability CSV export into lib/pincode-db.json.
 *
 * Usage:
 *   node scripts/build-pincode-db.mjs <path-to-csv>
 *
 * Example:
 *   node scripts/build-pincode-db.mjs ~/Downloads/velocity-serviceability.csv
 *
 * The CSV must have these columns (from Velocity dashboard → Reports → Serviceability):
 *   Delivery Pincode, Delivery City, Delivery State, Is COD Available?, Zone
 *
 * Output: lib/pincode-db.json — commit this file after running.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const OUT_FILE  = path.join(ROOT, 'lib', 'pincode-db.json');

// State name aliases — normalize Velocity's spelling to match the form dropdown
const STATE_FIX = {
  'Orissa':                  'Odisha',
  'Pondicherry':             'Puducherry',
  'Dadra And Nagar Haveli':  'Dadra & Nagar Haveli',
  'Andaman & Nicobar':       'Andaman & Nicobar Islands',
  'Uttaranchal':             'Uttarakhand',
  'Jammu And Kashmir':       'Jammu & Kashmir',
};

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node scripts/build-pincode-db.mjs <path-to-csv>');
  process.exit(1);
}

const raw  = fs.readFileSync(path.resolve(csvPath), 'utf-8');
const lines = raw.split(/\r?\n/).filter(Boolean);

// Parse header
const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
const col    = name => header.indexOf(name);

const iDelivPin   = col('Delivery Pincode');
const iDelivCity  = col('Delivery City');
const iDelivState = col('Delivery State');
const iCod        = col('Is COD Available?');
const iZone       = col('Zone');

if (iDelivPin < 0 || iDelivCity < 0 || iDelivState < 0) {
  console.error('CSV missing required columns. Expected: Delivery Pincode, Delivery City, Delivery State');
  process.exit(1);
}

const clean  = s => s.replace(/^"|"$/g, '').trim();
const lookup = {};

for (let i = 1; i < lines.length; i++) {
  const cells = lines[i].split(',');
  const pin   = clean(cells[iDelivPin]   || '');
  const city  = clean(cells[iDelivCity]  || '');
  let   state = clean(cells[iDelivState] || '');
  const cod   = clean(cells[iCod]        || '').toLowerCase() === 'yes' ? 1 : 0;
  const zone  = clean(cells[iZone]       || '');

  state = STATE_FIX[state] || state;

  if (/^[1-9]\d{5}$/.test(pin) && city && state && !lookup[pin]) {
    // Compact array: [city, state, cod, zone]
    lookup[pin] = [city, state, cod, zone];
  }
}

const count = Object.keys(lookup).length;
const json  = JSON.stringify(lookup, null, 0); // no whitespace = smallest file
fs.writeFileSync(OUT_FILE, json);

console.log(`✅ Built pincode-db.json`);
console.log(`   Pincodes: ${count}`);
console.log(`   File size: ${(json.length / 1024).toFixed(1)} KB`);
console.log(`   Output: ${OUT_FILE}`);
console.log('');
console.log('Now commit lib/pincode-db.json and redeploy.');
