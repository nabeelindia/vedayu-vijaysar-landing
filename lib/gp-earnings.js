import { supabase } from './supabase';

export async function trackGpEarning(orderId, gpRef) {
  if (!gpRef || typeof gpRef !== 'string') return;
  try {
    const { data: partner } = await supabase
      .from('growth_partners')
      .select('id')
      .ilike('handle', gpRef)
      .single();
    if (!partner) return;
    await supabase.from('gp_earnings').insert({
      partner_id: partner.id,
      order_id:   orderId,
      amount:     100,
      status:     'pending',
    });
  } catch (err) {
    console.error('[gp-earnings] trackGpEarning error:', err.message);
  }
}
