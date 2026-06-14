# SEO Metadata, OG, Twitter Cards & JSON-LD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all metadata gaps across Vedayu's public pages — canonical tags, Open Graph, Twitter cards, JSON-LD schemas, and robots directives.

**Architecture:** All changes are in-place edits to existing `<Head>` blocks or inline JSON-LD `<script>` tags. No new files, no new components. Blog post pages (`BlogLayout.js`) are already complete — excluded.

**Tech Stack:** Next.js 14 Pages Router, `next/head`, JSON-LD via `<script type="application/ld+json">`.

---

### Task 1: `_document.js` — add `og:locale`

**Files:**
- Modify: `pages/_document.js`

- [ ] **Step 1: Add `og:locale` inside the existing `<Head>` block in `_document.js`, after the existing `<meta property="og:site_name">` line**

Open `pages/_document.js`. The `{/* Open Graph */}` block currently ends at:
```jsx
<meta name="twitter:card" content="summary_large_image" />
```

Add one line after `og:site_name`:
```jsx
<meta property="og:locale" content="en_IN" />
```

So the OG block becomes:
```jsx
{/* Open Graph */}
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Vedayu" />
<meta property="og:locale" content="en_IN" />
<meta property="og:image" content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
<meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 2: Commit**

```bash
git add pages/_document.js
git commit -m "seo: add og:locale to global document head"
```

---

### Task 2: Homepage — canonical + JSON-LD schemas

**Files:**
- Modify: `pages/index.js`

- [ ] **Step 1: Add canonical tag to the existing `<Head>` block**

In `pages/index.js`, find the `<Head>` block (around line 679). After the existing `<meta name="description" ... />` line and before the `{/* Open Graph */}` comment, add:

```jsx
<link rel="canonical" href="https://vedayulife.com/" />
```

- [ ] **Step 2: Add Product + Organization JSON-LD schemas**

At the top of `pages/index.js`, before the `export default function` line, add these two schema constants:

```jsx
const PRODUCT_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Vijaysar Wooden Glass',
  description: 'Handcrafted tumbler made from 100% natural Vijaysar wood (Pterocarpus marsupium). Fill with water overnight, drink infused water each morning as part of an Ayurvedic wellness ritual.',
  image: [
    'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu',
  ],
  brand: { '@type': 'Brand', name: 'Vedayu' },
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '499',
    highPrice: '1999',
    priceCurrency: 'INR',
    offerCount: 3,
    availability: 'https://schema.org/InStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@type': 'Organization', name: 'Vedayu' },
  },
};

const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Vedayu',
  url: 'https://vedayulife.com',
  logo: 'https://vedayulife.com/favicon.svg',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'hashcartindia@gmail.com',
  },
};
```

- [ ] **Step 3: Inject schemas into `<Head>`**

Inside the `<Head>` block in `pages/index.js`, add these two script tags just before the closing `</Head>`:

```jsx
{/* JSON-LD */}
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PRODUCT_SCHEMA) }} />
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_SCHEMA) }} />
```

- [ ] **Step 4: Commit**

```bash
git add pages/index.js
git commit -m "seo: add canonical + Product/Organization JSON-LD to homepage"
```

---

### Task 3: Blog index — Twitter cards + canonical + JSON-LD

**Files:**
- Modify: `pages/blog/index.js`

- [ ] **Step 1: Inspect current `<Head>` block**

Open `pages/blog/index.js`. The `<Head>` block (around line 13) currently has title, description, and partial OG tags but no Twitter cards, no canonical, no JSON-LD.

- [ ] **Step 2: Replace the existing `<Head>` block**

Find the entire `<Head>...</Head>` block and replace it with:

```jsx
<Head>
  <title>Ayurvedic Wellness Blog — Vedayu</title>
  <meta name="description" content="Explore Vedayu's Ayurvedic wellness blog — guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient wisdom of Ayurveda." />
  <link rel="canonical" href="https://vedayulife.com/blog" />

  {/* Open Graph */}
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="Ayurvedic Wellness Blog — Vedayu" />
  <meta property="og:description" content="Explore Vedayu's Ayurvedic wellness blog — guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient wisdom of Ayurveda." />
  <meta property="og:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
  <meta property="og:url"         content="https://vedayulife.com/blog" />
  <meta property="og:site_name"   content="Vedayu" />

  {/* Twitter */}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="Ayurvedic Wellness Blog — Vedayu" />
  <meta name="twitter:description" content="Guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient wisdom of Ayurveda." />
  <meta name="twitter:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />

  {/* JSON-LD */}
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Ayurvedic Wellness Blog — Vedayu',
    description: "Explore Vedayu's Ayurvedic wellness blog — guides on Vijaysar wood, blood sugar wellness, morning rituals, and the ancient wisdom of Ayurveda.",
    url: 'https://vedayulife.com/blog',
    publisher: {
      '@type': 'Organization',
      name: 'Vedayu',
      logo: { '@type': 'ImageObject', url: 'https://vedayulife.com/favicon.svg' },
    },
  }) }} />
</Head>
```

- [ ] **Step 3: Commit**

```bash
git add pages/blog/index.js
git commit -m "seo: add Twitter cards, canonical, JSON-LD to blog index"
```

---

### Task 4: Contact page — OG + Twitter + canonical + JSON-LD

**Files:**
- Modify: `pages/contact.js`

- [ ] **Step 1: Replace the existing `<Head>` block in `pages/contact.js`**

Find the `<Head>...</Head>` block (around line 11) and replace it with:

```jsx
<Head>
  <title>{t('contact.page_title')}</title>
  <meta name="description" content="Get in touch with Vedayu for order queries, support, or feedback." />
  <link rel="canonical" href="https://vedayulife.com/contact" />

  {/* Open Graph */}
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="Contact Vedayu — We're Here to Help" />
  <meta property="og:description" content="Reach out for order support, product questions, or feedback. We respond within 24 hours." />
  <meta property="og:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
  <meta property="og:url"         content="https://vedayulife.com/contact" />
  <meta property="og:site_name"   content="Vedayu" />

  {/* Twitter */}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="Contact Vedayu — We're Here to Help" />
  <meta name="twitter:description" content="Reach out for order support, product questions, or feedback." />
  <meta name="twitter:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />

  {/* JSON-LD */}
  <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Contact Vedayu',
    description: 'Get in touch with Vedayu for order queries, support, or feedback.',
    url: 'https://vedayulife.com/contact',
    publisher: { '@type': 'Organization', name: 'Vedayu', url: 'https://vedayulife.com' },
  }) }} />
</Head>
```

- [ ] **Step 2: Commit**

```bash
git add pages/contact.js
git commit -m "seo: add OG, Twitter, canonical, JSON-LD to contact page"
```

---

### Task 5: Track page — noindex + OG + Twitter + canonical

**Files:**
- Modify: `pages/track.js`

- [ ] **Step 1: Replace the existing `<Head>` block in `pages/track.js`**

Find the `<Head>...</Head>` block (around line 73) and replace it with:

```jsx
<Head>
  <title>{t('track.page_title')}</title>
  <meta name="description" content="Track your Vedayu Vijaysar Wooden Glass order by Order ID, AWB number, phone, or email." />
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="https://vedayulife.com/track" />

  {/* Open Graph — for WhatsApp/social previews even though noindex */}
  <meta property="og:type"        content="website" />
  <meta property="og:title"       content="Track Your Vedayu Order" />
  <meta property="og:description" content="Enter your Order ID, AWB, phone, or email to track your Vijaysar Wooden Glass shipment." />
  <meta property="og:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
  <meta property="og:url"         content="https://vedayulife.com/track" />
  <meta property="og:site_name"   content="Vedayu" />

  {/* Twitter */}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="Track Your Vedayu Order" />
  <meta name="twitter:description" content="Enter your Order ID, AWB, phone, or email to track your shipment." />
  <meta name="twitter:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
</Head>
```

- [ ] **Step 2: Commit**

```bash
git add pages/track.js
git commit -m "seo: add noindex, OG, Twitter, canonical to track page"
```

---

### Task 6: Order-confirmed page — noindex + nofollow

**Files:**
- Modify: `pages/order-confirmed.js`

- [ ] **Step 1: Add robots noindex tag to `<Head>` in `pages/order-confirmed.js`**

Find the `<Head>...</Head>` block (around line 250). It currently only has a `<title>` tag. Add the robots directive:

```jsx
<Head>
  <title>{t('order_confirmed.page_title')}</title>
  <meta name="robots" content="noindex, nofollow" />
</Head>
```

- [ ] **Step 2: Commit**

```bash
git add pages/order-confirmed.js
git commit -m "seo: noindex/nofollow order-confirmed page"
```

---

### Task 7: Verify all changes

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: no errors. Warnings about image sizes are fine.

- [ ] **Step 2: Start production server and spot-check rendered HTML**

```bash
npm run start &
sleep 3
curl -s http://localhost:3000/ | grep -E 'canonical|og:|twitter:|application/ld\+json' | head -30
curl -s http://localhost:3000/blog | grep -E 'canonical|og:|twitter:|application/ld\+json' | head -20
curl -s http://localhost:3000/contact | grep -E 'canonical|og:|twitter:|application/ld\+json' | head -20
curl -s http://localhost:3000/track | grep -E 'noindex|canonical|og:' | head -10
curl -s http://localhost:3000/order-confirmed | grep -E 'noindex' | head -5
```

Expected: each page returns the appropriate meta tags and JSON-LD blocks in the HTML.

- [ ] **Step 3: Kill dev server**

```bash
kill %1
```

- [ ] **Step 4: Final commit (if any fixups were needed)**

```bash
git add -A
git commit -m "seo: fixup after build verification"
```
