/**
 * scripts/upload-videos.mjs
 * One-time script to upload Vedayu video files to Vercel Blob CDN.
 *
 * Prerequisites:
 *   1. Enable Blob storage in Vercel dashboard → Storage → Create → Blob
 *   2. Copy the BLOB_READ_WRITE_TOKEN from the .env.local snippet Vercel shows you
 *   3. Run: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXX node scripts/upload-videos.mjs
 *
 * After upload, copy the 3 URLs printed below into pages/index.js
 * (replace the /videos/xxx.mp4 src values with the blob URLs).
 */

import { put } from '@vercel/blob';
import { createReadStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const VIDEOS = [
  { local: 'public/videos/celebrity.mp4',   blob: 'vedayu/celebrity.mp4' },
  { local: 'public/videos/testimonial.mp4', blob: 'vedayu/testimonial.mp4' },
  { local: 'public/videos/meta-ad.mp4',     blob: 'vedayu/meta-ad.mp4' },
];

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('\n❌  BLOB_READ_WRITE_TOKEN is not set.');
  console.error('   Run: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_XXXX node scripts/upload-videos.mjs\n');
  process.exit(1);
}

console.log('\n🚀  Uploading videos to Vercel Blob...\n');

for (const { local, blob } of VIDEOS) {
  const fullPath = join(ROOT, local);
  let size;
  try {
    size = statSync(fullPath).size;
  } catch {
    console.warn(`⚠️   Skipping ${local} — file not found`);
    continue;
  }

  const mb = (size / 1024 / 1024).toFixed(1);
  process.stdout.write(`⬆️   ${local} (${mb} MB) ... `);

  const stream = createReadStream(fullPath);

  const result = await put(blob, stream, {
    access:          'public',
    contentType:     'video/mp4',
    addRandomSuffix: false,
  }).catch(err => {
    if (err.message?.includes('private')) {
      console.error(`\n❌  Your Blob store is set to PRIVATE access.`);
      console.error(`   Videos must be publicly streamable in a browser.`);
      console.error(`   Fix: Vercel dashboard → Storage → your Blob store → Settings → Access → set to Public\n`);
      process.exit(1);
    }
    throw err;
  });

  console.log(`✅  ${result.url}`);
}

console.log('\n✅  All done! Copy the URLs above into pages/index.js\n');
