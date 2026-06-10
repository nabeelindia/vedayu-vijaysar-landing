import { checkAdminAuth } from '../_auth';
import { supabase }        from '../../../../lib/supabase';
import { trackShipment }   from '../../../../lib/nimbuspost';

export default async function handler(req, res) {
  if (!checkAdminAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET') return res.status(405).end();
  if (!supabase)             return res.status(503).json({ error: 'Supabase not configured' });

  const { awb } = req.query;
  if (!awb) return res.status(400).json({ error: 'AWB required' });

  try {
    const data = await trackShipment(awb);

    await supabase.from('shipments').upsert({
      awb,
      status:          data.status          || null,
      rto_status:      data.rto_status       || null,
      rto_awb:         data.rto_awb          || null,
      edd:             data.edd              || null,
      history:         data.history          || [],
      last_synced_at:  new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      raw_event:       data,
    }, { onConflict: 'awb' });

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[tracking refresh]', err.message);
    return res.status(502).json({ error: err.message });
  }
}
