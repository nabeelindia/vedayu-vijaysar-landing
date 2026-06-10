const KEY = '7b99fb76a8dc49ce958be440e3138a51';
const HOST = 'vedayulife.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { urls } = req.body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array required' });
  }

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  };

  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });

  return res.status(response.status).json({ status: response.status });
}
