export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const apiKey = process.env.CLARITY_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'CLARITY_API_KEY not configured' });

  try {
    const response = await fetch(
      'https://www.clarity.ms/export-data/api/v1/project-live-insights',
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    // Shape into a friendlier object
    const shaped = {};
    for (const item of data) {
      shaped[item.metricName] = item.information;
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json(shaped);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
