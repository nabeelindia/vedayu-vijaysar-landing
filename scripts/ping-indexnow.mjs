import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const KEY = '7b99fb76a8dc49ce958be440e3138a51';
const HOST = 'vedayulife.com';
const BASE_URL = `https://${HOST}`;

// Static pages to always notify
const STATIC_URLS = [
  `${BASE_URL}/`,
  `${BASE_URL}/blog`,
  `${BASE_URL}/contact`,
  `${BASE_URL}/privacy`,
  `${BASE_URL}/terms`,
  `${BASE_URL}/refund-policy`,
  `${BASE_URL}/shipping-policy`,
];

function getBlogUrls() {
  const blogDir = path.join(ROOT, 'content/blog');
  if (!fs.existsSync(blogDir)) return [];
  return fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.mdx'))
    .map(file => {
      const raw = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const slugMatch = raw.match(/^slug:\s*"?([^"\n]+)"?/m);
      const slug = slugMatch ? slugMatch[1].trim() : file.replace(/\.mdx$/, '');
      return `${BASE_URL}/blog/${slug}`;
    });
}

async function pingIndexNow(urls) {
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: `${BASE_URL}/${KEY}.txt`,
    urlList: urls,
  };

  console.log(`Pinging IndexNow with ${urls.length} URLs...`);
  urls.forEach(u => console.log(' -', u));

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (res.ok || res.status === 202) {
    console.log(`IndexNow: success (${res.status})`);
  } else {
    console.error(`IndexNow: failed with status ${res.status}`);
    process.exit(1);
  }
}

const allUrls = [...STATIC_URLS, ...getBlogUrls()];
await pingIndexNow(allUrls);
