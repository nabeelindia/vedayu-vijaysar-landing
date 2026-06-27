// GET /api/admin/sentry-stats
// Fetches recent issues and cron monitor statuses from the Sentry REST API.
// Requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars.

export default async function handler(req, res) {
  // SENTRY_READ_TOKEN needs event:read + org:read + project:read scopes
  // Create it at: Sentry → Settings → Developer Settings → Internal Integrations
  const token   = process.env.SENTRY_READ_TOKEN || process.env.SENTRY_AUTH_TOKEN;
  const org     = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!token || !org || !project) {
    return res.status(503).json({ error: 'Sentry not configured' });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const base = 'https://sentry.io/api/0';

  const [issuesRes, monitorsRes, statsRes] = await Promise.allSettled([
    fetch(`${base}/projects/${org}/${project}/issues/?limit=10&query=is:unresolved&sort=date`, { headers }),
    fetch(`${base}/organizations/${org}/monitors/?project=${project}`, { headers }),
    fetch(`${base}/organizations/${org}/stats_v2/?project=${project}&field=sum(quantity)&groupBy=outcome&interval=1d&statsPeriod=14d&category=error`, { headers }),
  ]);

  const issues   = issuesRes.status   === 'fulfilled' && issuesRes.value.ok   ? await issuesRes.value.json()   : [];
  const monitors = monitorsRes.status === 'fulfilled' && monitorsRes.value.ok ? await monitorsRes.value.json() : [];
  const stats    = statsRes.status    === 'fulfilled' && statsRes.value.ok    ? await statsRes.value.json()    : null;

  return res.status(200).json({ issues, monitors, stats });
}
