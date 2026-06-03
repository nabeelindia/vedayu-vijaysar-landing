import { OAuth2Client } from 'google-auth-library';

let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const client = new OAuth2Client(
    process.env.GA_OAUTH_CLIENT_ID,
    process.env.GA_OAUTH_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: process.env.GA_REFRESH_TOKEN });
  const { token } = await client.getAccessToken();
  _cachedToken = token;
  _tokenExpiry = Date.now() + 55 * 60 * 1000;
  return _cachedToken;
}

async function runReport(propertyId, accessToken, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA API ${res.status}: ${err}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId || !process.env.GA_CLIENT_EMAIL || !process.env.GA_PRIVATE_KEY) {
    return res.status(500).json({ error: 'GA credentials not configured' });
  }

  try {
    const token = await getAccessToken();

    const dateRange = [{ startDate: '30daysAgo', endDate: 'today' }];

    const [overview, topPages, channels, devices, countries] = await Promise.all([
      // Overview metrics
      runReport(propertyId, token, {
        dateRanges: dateRange,
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'newUsers' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
          { name: 'screenPageViewsPerSession' },
        ],
      }),
      // Top pages
      runReport(propertyId, token, {
        dateRanges: dateRange,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'bounceRate' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 8,
      }),
      // Traffic channels
      runReport(propertyId, token, {
        dateRanges: dateRange,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'conversions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      }),
      // Devices
      runReport(propertyId, token, {
        dateRanges: dateRange,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'bounceRate' }],
      }),
      // Countries
      runReport(propertyId, token, {
        dateRanges: dateRange,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 8,
      }),
    ]);

    const parseRows = (report) =>
      (report.rows || []).map(row => ({
        dims: row.dimensionValues?.map(d => d.value) || [],
        vals: row.metricValues?.map(m => m.value) || [],
      }));

    const ov = overview.rows?.[0]?.metricValues || [];
    const fmtDur = (s) => {
      const sec = Math.round(+s);
      return `${Math.floor(sec/60)}m ${sec%60}s`;
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      period: '30 days',
      overview: {
        sessions:           ov[0]?.value || '0',
        activeUsers:        ov[1]?.value || '0',
        newUsers:           ov[2]?.value || '0',
        bounceRate:         (+( ov[3]?.value || 0) * 100).toFixed(1),
        avgSessionDuration: fmtDur(ov[4]?.value || 0),
        conversions:        ov[5]?.value || '0',
        revenue:            (+( ov[6]?.value || 0)).toFixed(2),
        pagesPerSession:    (+(ov[7]?.value || 0)).toFixed(2),
      },
      topPages:   parseRows(topPages).map(r => ({ page: r.dims[0], views: r.vals[0], users: r.vals[1], bounceRate: (+r.vals[2]*100).toFixed(1) })),
      channels:   parseRows(channels).map(r => ({ channel: r.dims[0], sessions: r.vals[0], users: r.vals[1], conversions: r.vals[2] })),
      devices:    parseRows(devices).map(r => ({ device: r.dims[0], sessions: r.vals[0], bounceRate: (+r.vals[1]*100).toFixed(1) })),
      countries:  parseRows(countries).map(r => ({ country: r.dims[0], sessions: r.vals[0], users: r.vals[1] })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
