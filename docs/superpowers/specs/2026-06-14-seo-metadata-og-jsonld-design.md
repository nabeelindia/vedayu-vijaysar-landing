# SEO: Metadata, Open Graph, Twitter Cards & JSON-LD — Design Spec

**Date:** 2026-06-14  
**Status:** Approved

---

## Scope

Fill all metadata gaps across Vedayu's public pages. Blog post pages (`BlogLayout.js`) are already complete and excluded from this work.

---

## Page-by-Page Changes

### 1. Homepage (`pages/index.js`)

**Add:**
- `<link rel="canonical" href="https://vedayulife.com/" />`
- `Product` JSON-LD with `AggregateOffer` covering all 3 packs (₹499 / ₹899 / ₹1999), `lowPrice`, `highPrice`, `offerCount: 3`, `availability: InStock`, `itemCondition: NewCondition`, `seller: Vedayu`
- `Organization` JSON-LD with `name`, `url`, `logo`, `contactPoint` (WhatsApp/email), `sameAs` (if social profiles exist)

**Already present (no change):** title, meta description, OG tags, Twitter cards.

### 2. Blog Index (`pages/blog/index.js`)

**Add:**
- `<link rel="canonical" href="https://vedayulife.com/blog" />`
- Twitter card meta tags (card type, title, description, image — use the same OG image already in `_document.js`)
- `CollectionPage` JSON-LD with `name`, `description`, `url`, `publisher`

### 3. Contact Page (`pages/contact.js`)

**Add:**
- `<link rel="canonical" href="https://vedayulife.com/contact" />`
- OG tags: `og:type=website`, `og:title`, `og:description`, `og:image` (use global fallback image), `og:url`
- Twitter card meta tags
- `WebPage` JSON-LD with `name`, `description`, `url`, `publisher`

### 4. Track Page (`pages/track.js`)

**Add:**
- `<meta name="robots" content="noindex, follow" />` — order tracking is utility content, not indexable
- `<link rel="canonical" href="https://vedayulife.com/track" />`
- OG + Twitter tags (for WhatsApp share previews even if not indexed)

### 5. Order-Confirmed Page (`pages/order-confirmed.js`)

**Add:**
- `<meta name="robots" content="noindex, nofollow" />` — transaction confirmation page, must never appear in search

No OG/schema needed — this page should not be shared or indexed.

### 6. `_document.js` (global)

**Add:**
- `<meta property="og:locale" content="en_IN" />` as default (this is static; per-page OG overrides it)

---

## JSON-LD Schema Detail

### Product schema (homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Vijaysar Wooden Glass",
  "description": "...",
  "image": ["...cloudinary url..."],
  "brand": { "@type": "Brand", "name": "Vedayu" },
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "499",
    "highPrice": "1999",
    "priceCurrency": "INR",
    "offerCount": 3,
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition",
    "seller": { "@type": "Organization", "name": "Vedayu" }
  }
}
```

### Organization schema (homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Vedayu",
  "url": "https://vedayulife.com",
  "logo": "https://vedayulife.com/favicon.svg",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "hashcartindia@gmail.com"
  }
}
```

---

## What Is NOT Changing

- Blog post pages — already fully instrumented
- Legal pages (privacy/terms/refund/shipping) — correctly `noindex`ed, no change needed
- `_app.js` — no metadata changes needed
- Existing OG/Twitter on homepage — already correct, just adding JSON-LD and canonical

---

## SSR Audit Result

All content pages use `getStaticProps` or are fully static. No CSR-only indexing gaps found. No SSR changes needed.
