# Vedayu — Hermes Agent Briefing

> Complete project handoff for managing, deploying, and optimising the Vedayu landing page and Facebook/Instagram ad campaigns.

---

## 1. What This Project Is

**Vedayu** (vedayulife.com) is a direct-to-consumer e-commerce landing page selling the **Vijaysar Wooden Glass** — an Ayurvedic wellness product. Single product, single page, two payment methods (Prepaid via Razorpay + Cash on Delivery).

**Business:**
- Legal name: Hashcart eCommerce Pvt. Ltd.
- Owner: Nabeel Ahmed
- Contact: hi@vedayulife.com | +91 70707 01956 | WhatsApp: 7070701956

**Live site:** https://vedayulife.com  
**Codebase:** `/Users/nabeel/Downloads/vedayu-vercel/`  
**Hosting:** Vercel (auto-deploys via `vercel --prod` from project root)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (Pages Router) |
| Hosting | Vercel |
| Payments | Razorpay (prepaid) + COD |
| Email | Resend (transactional) |
| Tracking | Meta Pixel (browser) + Meta CAPI (server-side) |
| Domain | GoDaddy — vedayulife.com |

---

## 3. Project File Structure

```
vedayu-vercel/
├── pages/
│   ├── _document.js          # Global <head>: favicon, Meta Pixel init, FB domain verification
│   ├── index.js              # Main landing page (entire product + checkout)
│   ├── order-confirmed.js    # Post-purchase confirmation page
│   ├── privacy.js            # Privacy policy
│   ├── terms.js              # Terms & conditions
│   ├── refund-policy.js      # Refund policy
│   ├── shipping-policy.js    # Shipping policy
│   └── contact.js            # Contact + Grievance Officer page
│   └── api/
│       ├── create-order.js   # Creates Razorpay order (returns order_id)
│       ├── verify-payment.js # Verifies Razorpay HMAC sig + sends prepaid emails + CAPI
│       ├── submit-cod.js     # Handles COD orders + sends COD emails + CAPI
│       └── track-abandon.js  # Cart abandonment tracking
├── components/
│   └── SiteFooter.js         # Shared footer with policy links
├── lib/
│   └── meta-capi.js          # Meta Conversions API helper (server-side Purchase events)
├── public/
│   ├── images/               # Product images: product.jpg, lifestyle.jpg, authentic.jpg, etc.
│   ├── ads/                  # Ad creatives + social media assets
│   │   ├── ad1-hero.jpg      # 1080×1080 ad: product hero
│   │   ├── ad2-testimonial.jpg
│   │   ├── ad3-benefits.jpg
│   │   ├── ad4-howto.jpg
│   │   ├── profile_photo.png # Facebook page profile photo (400×400)
│   │   └── cover_photo.jpg   # Facebook page cover photo (820×312)
│   └── d4j20c7xs59qf1fu90vtsvkc1bsv0h.html  # Facebook domain verification file
├── scripts/
│   ├── generate_ads.py           # Python/Pillow ad creative generator
│   └── generate_social_v3.py     # Profile + cover photo generator
├── styles/
│   └── globals.css
└── HERMES.md                 # This file
```

---

## 4. Environment Variables (Vercel Production)

All set in Vercel dashboard. To view: `vercel env ls`

| Variable | Purpose |
|----------|---------|
| `RAZORPAY_KEY_ID` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (HMAC verification) |
| `RESEND_API_KEY` | Resend email API key |
| `ORDERS_EMAIL` | Store owner email — receives all order notifications |
| `META_CAPI_TOKEN` | Meta Conversions API access token |
| `META_MARKETING_TOKEN` | Meta Marketing API long-lived token (for audience sync + retargeting campaign setup) |
| `META_AD_ACCOUNT_ID` | Meta ad account ID — **without** the `act_` prefix |
| `META_PAGE_ID` | Facebook Page ID to run ads from |
| `META_INSTAGRAM_ID` | Instagram account ID (optional — enables IG placement on ad creatives) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp number (10 digits, no +91) |

> **Note:** `META_CAPI_TEST_CODE` was used during testing (`TEST98386`) and has been removed. Do NOT re-add unless testing CAPI events in Meta's Test Events tab.

---

## 5. Deployment

```bash
cd /Users/nabeel/Downloads/vedayu-vercel
vercel --prod
```

That's it. Vercel builds and deploys to vedayulife.com in ~30 seconds.

To add/change env vars:
```bash
echo "VALUE" | vercel env add VARIABLE_NAME production --force
vercel --prod   # redeploy to pick up new env
```

---

## 6. Product & Pricing

| Pack | Price (Prepaid) | Price (COD) | Qty |
|------|----------------|-------------|-----|
| Pack of 1 | ₹449 | ₹499 | 1 |
| Pack of 2 | ₹849 | ₹899 | 2 |
| Pack of 5 | ₹1,899 | ₹1,999 | 5 |

COD has a ₹50 premium per pack. Free delivery on all orders. 7-day replacement guarantee.

---

## 7. Order Flow

### Prepaid (Razorpay)
1. Customer fills checkout form → clicks "Pay Online"
2. `POST /api/create-order` → creates Razorpay order, returns `order_id`
3. Razorpay modal opens → customer pays
4. On success → `POST /api/verify-payment` →
   - Verifies HMAC-SHA256 signature
   - Sends owner email (green header, "DISPATCH IMMEDIATELY")
   - Sends customer confirmation email
   - Fires Meta CAPI Purchase event
   - Returns `{ success, orderId: "VED-PRE-{payment_id}" }`
5. Customer redirected to `/order-confirmed?method=prepaid&...`
6. Browser pixel fires `Purchase` event on order-confirmed page

### COD
1. Customer fills checkout form → clicks "Order with Cash on Delivery"
2. `POST /api/submit-cod` →
   - Validates all fields server-side
   - Sends owner email (brown header, "Verify before dispatch")
   - Sends customer confirmation email
   - Fires Meta CAPI Purchase event
   - Returns `{ success, orderId: "VED-COD-{timestamp}" }`
3. Customer redirected to `/order-confirmed?method=cod&...`
4. Browser pixel fires `Purchase` event on order-confirmed page

---

## 8. Meta Pixel & CAPI Setup

### Pixel
- **Pixel ID:** `4274415046037928`
- **Placement:** `pages/_document.js` — fires `PageView` on every page load
- **Events tracked:**
  - `PageView` — every page (automatic)
  - `ViewContent` — on landing page mount
  - `AddToCart` — when user changes pack selection
  - `InitiateCheckout` — when user clicks "Buy Now" / scrolls to checkout
  - `Purchase` — on order-confirmed page (with `eventID` for deduplication)

### CAPI (Server-side)
- **Helper:** `lib/meta-capi.js`
- **Fires from:** `api/verify-payment.js` (prepaid) and `api/submit-cod.js` (COD)
- **Event:** `Purchase` with full hashed PII (email, phone, name, city, pincode, country)
- **Deduplication:** `event_id` = `orderId` matches browser pixel `eventID`
- **IMPORTANT:** CAPI calls must be `await`-ed before `res.json()` — Vercel kills serverless functions immediately after response, so fire-and-forget calls never reach Meta

### Domain Verification
- **Status:** ✅ Verified (`vedayulife.com`)
- **Method:** DNS TXT record — `facebook-domain-verification=maapoi1d4j15v496208hcmmhdgbhnu`
- **HTML file** also present at `/public/d4j20c7xs59qf1fu90vtsvkc1bsv0h.html` (old www verification)
- **Aggregated Event Measurement:** Active (unlocked after domain verification)

---

## 9. Meta Business Setup

| Asset | Detail |
|-------|--------|
| Business Portfolio | Hashcart India |
| Pixel | Vedayu (ID: 4274415046037928) |
| Facebook Page | Vedayu (newly created — get URL from Nabeel) |
| Instagram | Linked to Vedayu Facebook page |
| Active Ad Account | "Nabeel Ahmed" — ID: `1996727763951399` |
| Other accounts | 3 × UNSETTLED — do not use |

> **Meta Ads MCP:** Currently `is_ads_mcp_enabled: false` for all accounts (gradual rollout). Campaign creation must be done manually via Ads Manager (business.facebook.com) until MCP is enabled.

---

## 10. Ad Creatives

Located in `public/ads/`:

| File | Format | Use |
|------|--------|-----|
| `ad1-hero.jpg` | 1080×1080 | Product hero — dark brown bg, product image, headline |
| `ad2-testimonial.jpg` | 1080×1080 | Social proof — 5-star review, Sunita Sharma |
| `ad3-benefits.jpg` | 1080×1080 | 4-benefit grid — light green bg |
| `ad4-howto.jpg` | 1080×1080 | 4-step how-to — dark premium |
| `profile_photo.png` | 400×400 | Facebook page profile photo |
| `cover_photo.jpg` | 820×312 | Facebook page cover photo |

To regenerate creatives:
```bash
cd /Users/nabeel/Downloads/vedayu-vercel
python3 scripts/generate_ads.py          # ad creatives
python3 scripts/generate_social_v3.py    # profile + cover
```
Requires Python 3 + Pillow (`pip install Pillow`).

---

## 11. Current Campaign Plan

### Phase 1 — NOW (Weeks 1–2)
**Goal:** Drive traffic, let pixel learn, test which creative wins

| Setting | Value |
|---------|-------|
| Objective | Traffic → Landing Page Views |
| Budget | ₹300/day |
| Ad Account | Nabeel Ahmed (1996727763951399) |
| Audience | Advantage+ Audience |
| Location | India |
| Age | 28–65 |
| Placements | Advantage+ (all — FB + IG + Reels) |
| Ads | 3 ads: ad1-hero, ad2-testimonial, ad3-benefits |

**Ad copy templates:**

*Ad 1 — Product Hero:*
- Primary text: `Start your morning the Ayurvedic way. 🌿 Vijaysar Wooden Glass — soak overnight, drink infused water at dawn. Used for centuries. Backed by nature. Free delivery across India.`
- Headline: `Vijaysar Wooden Glass — From ₹499`
- Description: `COD available · Free delivery · 7-day replacement`

*Ad 2 — Testimonial:*
- Primary text: `"My sugar levels have been more stable since I started using this. Drinking from it every morning." ⭐⭐⭐⭐⭐ — Sunita Sharma, Pune. Try Vedayu Vijaysar Wooden Glass — Free delivery India-wide.`
- Headline: `Loved by 500+ customers across India`

*Ad 3 — Benefits:*
- Primary text: `Why thousands choose Vijaysar wood for their morning routine ✦ Supports healthy blood sugar ✦ Natural wood properties ✦ Zero chemicals ✦ Ancient Ayurvedic wisdom.`
- Headline: `The Ancient Wellness Secret — Now at Your Door`

### Phase 2 — After 30 purchases
Switch objective to **Conversions → Purchase**. Increase budget to ₹500–1000/day.

### Phase 3 — Scaling
- Lookalike audiences based on purchasers
- Retargeting: ViewContent → no purchase (3-day window)
- Video creative (30-sec product demo — needs to be shot)

---

## 12. Key Decisions & Context

- **Pricing:** ₹499 is the headline price (COD Pack of 1). Prepaid is ₹449 (₹50 discount). Always use ₹499 in ad copy — it's the price most people see.
- **No Shopify/WooCommerce:** This is a pure Next.js custom build. No CMS.
- **Email provider:** Resend (not SendGrid/Mailchimp). Sender domain: `orders@vedayulife.com`
- **COD is primary:** Most Indian customers prefer COD. Don't push prepaid in ads.
- **CAPI await pattern:** Never use fire-and-forget (`.catch(() => {})`) for CAPI — always `await`. Vercel kills functions after response.
- **Domain in Meta:** Use `vedayulife.com` (no www). The `www.` prefix caused verification failures.

---

## 13. Pending / Next Steps

- [ ] Launch Phase 1 campaign in Ads Manager
- [ ] Create Vedayu Facebook page username (facebook.com/vedayulife if available)
- [ ] Upload profile_photo.png and cover_photo.jpg to Facebook page
- [ ] Connect Vedayu pixel to ad account 1996727763951399 in Business Settings
- [ ] Shoot 30-sec video creative (morning ritual with the glass) — big unlock for Reels ads
- [ ] After 30 purchases: switch to Conversions objective
- [ ] Fix billing on 3 unsettled ad accounts (optional — current active account is sufficient)

---

## 14. How to Deploy Changes

```bash
# 1. Edit files in /Users/nabeel/Downloads/vedayu-vercel/
# 2. Deploy:
cd /Users/nabeel/Downloads/vedayu-vercel
vercel --prod
```

No git push needed — Vercel CLI deploys directly from local files.

---

## 15. Useful Commands

```bash
# Deploy
vercel --prod

# Check recent logs
vercel logs dpl_DEPLOYMENT_ID --no-follow

# Add env var
echo "value" | vercel env add VAR_NAME production --force && vercel --prod

# Remove env var
vercel env rm VAR_NAME production --yes && vercel --prod

# Check live page HTML
curl -s "https://vedayulife.com" | grep -o 'some-tag[^>]*>'
```

---

*Last updated by Claude — May 2026*
