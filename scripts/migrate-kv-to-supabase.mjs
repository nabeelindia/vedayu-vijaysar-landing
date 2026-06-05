// scripts/migrate-kv-to-supabase.mjs
// Run: node --env-file=.env.local scripts/migrate-kv-to-supabase.mjs
import { createClient } from '@supabase/supabase-js';
import { createClient as createKvClient } from '@vercel/kv';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

const kv = createKvClient({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function migrateFollowupQueue() {
  console.log('\n── followup_queue ──────────────────────');
  const ids = await kv.smembers('followup:active');
  if (!ids?.length) { console.log('  No active followup entries.'); return; }

  for (const orderId of ids) {
    const d = await kv.get(`followup:${orderId}`);
    if (!d) continue;

    const { error } = await supabase.from('followup_queue').upsert({
      order_id:     d.orderId,
      email:        d.email,
      name:         d.name,
      pack:         d.pack,
      price:        d.price,
      method:       d.method,
      mobile:       d.mobile || null,
      order_ts:     new Date(d.orderTs).toISOString(),
      sent_d3:      d.sent?.d3  || false,
      sent_d7:      d.sent?.d7  || false,
      sent_d30:     d.sent?.d30 || false,
      sent_d90:     d.sent?.d90 || false,
      unsubscribed: false,
    }, { onConflict: 'order_id' });

    if (error) console.error(`  ✗ ${orderId}: ${error.message}`);
    else       console.log(`  ✓ ${orderId}`);
  }
}

async function migrateReferrals() {
  console.log('\n── referrals ───────────────────────────');
  let cursor = 0;
  let keys = [];
  do {
    const [nextCursor, batch] = await kv.scan(cursor, { match: 'referral:owner:*', count: 100 });
    cursor = Number(nextCursor);
    keys = keys.concat(batch);
  } while (cursor !== 0);

  console.log(`  Found ${keys.length} referral:owner entries`);

  for (const key of keys) {
    const orderId     = key.replace('referral:owner:', '');
    const ownerMobile = await kv.get(key);
    const used        = await kv.get(`referral:used:${orderId}`);

    const { error } = await supabase.from('referrals').upsert({
      order_id:     orderId,
      owner_mobile: ownerMobile || '',
      referrer_id:  used?.referrerId || null,
      discount:     used?.discount   || null,
      method:       used?.method     || null,
    }, { onConflict: 'order_id' });

    if (error) console.error(`  ✗ ${orderId}: ${error.message}`);
    else       console.log(`  ✓ ${orderId}`);
  }
}

async function migrateShipments() {
  console.log('\n── shipments ───────────────────────────');
  let cursor = 0;
  let keys = [];
  do {
    const [nextCursor, batch] = await kv.scan(cursor, { match: 'nimbuspost:order:*', count: 100 });
    cursor = Number(nextCursor);
    keys = keys.concat(batch);
  } while (cursor !== 0);

  console.log(`  Found ${keys.length} nimbuspost:order entries`);

  for (const key of keys) {
    const orderId = key.replace('nimbuspost:order:', '');
    const d = await kv.get(key);
    if (!d) continue;

    const { error } = await supabase.from('shipments').upsert({
      order_id:            orderId,
      awb:                 d.awb || null,
      courier:             'nimbuspost',
      nimbuspost_order_id: d.nimbuspostOrderId || null,
      mobile:              d.mobile || null,
      email:               d.email  || null,
      name:                d.name   || null,
      label_url:           d.labelUrl || null,
      last_updated_at:     new Date().toISOString(),
    }, { onConflict: 'order_id' });

    if (error) console.error(`  ✗ ${orderId}: ${error.message}`);
    else       console.log(`  ✓ ${orderId}`);
  }
}

async function main() {
  console.log('KV → Supabase migration starting…\n');
  await migrateFollowupQueue();
  await migrateReferrals();
  await migrateShipments();
  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
