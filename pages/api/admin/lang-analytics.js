/**
 * GET /api/admin/lang-analytics
 * Returns language usage stats from Vercel KV.
 */
import { kv } from '@vercel/kv';
import { checkAdminAuth } from './_auth';

const LOCALES = ['en', 'hi', 'ta', 'te'];
const LOCALE_LABELS = { en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu' };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // All-time totals
    const totalRaw = await kv.hgetall('lang:total') || {};
    const total = LOCALES.map(loc => ({
      locale: loc,
      label: LOCALE_LABELS[loc],
      count: Number(totalRaw[loc] || 0),
    })).sort((a, b) => b.count - a.count);

    // Last 14 days daily breakdown
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const dailyData = await Promise.all(
      days.map(day => kv.hgetall(`lang:daily:${day}`).then(v => ({ day, counts: v || {} })))
    );

    return res.status(200).json({ total, daily: dailyData });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
