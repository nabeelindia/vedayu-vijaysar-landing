/**
 * Meta Custom Audiences — sync purchasers and abandoners
 * Uses Marketing API v21.0
 * Requires: META_MARKETING_TOKEN, META_AD_ACCOUNT_ID
 */
import crypto from 'crypto';

const API_VERSION = 'v21.0';

function hash(val) {
  if (!val) return null;
  return crypto.createHash('sha256').update(String(val).trim().toLowerCase()).digest('hex');
}

function buildUserSchema(customers) {
  const schema = ['EMAIL', 'PHONE', 'FN', 'LN', 'COUNTRY'];
  const data = customers.map(c => {
    const parts = (c.name || '').trim().split(/\s+/);
    return [
      hash(c.email),
      hash(c.mobile ? `91${c.mobile.replace(/\D/g, '')}` : null),
      hash(parts[0] || ''),
      hash(parts.slice(1).join(' ') || ''),
      hash('in'),
    ];
  }).filter(row => row[0] || row[1]); // need at least email or phone
  return { schema, data };
}

async function apiCall(path, method = 'GET', body = null) {
  const token = process.env.META_MARKETING_TOKEN;
  const url = `https://graph.facebook.com/${API_VERSION}/${path}${method === 'GET' ? `?access_token=${token}` : ''}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (method !== 'GET') {
    opts.body = JSON.stringify({ ...body, access_token: token });
  }
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}

async function getOrCreateAudience(adAccountId, name, description) {
  // Search for existing audience by name
  const list = await apiCall(`act_${adAccountId}/customaudiences?fields=id,name&limit=100`);
  const existing = list.data?.find(a => a.name === name);
  if (existing) return existing.id;

  // Create new
  const created = await apiCall(`act_${adAccountId}/customaudiences`, 'POST', {
    name,
    description,
    subtype: 'CUSTOM',
    customer_file_source: 'USER_PROVIDED_ONLY',
  });
  return created.id;
}

async function uploadUsers(audienceId, customers) {
  if (!customers.length) return { added: 0 };
  const { schema, data } = buildUserSchema(customers);
  const result = await apiCall(`${audienceId}/users`, 'POST', {
    payload: { schema, data },
  });
  return { added: result.num_received || data.length };
}

export async function syncPurchasers(customers) {
  const token = process.env.META_MARKETING_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !adAccountId) throw new Error('META_MARKETING_TOKEN and META_AD_ACCOUNT_ID required');

  const audienceId = await getOrCreateAudience(
    adAccountId,
    'Vedayu — Purchasers',
    'All customers who completed a purchase on vedayulife.com'
  );
  const result = await uploadUsers(audienceId, customers);
  return { audienceId, ...result };
}

export async function syncAbandoners(leads) {
  const token = process.env.META_MARKETING_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!token || !adAccountId) throw new Error('META_MARKETING_TOKEN and META_AD_ACCOUNT_ID required');

  const audienceId = await getOrCreateAudience(
    adAccountId,
    'Vedayu — Cart Abandoners',
    'Visitors who filled the order form but did not complete purchase'
  );
  const result = await uploadUsers(audienceId, leads);
  return { audienceId, ...result };
}

export async function syncAll(purchasers, abandoners) {
  const [p, a] = await Promise.allSettled([
    syncPurchasers(purchasers),
    syncAbandoners(abandoners),
  ]);
  return {
    purchasers: p.status === 'fulfilled' ? p.value : { error: p.reason.message },
    abandoners: a.status === 'fulfilled' ? a.value : { error: a.reason.message },
  };
}
