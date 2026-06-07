/**
 * POST /api/track-lang
 * Increments a language usage counter in Vercel KV.
 * Called once per locale per session from _app.js.
 */
import { kv } from '@vercel/kv';

const SUPPORTED = ['en', 'hi', 'ta', 'te'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { locale } = req.body || {};
    if (!locale || !SUPPORTED.includes(locale)) return res.status(400).json({ error: 'invalid locale' });

    const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    await Promise.all([
      kv.hincrby('lang:total', locale, 1),
      kv.hincrby(`lang:daily:${dateKey}`, locale, 1),
    ]);

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Never fail the user experience for analytics
    return res.status(200).json({ ok: true });
  }
}
