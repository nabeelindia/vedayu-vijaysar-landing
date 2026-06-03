/**
 * Meta Marketing API — Retargeting Campaign Setup
 *
 * Creates a 3-tier retargeting funnel:
 *   Tier 1 (TOFU): Website visitors 30d  → social proof creative
 *   Tier 2 (MOFU): Product viewers 14d   → urgency/benefits creative
 *   Tier 3 (BOFU): Checkout abandoners 7d → cart recovery creative
 *
 * All pixel-based Website Custom Audiences; purchasers excluded from all tiers.
 *
 * Requires env vars:
 *   META_MARKETING_TOKEN   — long-lived Marketing API token
 *   META_AD_ACCOUNT_ID     — without "act_" prefix
 *   META_PIXEL_ID          — same pixel already on the site
 *   META_PAGE_ID           — Facebook page to run ads from
 *   META_INSTAGRAM_ID      — Instagram account (optional)
 */

const API_VERSION = 'v21.0';

async function api(path, method = 'GET', body = null) {
  const token = process.env.META_MARKETING_TOKEN;
  const base  = `https://graph.facebook.com/${API_VERSION}`;

  if (method === 'GET') {
    const url = `${base}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(`[GET ${path}] ${json.error.message}`);
    return json;
  } else {
    // Use form-encoded body — Meta Marketing API requires this for most endpoints
    const params = new URLSearchParams({ ...body, access_token: token });
    const res = await fetch(`${base}/${path}`, {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const json = await res.json();
    if (json.error) throw new Error(`[${method} ${path}] ${json.error.message}`);
    return json;
  }
}

// ─── Audiences ───────────────────────────────────────────────────────────────

async function getOrCreateWCA(adAccountId, pixelId, name, rule) {
  const list = await api(`act_${adAccountId}/customaudiences?fields=id,name&limit=200`);
  const existing = list.data?.find(a => a.name === name);
  if (existing) {
    console.log(`Audience exists: "${name}" → ${existing.id}`);
    return existing.id;
  }
  const retentionSecs = rule.inclusions?.rules?.[0]?.retention_seconds;
  const retentionDays = retentionSecs ? Math.round(retentionSecs / 86400) : 30;
  const created = await api(`act_${adAccountId}/customaudiences`, 'POST', {
    name,
    pixel_id: pixelId,
    retention_days: retentionDays,
    rule: JSON.stringify(rule),
  });
  console.log(`Audience created: "${name}" → ${created.id}`);
  return created.id;
}

export async function createRetargetingAudiences() {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const pixelId     = process.env.META_PIXEL_ID || '4274415046037928';

  const makeRule = (event, retentionSeconds) => ({
    inclusions: {
      operator: 'or',
      rules: [{
        event_sources: [{ id: pixelId, type: 'pixel' }],
        retention_seconds: retentionSeconds,
        filter: { operator: 'and', filters: [{ field: 'event', operator: 'i_contains', value: event }] },
      }],
    },
  });

  // TOFU: any website visitor, last 30 days
  const visitorsId = await getOrCreateWCA(adAccountId, pixelId,
    'Vedayu — Website Visitors 30d', makeRule('PageView', 2592000));

  // MOFU: viewed product page (ViewContent), last 14 days
  const viewersId = await getOrCreateWCA(adAccountId, pixelId,
    'Vedayu — Product Viewers 14d', makeRule('ViewContent', 1209600));

  // BOFU: started checkout (InitiateCheckout), last 7 days
  const checkoutId = await getOrCreateWCA(adAccountId, pixelId,
    'Vedayu — Checkout Abandoners 7d', makeRule('InitiateCheckout', 604800));

  // Exclusion: purchasers, last 180 days
  const purchasersExclId = await getOrCreateWCA(adAccountId, pixelId,
    'Vedayu — Purchasers 180d (Exclusion)', makeRule('Purchase', 15552000));

  return { visitorsId, viewersId, checkoutId, purchasersExclId };
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export async function createRetargetingCampaign(name = 'Vedayu — Retargeting 2026') {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  // Check for existing campaign
  const existing = await api(`act_${adAccountId}/campaigns?fields=id,name,status&limit=100`);
  const found = existing.data?.find(c => c.name === name);
  if (found) {
    console.log(`Campaign exists: "${name}" → ${found.id}`);
    return found.id;
  }

  const camp = await api(`act_${adAccountId}/campaigns`, 'POST', {
    name,
    objective: 'OUTCOME_SALES',
    status: 'PAUSED', // start paused; activate after review
    special_ad_categories: 'NONE',
    buying_type: 'AUCTION',
    is_adset_budget_sharing_enabled: false,
  });
  console.log(`Campaign created: "${name}" → ${camp.id}`);
  return camp.id;
}

// ─── Ad Sets ──────────────────────────────────────────────────────────────────

async function createAdset(adAccountId, campaignId, name, audienceIds, excludeIds, dailyBudget) {
  const existing = await api(`act_${adAccountId}/adsets?fields=id,name&limit=200`);
  const found = existing.data?.find(a => a.name === name);
  if (found) {
    console.log(`Adset exists: "${name}" → ${found.id}`);
    return found.id;
  }

  const targeting = {
    geo_locations:    { countries: ['IN'] },
    age_min:          25,
    age_max:          65,
    custom_audiences: audienceIds.map(id => ({ id })),
    ...(excludeIds.length ? {
      excluded_custom_audiences: excludeIds.map(id => ({ id })),
    } : {}),
  };

  const adset = await api(`act_${adAccountId}/adsets`, 'POST', {
    name,
    campaign_id:       campaignId,
    status:            'PAUSED',
    daily_budget:      dailyBudget,
    billing_event:     'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS',
    bid_strategy:      'LOWEST_COST_WITHOUT_CAP',
    destination_type:  'WEBSITE',
    promoted_object:   JSON.stringify({ pixel_id: process.env.META_PIXEL_ID || '4274415046037928', custom_event_type: 'PURCHASE' }),
    targeting:         JSON.stringify(targeting),
    attribution_spec:  JSON.stringify([{ event_type: 'CLICK_THROUGH', window_days: 7 }, { event_type: 'VIEW_THROUGH', window_days: 1 }]),
  });
  console.log(`Adset created: "${name}" → ${adset.id}`);
  return adset.id;
}

export async function createRetargetingAdsets(campaignId, audienceIds) {
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  const { visitorsId, viewersId, checkoutId, purchasersExclId } = audienceIds;

  const [tofuId, mofuId, bofuId] = await Promise.all([
    createAdset(
      adAccountId, campaignId,
      'TOFU — Visitors 30d',
      [visitorsId],
      [purchasersExclId, viewersId], // exclude buyers and already-engaged
      50000  // ₹500/day
    ),
    createAdset(
      adAccountId, campaignId,
      'MOFU — Product Viewers 14d',
      [viewersId],
      [purchasersExclId, checkoutId],
      75000  // ₹750/day
    ),
    createAdset(
      adAccountId, campaignId,
      'BOFU — Checkout Abandoners 7d',
      [checkoutId],
      [purchasersExclId],
      100000 // ₹1000/day — highest intent
    ),
  ]);

  return { tofuId, mofuId, bofuId };
}

// ─── Creatives & Ads ─────────────────────────────────────────────────────────

async function uploadImage(adAccountId, imageUrl) {
  // Use URL-based image upload (Meta will fetch from CDN)
  const result = await api(`act_${adAccountId}/adimages`, 'POST', {
    url: imageUrl,
  });
  const hash = Object.values(result.images || {})?.[0]?.hash;
  if (!hash) throw new Error('Image upload failed — no hash returned');
  return hash;
}

async function createCreative(adAccountId, name, pageId, instagramId, imageHash, headline, body, cta, linkUrl) {
  const existing = await api(`act_${adAccountId}/adcreatives?fields=id,name&limit=200`);
  const found = existing.data?.find(c => c.name === name);
  if (found) {
    console.log(`Creative exists: "${name}" → ${found.id}`);
    return found.id;
  }

  const storySpec = {
    page_id: pageId,
    link_data: {
      image_hash:  imageHash,
      link:        linkUrl,
      message:     body,
      name:        headline,
      call_to_action: { type: cta, value: { link: linkUrl } },
    },
  };
  if (instagramId) storySpec.instagram_user_id = instagramId;

  const creative = await api(`act_${adAccountId}/adcreatives`, 'POST', {
    name,
    object_story_spec: JSON.stringify(storySpec),
  });
  console.log(`Creative created: "${name}" → ${creative.id}`);
  return creative.id;
}

async function createAd(adAccountId, adsetId, name, creativeId) {
  const existing = await api(`act_${adAccountId}/ads?fields=id,name&limit=200`);
  const found = existing.data?.find(a => a.name === name);
  if (found) {
    console.log(`Ad exists: "${name}" → ${found.id}`);
    return found.id;
  }
  const ad = await api(`act_${adAccountId}/ads`, 'POST', {
    name,
    adset_id: adsetId,
    status:   'PAUSED',
    creative: JSON.stringify({ creative_id: creativeId }),
  });
  console.log(`Ad created: "${name}" → ${ad.id}`);
  return ad.id;
}

export async function createRetargetingAds(adsetIds) {
  const adAccountId  = process.env.META_AD_ACCOUNT_ID;
  const pageId       = process.env.META_PAGE_ID;
  const instagramId  = process.env.META_INSTAGRAM_ID || null;
  const siteUrl      = 'https://vedayulife.com';

  const { tofuId, mofuId, bofuId } = adsetIds;

  // Each tier uses the site's OG image (served from Next.js); override with hosted URLs as needed
  const productImageUrl = `${siteUrl}/images/product.jpg`;

  let imageHash;
  try {
    imageHash = await uploadImage(adAccountId, productImageUrl);
  } catch (err) {
    console.warn('Image upload failed, using existing hash logic:', err.message);
    imageHash = null;
  }

  const tiers = [
    {
      adsetId:  tofuId,
      name:     'TOFU — Social Proof',
      headline: '5,000+ families trust Vedayu',
      body:     '🌿 The ancient Vijaysar wood glass that Ayurveda has trusted for 3,000 years. Helps with blood sugar, digestion & immunity — naturally. ✅ Free delivery | Cash on delivery available.',
      cta:      'LEARN_MORE',
    },
    {
      adsetId:  mofuId,
      name:     'MOFU — Benefits Reminder',
      headline: 'Still thinking about it? Here\'s why 5,000 families chose Vedayu',
      body:     '💧 Soak water overnight in our Vijaysar glass → drink in the morning. That\'s all it takes. Blood sugar • Digestion • Cholesterol • Immunity. ₹499 with free delivery. Limited stock.',
      cta:      'SHOP_NOW',
    },
    {
      adsetId:  bofuId,
      name:     'BOFU — Cart Recovery',
      headline: 'You left something behind 👀',
      body:     '⚡ Your Vijaysar Wooden Glass is still available — but stock is running low. Complete your order now and get free delivery + cash on delivery. Don\'t miss out.',
      cta:      'ORDER_NOW',
    },
  ];

  const ads = [];
  for (const tier of tiers) {
    try {
      const creativeId = imageHash
        ? await createCreative(
            adAccountId, `${tier.name} Creative`, pageId, instagramId,
            imageHash, tier.headline, tier.body, tier.cta, siteUrl
          )
        : null;

      if (!creativeId) {
        console.warn(`Skipping ad "${tier.name}" — no creative`);
        continue;
      }

      const adId = await createAd(adAccountId, tier.adsetId, tier.name, creativeId);
      ads.push({ name: tier.name, adId, creativeId });
    } catch (err) {
      console.error(`Failed to create ad "${tier.name}":`, err.message);
      ads.push({ name: tier.name, error: err.message });
    }
  }

  return ads;
}

// ─── Full Setup ───────────────────────────────────────────────────────────────

export async function setupRetargetingCampaign() {
  console.log('=== Vedayu Retargeting Campaign Setup ===');

  const audienceIds  = await createRetargetingAudiences();
  console.log('Audiences:', audienceIds);

  const campaignId   = await createRetargetingCampaign();
  console.log('Campaign:', campaignId);

  const adsetIds     = await createRetargetingAdsets(campaignId, audienceIds);
  console.log('Adsets:', adsetIds);

  const ads          = await createRetargetingAds(adsetIds);
  console.log('Ads:', ads);

  return { audienceIds, campaignId, adsetIds, ads };
}
