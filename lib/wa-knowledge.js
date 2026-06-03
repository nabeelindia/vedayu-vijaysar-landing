/**
 * WhatsApp bot knowledge base + intent matcher
 * Derived from the landing page content (FAQs, pricing, policies).
 */

export const KNOWLEDGE = [
  {
    intent: ['price', 'cost', 'rate', 'kitna', 'kitne', 'how much', 'khareed', 'buy'],
    reply: `🌿 *Vedayu Vijaysar Wooden Glass* — Pricing:\n\n• *Pack of 1* — ₹499 (orig ₹699)\n• *Pack of 2* — ₹899 (orig ₹1,398)\n• *Pack of 5* — ₹1,999 (orig ₹3,495)\n\n🚚 Free delivery all over India on all packs.\n💳 COD available | Online payment gets you 10% OFF\n\nTo order, visit: https://vedayulife.com`,
  },
  {
    intent: ['cod', 'cash', 'cash on delivery', 'advance', 'payment'],
    reply: `✅ Yes! *Cash on Delivery (COD)* is available all across India.\n\nYou pay cash when the product is delivered — no advance payment required. You can also pay online (UPI, Paytm, PhonePe, Cards) and get a *10% discount*! 🎉`,
  },
  {
    intent: ['deliver', 'delivery', 'ship', 'days', 'kitne din', 'kab milega', 'track', 'tracking'],
    reply: `🚚 *Delivery timelines:*\n\n• Metro cities: 3–5 business days\n• Other cities: 5–8 business days\n\n📦 Orders are dispatched within 1–2 business days.\n\nFor tracking, reply with your *Order ID* and we'll check the status for you!`,
  },
  {
    intent: ['refund', 'return', 'replace', 'wapas', 'broken', 'damage', 'defect', 'warranty', 'guarantee'],
    reply: `↩️ *7-Day Replacement Policy:*\n\nIf your product arrives damaged or defective, contact us within 7 days of delivery and we will arrange a free replacement.\n\nPlease send us a photo of the damage along with your Order ID and we'll resolve it immediately! 🙏`,
  },
  {
    intent: ['use', 'kaise', 'how to', 'instructions', 'raat', 'subah', 'morning', 'soak', 'fill', 'overnight'],
    reply: `🏺 *How to use the Vijaysar Glass:*\n\n1️⃣ Fill with plain room-temperature water\n2️⃣ Cover & keep overnight (6–8 hours)\n3️⃣ Drink the infused water first thing in the morning on an empty stomach\n4️⃣ Rinse with plain water only, dry well, and refill for next day\n\n*Repeat daily for best results.* Traditional practice recommends 90 days for a complete wellness cycle. 🌿`,
  },
  {
    intent: ['clean', 'wash', 'soap', 'sabun', 'dishwasher', 'maintain', 'care'],
    reply: `🧼 *Cleaning your Vijaysar Glass:*\n\nRinse gently with *plain water only*. No soap, detergent, or dishwasher — these damage the natural wood.\n\nDry completely after rinsing and store in a *dry, ventilated place*. This keeps your glass fresh for years! 🌿`,
  },
  {
    intent: ['colour', 'color', 'pink', 'brown', 'pinkish', 'rang', 'change', 'colour change'],
    reply: `🌸 *Why does water change colour?*\n\nThe slight pinkish or light brown colour is completely *normal and safe!* It is the natural tannins from authentic Vijaysar wood infusing into the water — it means your glass is genuine and active.\n\nIf the water shows *no colour change* after a week, contact us for a free replacement! ✅`,
  },
  {
    intent: ['diabetes', 'sugar', 'diabetic', 'blood sugar', 'madhumeh', 'cure', 'medicine'],
    reply: `⚠️ *Important Notice:*\n\nThe Vijaysar wooden glass is a traditional Ayurvedic *wellness product* — it is NOT a medicine and does NOT cure diabetes or any disease.\n\nMany people use it as part of a healthy hydration routine, but it *cannot replace* prescribed medication or medical advice. Please consult your doctor if you have any medical condition. 🙏`,
  },
  {
    intent: ['vijaysar', 'what is', 'wood', 'tree', 'natural', 'ayurveda', 'pterocarpus', 'kino'],
    reply: `🌳 *What is Vijaysar?*\n\nVijaysar (Pterocarpus marsupium) is the Indian Kino Tree — a large deciduous tree native to India and Sri Lanka. Its heartwood has been used in *Ayurvedic traditions for centuries* and is mentioned in classical texts like Charaka Samhita.\n\nOur glasses are handcrafted from mature Vijaysar heartwood sourced responsibly. Each piece has a unique grain — a sign of genuine handcraftsmanship! 🏺`,
  },
  {
    intent: ['gift', 'gifting', 'present', 'parents', 'family', 'elders', 'toh', 'bujurg'],
    reply: `🎁 *Gifting with Vedayu:*\n\nThe Vijaysar glass makes a *beautiful and meaningful gift* — especially for parents, in-laws, and elders.\n\n• *Pack of 2* — ₹899 (Couple gift)\n• *Pack of 5* — ₹1,999 (Family gift — our most popular!)\n\nWe can deliver *directly to the recipient's address*. Free delivery all over India! 🚚`,
  },
  {
    intent: ['children', 'kids', 'bacche', 'child', 'age', 'suitable'],
    reply: `👶 *Can children use it?*\n\nVijaysar wood is natural with no synthetic coatings. However, this product is designed for *adults*. We do not specifically recommend it for young children without consulting a paediatrician or Ayurvedic practitioner first.\n\nTeenagers and adults can use it safely as part of a daily routine! 🌿`,
  },
  {
    intent: ['order', 'book', 'place order', 'order karna', 'khareedna', 'buy now'],
    reply: `🛒 *Ready to order?*\n\nVisit our website to place your order:\n👉 https://vedayulife.com\n\nChoose your pack, enter your address, and select *Cash on Delivery* or pay online for a *10% discount*! 🎉\n\nFree delivery all over India. Orders dispatched within 1–2 business days. 📦`,
  },
  {
    intent: ['90 days', '90 din', 'how long', 'kitne din tak', 'duration', 'continuous'],
    reply: `📅 *How long to use it?*\n\nTraditional Ayurvedic practice recommends *90 days of continuous daily use* for a complete wellness cycle, followed by a 15–30 day break before resuming.\n\nConsistency is key — occasional use won't give the same experience as a regular morning ritual! 🌿`,
  },
];

/** Returns the best reply for a customer message, or null if no match */
export function getBotReply(text) {
  const lower = text.toLowerCase().trim();

  // Greeting
  if (/^(hi|hello|hey|namaste|namaskar|hii|helo|hy|good morning|good evening|good afternoon|गुड|नमस्ते)\b/.test(lower)) {
    return `🙏 Namaste! Welcome to *Vedayu*!\n\nWe make traditional Vijaysar wooden glasses — a 2,000-year-old Ayurvedic wellness ritual.\n\nHow can I help you today? You can ask about:\n• 💰 Pricing & packs\n• 🚚 Delivery & tracking\n• 🏺 How to use\n• ↩️ Return policy\n• 🎁 Gifting\n\nOr type anything and I'll answer! 😊`;
  }

  // Match intents
  for (const { intent, reply } of KNOWLEDGE) {
    if (intent.some(kw => lower.includes(kw))) return reply;
  }

  // Fallback — escalate to human
  return null;
}

export const FALLBACK_REPLY = `🙏 Thank you for reaching out to *Vedayu*!\n\nI've noted your message and our team will respond within a few hours.\n\nFor quick answers, you can also visit: https://vedayulife.com\n\n— Team Vedayu 🌿`;
