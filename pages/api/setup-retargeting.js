/**
 * POST /api/setup-retargeting
 * One-time endpoint to create the full retargeting campaign structure on Meta.
 * All assets are created PAUSED — activate in Ads Manager after review.
 *
 * Required env vars:
 *   META_MARKETING_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID
 * Optional:
 *   META_PIXEL_ID (defaults to hardcoded pixel), META_INSTAGRAM_ID
 */
import { setupRetargetingCampaign } from '../../lib/meta-retargeting';

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const required = ['META_MARKETING_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
  }

  try {
    const result = await setupRetargetingCampaign();
    return res.status(200).json({
      success: true,
      note: 'All assets created PAUSED. Review in Meta Ads Manager and activate.',
      ...result,
    });
  } catch (err) {
    console.error('Retargeting setup failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
