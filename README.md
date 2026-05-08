# Vedayu — Vijaysar Wooden Glass Landing Page
**Next.js 14 · Vercel-ready · Razorpay + COD · Mobile-first**

---

## 🚀 Deploy to Vercel in 5 Minutes

### Option A — One-click (Recommended)
1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. Add environment variables (see table below)
4. Click **Deploy** — done ✅

### Option B — Vercel CLI
```bash
npm i -g vercel
cd vedayu-vercel
npm install
vercel          # follow prompts, add env vars when asked
```

---

## ⚙️ Environment Variables

Add these in **Vercel Dashboard → Project → Settings → Environment Variables**

| Variable | Required | Where to get it |
|---|---|---|
| `RAZORPAY_KEY_ID` | Yes | [dashboard.razorpay.com](https://dashboard.razorpay.com) → API Keys |
| `RAZORPAY_KEY_SECRET` | Yes | Same as above |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Same key_id — this one is exposed to the browser |
| `RESEND_API_KEY` | Recommended | [resend.com](https://resend.com) — free 3,000 emails/month |
| `ORDERS_EMAIL` | Recommended | Your email e.g. `hivedayu@gmail.com` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Yes | 10-digit number without +91 e.g. `9876543210` |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your domain e.g. `https://vedayu.com` |

> Copy `.env.local.example` → `.env.local` for local development.

---

## 🗂️ Project Structure

```
vedayu-vercel/
├── pages/
│   ├── _app.js               # App wrapper (imports global CSS)
│   ├── _document.js          # HTML head (OG tags, preconnect)
│   ├── index.js              # Full landing page (all 13 sections)
│   ├── order-confirmed.js    # Post-purchase confirmation page
│   └── api/
│       ├── create-order.js   # Razorpay order creation (server-side)
│       └── submit-cod.js     # COD order capture + email notification
├── styles/
│   └── globals.css           # All styles (earthy Indian wellness palette)
├── public/
│   └── images/               # Add your product images here
│       ├── product.webp      # Hero product image (800×1067px)
│       ├── lifestyle.webp    # Solution section round image (600×600px)
│       ├── logo.png          # Brand logo (shown in Razorpay checkout)
│       └── og-image.jpg      # Social share image (1200×630px)
├── next.config.js
├── package.json
└── .env.local.example
```

---

## 🖼️ Adding Product Images

1. Export your images as **WebP** (use [squoosh.app](https://squoosh.app) — free)
2. Place them in `/public/images/`
3. In `pages/index.js`, replace the placeholder `<div>` in the Hero section with:

```jsx
// Hero image — replace the placeholder div with:
<img
  src="/images/product.webp"
  alt="Vedayu Vijaysar Wooden Glass"
  className="hero-product-img"
  width={380} height={507}
  priority
/>

// Solution circle image — replace inner div with:
<img src="/images/lifestyle.webp" alt="Vijaysar glass lifestyle" />
```

---

## 💳 Razorpay Setup

1. Sign up at [razorpay.com](https://razorpay.com)
2. Complete KYC for your business
3. Go to **Settings → API Keys → Generate Test Key**
4. Add both keys to Vercel environment variables
5. Switch to **Live Keys** when ready to accept real payments

**How it works:**
- Customer clicks "Place Order" (Prepaid)
- Browser calls `POST /api/create-order` → Razorpay creates an order server-side
- Razorpay checkout modal opens with the order_id
- Customer pays → `handler` fires → redirects to `/order-confirmed`

---

## 📦 COD Order Flow

1. Customer fills form, selects "Cash on Delivery", clicks "Place Order"
2. Browser calls `POST /api/submit-cod`
3. Server validates data, sends email to `ORDERS_EMAIL` via Resend
4. Customer is redirected to `/order-confirmed?method=cod`

**Email setup with Resend:**
1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain (e.g. `vedayu.com`)
3. Get your API key → add to Vercel env vars
4. Update the `from` field in `submit-cod.js` to match your verified domain

> **Without Resend:** Orders are logged to Vercel function logs (visible in Vercel Dashboard → Functions tab). Configure Resend before going live.

---

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Copy and fill env vars
cp .env.local.example .env.local
# Edit .env.local with your values

# Start dev server
npm run dev
# Open http://localhost:3000
```

---

## 🎨 Customisation

### Prices
Edit the `PACKS` object at the top of `pages/index.js`:
```js
const PACKS = {
  1: { price: 499, original: 699, ... },
  2: { price: 899, original: 1398, ... },
  5: { price: 1999, original: 3495, ... },
};
```

### Colours
Edit CSS variables in `styles/globals.css`:
```css
:root {
  --vd-brown:      #5C3D1E;
  --vd-green:      #4A7C59;
  --vd-gold:       #C9A84C;
  --vd-cream:      #FAF5E4;
}
```

### WhatsApp number
Set `NEXT_PUBLIC_WHATSAPP_NUMBER` in your env vars.

### FAQs / Reviews
Edit the `FAQS` array and reviews array in `pages/index.js`.

---

## 📊 Analytics Setup

### Google Analytics (GA4)
Add to `pages/_document.js` inside `<Head>`:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script dangerouslySetInnerHTML={{ __html: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
`}} />
```

### Facebook Pixel
Add your Pixel base code the same way.

---

## 📋 Pre-Launch Checklist

- [ ] Product images added (`/public/images/product.webp`, `lifestyle.webp`)
- [ ] Logo added (`/public/images/logo.png`)
- [ ] OG image added (`/public/images/og-image.jpg`)
- [ ] `NEXT_PUBLIC_SITE_URL` set to your actual domain
- [ ] Razorpay live keys configured (after test is done)
- [ ] Resend API key + verified domain configured
- [ ] `ORDERS_EMAIL` set to your email
- [ ] WhatsApp number set
- [ ] Test prepaid order placed end-to-end ✅
- [ ] Test COD order placed — email received ✅
- [ ] Custom domain connected in Vercel Dashboard
- [ ] Mobile tested on real device
- [ ] Page speed checked at pagespeed.web.dev (target: 80+ mobile)

---

## 🔒 Compliance

This landing page is built to comply with Indian advertising guidelines:
- ❌ No claims of curing/treating diabetes
- ❌ No "doctor approved" or "clinically proven" language  
- ✅ Disclaimer on landing page and order confirmation page
- ✅ "Not a medicine" clearly stated

**Never add:** cures diabetes, treats diabetes, lowers blood sugar, medicine for diabetes.
