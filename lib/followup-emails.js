/**
 * HTML email templates for the post-purchase follow-up sequence.
 * Each returns { subject, html } ready for Resend.
 */

const WA_NUM = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999';

const footer = (orderId) => `
  <p style="text-align:center;font-size:.72rem;color:#aaa;margin-top:16px;line-height:1.6;">
    Vedayu Wellness · vedayulife.com<br/>
    <em>This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease.</em><br/>
    <a href="https://vedayulife.com" style="color:#9e8060;">vedayulife.com</a> ·
    <a href="https://vedayulife.com/api/unsubscribe?orderId=${orderId}" style="color:#aaa;">Unsubscribe</a>
  </p>`;

const header = (emoji, title, subtitle, bgColor = '#5C3D1E') => `
  <div style="background:${bgColor};padding:24px;border-radius:8px 8px 0 0;text-align:center;">
    <div style="font-size:2rem;margin-bottom:8px;">${emoji}</div>
    <h1 style="color:#fff;margin:0;font-size:1.3rem;">${title}</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:.88rem;">${subtitle}</p>
  </div>`;

const wrap = (content, orderId) => `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C1810;">
    ${content}
    ${footer(orderId)}
  </div>`;

const card = (inner) => `
  <div style="background:#fff;border:1px solid #D4B896;border-top:none;padding:28px;border-radius:0 0 8px 8px;">
    ${inner}
  </div>`;

const btn = (href, text, bg = '#5C3D1E', color = '#fff') =>
  `<a href="${href}" style="display:inline-block;background:${bg};color:${color};text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:.9rem;">${text}</a>`;


// ── Day 3: Dispatch nudge ─────────────────────────────────────────────────────
export function day3Email({ name, orderId, pack }) {
  return {
    subject: `🚚 Your Vijaysar Glass is on its way, ${name}!`,
    html: wrap(`
      ${header('🚚', 'Your Order is on its Way!', 'Vedayu Vijaysar Wooden Glass')}
      ${card(`
        <p>Hi <strong>${name}</strong>,</p>
        <p style="line-height:1.7;">Great news — your <strong>${pack}</strong> is on its way! You should receive it within the next <strong>2–4 business days</strong> depending on your location.</p>

        <div style="background:#FFF8E1;border:2px solid #C9A84C;border-radius:10px;padding:16px;text-align:center;margin:20px 0;">
          <p style="margin:0 0 4px;font-size:.75rem;font-weight:700;color:#6D4C00;text-transform:uppercase;letter-spacing:1px;">Your Order ID</p>
          <p style="margin:0;font-size:1.2rem;font-weight:800;color:#5C3D1E;font-family:monospace;">${orderId}</p>
        </div>

        <p style="line-height:1.7;"><strong>While you wait,</strong> here's how to get started the moment your glass arrives:</p>
        <ol style="padding-left:18px;line-height:2.2;color:#3D2610;">
          <li>Rinse the glass once with plain water</li>
          <li>Fill with room temperature drinking water that same evening</li>
          <li>Keep overnight for 6–8 hours (cover if needed)</li>
          <li>Drink the infused water first thing the next morning — before chai, before anything</li>
        </ol>

        <div style="background:#FFF8EE;border-left:4px solid #C9A84C;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0;font-size:.88rem;color:#5C3D1E;">
          💡 <strong>Tip:</strong> The water will turn a pale pink or light brownish colour overnight — this is completely normal and is the natural phytochemicals from the Vijaysar wood infusing into the water.
        </div>

        <div style="text-align:center;margin-top:24px;">
          ${btn(`https://wa.me/91${WA_NUM}?text=Hi%20Vedayu!%20My%20order%20ID%20is%20${orderId}.%20Can%20you%20share%20the%20tracking%20details%3F`, '💬 Get Tracking Update on WhatsApp', '#25D366')}
        </div>
      `)}
    `, orderId),
  };
}


// ── Day 7: Usage tips ─────────────────────────────────────────────────────────
export function day7Email({ name, orderId }) {
  return {
    subject: `🌿 Your first week with Vijaysar — tips to get the most out of it`,
    html: wrap(`
      ${header('🌿', 'Your First Week with Vijaysar', 'Make the most of your morning ritual', '#4A7C59')}
      ${card(`
        <p>Hi <strong>${name}</strong>,</p>
        <p style="line-height:1.7;">You've had your Vijaysar glass for about a week now. In Ayurvedic tradition, consistency over the first few weeks is what matters most — so well done for starting the ritual.</p>

        <h3 style="font-family:Georgia,serif;color:#5C3D1E;margin:24px 0 12px;">Common Questions in the First Week</h3>

        <div style="border-bottom:1px solid #f0e8d8;padding:12px 0;">
          <p style="margin:0 0 6px;font-weight:700;color:#3D2610;">❓ The water isn't turning pink — is something wrong?</p>
          <p style="margin:0;font-size:.88rem;line-height:1.6;color:#5C3D1E;">New glasses sometimes take 3–5 days to show strong colour. If there's no colour change at all after 7 days, WhatsApp us — we'll help you check authenticity.</p>
        </div>
        <div style="border-bottom:1px solid #f0e8d8;padding:12px 0;">
          <p style="margin:0 0 6px;font-weight:700;color:#3D2610;">❓ Can I add anything to the water?</p>
          <p style="margin:0;font-size:.88rem;line-height:1.6;color:#5C3D1E;">Drink it plain. Don't add lemon, honey, or anything else. The whole point is the pure Vijaysar infusion — additives change the pH and reduce effectiveness.</p>
        </div>
        <div style="border-bottom:1px solid #f0e8d8;padding:12px 0;">
          <p style="margin:0 0 6px;font-weight:700;color:#3D2610;">❓ What if I forget one day?</p>
          <p style="margin:0;font-size:.88rem;line-height:1.6;color:#5C3D1E;">Just resume the next evening. The practice is about consistency over 90 days, not perfection on any single day.</p>
        </div>
        <div style="padding:12px 0;">
          <p style="margin:0 0 6px;font-weight:700;color:#3D2610;">❓ Do I use soap to clean it?</p>
          <p style="margin:0;font-size:.88rem;line-height:1.6;color:#5C3D1E;">Never. Plain water rinse only. No soap, no dishwasher, no soaking in water for extended periods. After rinsing, dry thoroughly and store upright.</p>
        </div>

        <div style="background:#FFF8EE;border-left:4px solid #C9A84C;padding:14px 16px;margin:20px 0;border-radius:0 8px 8px 0;">
          <p style="margin:0;font-size:.88rem;color:#5C3D1E;line-height:1.7;">
            📖 <strong>Want to learn more?</strong> Read our guide on <a href="https://vedayulife.com/blog/vijaysar-wooden-glass-benefits" style="color:#5C3D1E;font-weight:600;">Vijaysar wooden glass benefits</a> or our detailed article on <a href="https://vedayulife.com/blog/vijaysar-glass-for-diabetes" style="color:#5C3D1E;font-weight:600;">using Vijaysar alongside diabetes care</a>.
          </p>
        </div>

        <div style="text-align:center;margin-top:24px;">
          ${btn(`https://wa.me/91${WA_NUM}?text=Hi%20Vedayu!%20I%20have%20a%20question%20about%20my%20glass.%20Order%20ID:%20${orderId}`, '💬 Ask Us Anything on WhatsApp', '#25D366')}
        </div>
      `)}
    `, orderId),
  };
}


// ── Day 30: Check-in + review request ────────────────────────────────────────
export function day30Email({ name, orderId }) {
  return {
    subject: `🌸 One month in, ${name} — how's your morning ritual going?`,
    html: wrap(`
      ${header('🌸', 'One Month of Vijaysar', 'We\'d love to hear how it\'s going')}
      ${card(`
        <p>Hi <strong>${name}</strong>,</p>
        <p style="line-height:1.7;">It's been about a month since you started your Vijaysar morning ritual. In Ayurvedic tradition, 30 days is when the practice starts to feel natural — part of your rhythm rather than something you have to remember.</p>

        <p style="line-height:1.7;">We'd love to know how you're finding it. Your experience genuinely helps other people make an informed decision.</p>

        <div style="background:#FFF8EE;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
          <p style="margin:0 0 8px;font-weight:700;color:#3D2610;font-size:.95rem;">Share Your Experience</p>
          <p style="margin:0 0 16px;font-size:.85rem;color:#5C3D1E;line-height:1.6;">Even a few words on Google or WhatsApp helps other families find Vedayu and make an informed choice.</p>
          ${btn('https://g.page/r/vedayu/review', '⭐ Leave a Google Review', '#C9A84C', '#3D2610')}
        </div>

        <p style="line-height:1.7;font-size:.88rem;color:#5C3D1E;">You're one-third of the way through the traditional 90-day cycle. Keep going — <strong>the next 60 days are where Ayurvedic practice says the real benefits compound.</strong></p>

        <div style="text-align:center;margin-top:20px;">
          ${btn(`https://wa.me/91${WA_NUM}?text=Hi%20Vedayu!%20I've%20been%20using%20my%20glass%20for%20a%20month.%20Order%20ID:%20${orderId}`, '💬 Share Your Experience on WhatsApp', '#25D366')}
        </div>
      `)}
    `, orderId),
  };
}


// ── Day 90: Ritual complete + upsell ─────────────────────────────────────────
export function day90Email({ name, pack, orderId }) {
  const isPackOf1 = pack?.includes('1');
  return {
    subject: `🎉 90 days complete, ${name}! You've finished your first Vijaysar ritual cycle`,
    html: wrap(`
      ${header('🎉', '90 Days Complete!', 'You\'ve finished your first Vijaysar ritual cycle', '#C9A84C')}
      ${card(`
        <p style="color:#5C3D1E;">Hi <strong>${name}</strong>,</p>
        <p style="line-height:1.7;">Congratulations — you've completed a full 90-day Vijaysar ritual cycle. In Ayurvedic tradition, this is a meaningful milestone. You've built a real morning wellness habit rooted in 2,000 years of practice.</p>

        <div style="background:#FFF8EE;border:1px solid #e8ddd0;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 4px;font-size:.78rem;color:#9e8060;text-transform:uppercase;letter-spacing:1px;">Traditional Ayurvedic Guidance</p>
          <p style="margin:0;font-family:Georgia,serif;font-size:1.05rem;color:#3D2610;font-style:italic;line-height:1.7;">"After 90 days, take a 15–30 day break, then resume for the next cycle."</p>
        </div>

        <div style="background:#FFF3CD;border:1px solid #e0c060;border-radius:10px;padding:18px 20px;margin:20px 0;">
          <p style="margin:0 0 8px;font-weight:700;color:#7a5c00;font-size:.9rem;">⏳ About Your Glass's Potency</p>
          <p style="margin:0;font-size:.87rem;color:#5c4400;line-height:1.7;">After 90 days of daily use, the Vijaysar wood's natural infusion gradually weakens — the water will start to show less colour change, which is a sign the wood is spent. For your next cycle to be just as effective, <strong>start fresh with a new glass</strong>. Think of it like a tea bag — it works beautifully for its season, then needs replacing.</p>
        </div>

        ${isPackOf1 ? `
        <div style="background:linear-gradient(135deg,#5C3D1E,#7a5028);border-radius:12px;padding:24px;text-align:center;margin:24px 0;color:#fff;">
          <p style="margin:0 0 6px;font-size:.78rem;color:#C9A84C;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Most Popular for Families</p>
          <h3 style="margin:0 0 10px;font-family:Georgia,serif;font-size:1.2rem;">Family Pack of 5</h3>
          <p style="margin:0 0 16px;font-size:.85rem;color:rgba(255,255,255,.85);line-height:1.6;">One glass per family member — so everyone can build the morning ritual together. Plus you'll always have a backup.</p>
          ${btn('https://vedayulife.com/', '🛒 Order Family Pack — Free Delivery', '#C9A84C', '#3D2610')}
        </div>` : `
        <div style="background:#FFF8EE;border:1px solid #e8ddd0;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
          <p style="margin:0 0 12px;font-size:.88rem;color:#3D2610;line-height:1.6;">Ready for your next 90-day cycle? Order a fresh glass before your break ends.</p>
          ${btn('https://vedayulife.com/', '🛒 Order Again — Free Delivery', '#5C3D1E')}
        </div>`}

        <div style="text-align:center;margin-top:8px;">
          ${btn(`https://g.page/r/vedayu/review`, '⭐ Leave a Review — Help Others Decide', '#fff', '#5C3D1E')}
        </div>
      `)}
    `, orderId),
  };
}
