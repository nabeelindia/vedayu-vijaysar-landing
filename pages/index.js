import Head from 'next/head';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import SiteFooter from '../components/SiteFooter';

/* ─── Meta Pixel helper ──────────────────────────────────── */
const fbq = (event, params = {}) => {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('track', event, params);
};

/* ─── pack data ─────────────────────────────────────────── */
const PACKS = {
  1: { qty: 1, price: 499,  original: 699,  label: 'Vijaysar Glass × 1', name: 'Pack of 1',       tag: 'Try It Pack',        saving: 'You save ₹200' },
  2: { qty: 2, price: 899,  original: 1398, label: 'Vijaysar Glass × 2', name: 'Pack of 2',       tag: 'Couple Pack',        saving: 'You save ₹499 — ₹449.50 per glass' },
  5: { qty: 5, price: 1999, original: 3495, label: 'Vijaysar Glass × 5', name: 'Pack of 5',       tag: 'Family Pack',        saving: 'You save ₹1,496 — ₹399.80 per glass!' },
};
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

/* ─── Delivery estimate helper ──────────────────────────────── */
function getDeliveryEst(pincode) {
  const p = parseInt((pincode || '').slice(0, 3), 10);
  const isMetro = [110,111,400,401,402,560,561,600,601,700,500,380,411,122,302,226,208].some(m => p === m);
  const [lo, hi] = isMetro ? [3, 5] : [5, 8];
  const addDays = (n) => {
    const d = new Date();
    let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) added++; }
    return d;
  };
  const fmt2 = d => d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
  return `${fmt2(addDays(lo))} – ${fmt2(addDays(hi))}`;
}

/* ─── Ships-by helper ──────────────────────────────────────────
 * Computes the expected dispatch date based on IST time.
 * Cut-off: 1:00 PM IST every day except Sunday (off day).
 *
 * Returns one of:
 *   { label: 'Today',        note: '2 hrs 30 min left to order' }
 *   { label: 'Today',        note: 'Order by 1:00 PM IST'       }  ← < 60 min left
 *   { label: 'Mon, 26 May',  note: null                          }  ← after cutoff / Sunday
 * ─────────────────────────────────────────────────────────────── */
/* ─── Bold-keyword renderer ─────────────────────────────────────
 * Wrap key phrases in **double asterisks** and this helper renders
 * them as <strong>. To remove: delete this function and strip the
 * ** markers from the strings that use it.
 * ─────────────────────────────────────────────────────────────── */
function renderBold(str) {
  const parts = str.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

function getShipsBy() {
  const now = new Date();
  // Convert to IST by adding UTC+5:30 offset
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);

  const dayOfWeek    = ist.getUTCDay();   // 0 = Sunday
  const hour         = ist.getUTCHours();
  const minute       = ist.getUTCMinutes();
  const isSunday     = dayOfWeek === 0;
  const beforeCutoff = hour < 13;         // before 1:00 PM IST

  if (!isSunday && beforeCutoff) {
    const totalMinsLeft = (13 * 60) - (hour * 60 + minute);
    const h = Math.floor(totalMinsLeft / 60);
    const m = totalMinsLeft % 60;
    const note = h > 0
      ? `${h} hr${h > 1 ? 's' : ''} ${m} min left to order`
      : `${totalMinsLeft} min left to order`;
    return { label: 'Today', note };
  }

  // Find next working day (skip Sunday)
  const next = new Date(ist);
  next.setUTCDate(next.getUTCDate() + 1);
  if (next.getUTCDay() === 0) next.setUTCDate(next.getUTCDate() + 1); // skip Sunday

  // Use relative label when next ship day is literally tomorrow (IST)
  const todayDateStr = ist.toLocaleDateString('en-CA', { timeZone: 'UTC' });   // YYYY-MM-DD
  const nextDateStr  = next.toLocaleDateString('en-CA', { timeZone: 'UTC' });
  const todayDate    = new Date(todayDateStr);
  const nextDate     = new Date(nextDateStr);
  const diffDays     = Math.round((nextDate - todayDate) / (24 * 60 * 60 * 1000));

  const label = diffDays === 1
    ? 'Tomorrow'
    : next.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return { label, note: null };
}

/* ─── Product gallery images ────────────────────────────────── */
const GALLERY = [
  { src:'/images/product.jpg',   alt:'Vedayu Vijaysar Wooden Glass — front view' },
  { src:'/images/lifestyle.jpg', alt:'Vijaysar Glass — morning wellness ritual' },
  { src:'/images/authentic.jpg', alt:'100% authentic Vijaysar wood — how to identify' },
  { src:'/images/specs.jpg',     alt:'Vijaysar Glass dimensions — 6 inch, 80ml' },
];

/* ─── FAQ data ──────────────────────────────────────────── */
const FAQS = [
  { q: 'What is a Vijaysar wooden glass?', a: 'A Vijaysar wooden glass is a traditional Indian tumbler handcrafted from Vijaysar wood (Pterocarpus marsupium), also known as the Indian Kino tree. Vijaysar wood has been used in Ayurvedic wellness traditions for centuries. Water stored overnight takes on a slight natural tinge from the wood — this is completely normal and safe. It is used as part of a daily wellness and hydration ritual.' },
  { q: 'How do I use the Vijaysar tumbler?', a: '(1) Fill the tumbler with room temperature drinking water. (2) Cover and keep overnight for 6–8 hours. (3) Drink the Vijaysar wood infused water first thing in the morning on an empty stomach. (4) Rinse gently with plain water, dry thoroughly, and refill for the next day. Repeat daily.' },
  { q: 'Can Vijaysar glass cure diabetes?', a: 'No. The Vijaysar wooden glass is NOT a medicine and does NOT cure diabetes or any disease. It is a traditional Indian wellness product used as part of a healthy hydration routine. People with diabetes or any medical condition must consult their doctor before making changes to their routine.' },
  { q: 'How long should water be kept in the Vijaysar glass?', a: 'Ideally 6–8 hours. An overnight soak is the most convenient option — fill it before bed and your infused water is ready each morning. Do not soak for more than 10 hours.' },
  { q: 'Can I use hot water?', a: 'No. Use only room temperature or cold drinking water. Hot water can damage the natural wood. Never pour boiling or warm water into the tumbler.' },
  { q: 'How do I clean the Vijaysar glass?', a: 'Rinse gently with plain water only. No soap, detergent, or harsh chemicals — these damage the natural wood. Do not use a dishwasher. Dry completely after rinsing and store in a dry, ventilated place.' },
  { q: 'Is Cash on Delivery (COD) available?', a: 'Yes! Cash on Delivery is available all across India. You pay in cash when the product is delivered. No advance payment required for COD orders.' },
  { q: 'Is online / Razorpay payment available?', a: 'Yes. We accept all major payment methods via Razorpay — UPI (GPay, PhonePe, Paytm), debit cards, credit cards, net banking, and wallets.' },
  { q: 'Is delivery free?', a: 'Yes! Free delivery on all orders across India — Pack of 1, 2, or 5. No minimum order value.' },
  { q: 'What is the return and replacement policy?', a: '7-day replacement/return policy from the date of delivery. If your product arrives damaged or defective, contact us within 7 days and we will arrange a replacement.' },
  { q: 'How many days does delivery take?', a: 'Orders dispatched within 1–2 business days. Metro cities: 2–4 days. Other cities: 3–6 days. Remote areas: 5–8 days.' },
  { q: 'Can I gift this product?', a: 'Absolutely! It makes a beautiful, meaningful gift — especially for parents, in-laws, and elders. The Family Pack of 5 is our most popular gifting option. We can deliver directly to your recipient\'s address.' },
  { q: 'Does the wood colour vary between glasses?', a: 'Yes. Since each glass is made from natural wood, grain pattern, colour, and texture will vary slightly between pieces. This is not a defect — it is a natural characteristic of handcrafted wooden products.' },
  { q: 'Is this product suitable for daily use?', a: 'Yes. With proper care — rinsing with plain water, drying thoroughly, and storing in a dry place — it will last a long time.' },

  // ── High-search-volume additions — Week 2 SEO ──────────────────────────
  { q: 'Is Vijaysar glass safe for people with diabetes?', a: 'The Vijaysar wooden glass is a traditional Ayurvedic wellness product — it is NOT a medicine and does NOT treat, cure, or prevent diabetes or any other medical condition. Many people with diabetes use it as part of a healthy daily hydration habit, but it should not replace prescribed medication or medical advice. Always consult your doctor before making changes to your health routine.' },
  { q: 'How many days should I use the Vijaysar glass continuously?', a: 'Traditional Ayurvedic practice recommends using the Vijaysar glass daily for 90 days for a complete wellness cycle, then taking a 15–30 day break before resuming. Most people notice a subtle change in their water taste within the first few days. Consistent daily use is key — occasional use will not give the same experience as a regular morning ritual.' },
  { q: 'Vijaysar glass vs copper glass — which is better?', a: 'They serve different purposes. Copper glasses are used in Ayurveda primarily for their antimicrobial properties and are recommended for drinking water stored overnight. Vijaysar wooden glasses are used specifically for the natural wood infusion — Vijaysar wood (Pterocarpus marsupium) has been used in traditional Indian wellness for centuries. Many households keep both. If you are new to Ayurvedic rituals, the Vijaysar glass is gentler to start with as it does not alter the water\'s mineral profile the way copper does.' },
  { q: 'Can children use the Vijaysar wooden glass?', a: 'Vijaysar wood is a natural material with no synthetic coatings or chemicals. However, as with any traditional wellness product, it is intended for adults. We do not specifically recommend it for young children without consulting a paediatrician or Ayurvedic practitioner first. Teenagers and adults can use it as part of a healthy daily routine.' },
  { q: 'Why does the water turn pinkish or brownish overnight?', a: 'This is completely normal and expected — it is the natural tannins and botanical properties of the Vijaysar wood infusing into the water. The slight colour change (from pale pink to light brown) is a sign that the wood is authentic and active. The water is safe to drink. If your water shows no colour change at all after a week of use, contact us for a replacement.' },
  { q: 'Is Vijaysar glass better than plastic or steel bottles?', a: 'Yes, from a wellness perspective. Plastic bottles can leach microplastics and chemicals over time. Steel bottles are neutral — they add nothing to the water. The Vijaysar wooden glass is unique because it adds the natural wood infusion to water, making it part of an active Ayurvedic wellness ritual rather than just a storage container. It is not designed to replace a water bottle for carrying water — it is a dedicated daily-ritual tumbler.' },
  { q: 'What is Vijaysar wood (Pterocarpus marsupium)?', a: 'Vijaysar, botanically known as Pterocarpus marsupium, is a large deciduous tree native to India and Sri Lanka, commonly called the Indian Kino Tree or Malabar Kino. Its heartwood has been used in Ayurvedic medicine for centuries. The wood is dense, naturally fragrant, and has a rich reddish-brown colour. It is mentioned in classical Ayurvedic texts including Charaka Samhita. Our glasses are handcrafted from the heartwood of mature Vijaysar trees sourced responsibly from licensed suppliers.' },
];

/* ─── Indian states ─────────────────────────────────────── */
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

/* ─── Pincode lookup helpers ────────────────────────────────────────────── */
// India Post API returns proper District/State names — just need a small
// alias map for the handful of names that differ from our STATES dropdown.
const PIN_STATE_FIX = {
  'new delhi':          'Delhi',
  'orissa':             'Odisha',
  'uttaranchal':        'Uttarakhand',
  'jammu and kashmir':  'Jammu & Kashmir',
  'pondicherry':        'Puducherry',
  'andaman and nicobar islands': 'Andaman & Nicobar Islands',
  'dadra and nagar haveli':      'Dadra & Nagar Haveli',
};
function pinNormaliseState(raw) {
  if (!raw) return '';
  const lo = raw.trim().toLowerCase();
  return PIN_STATE_FIX[lo] || STATES.find(s => s.toLowerCase() === lo) || raw.trim();
}

/* ─── load Razorpay script ──────────────────────────────── */
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/* ═══════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();

  /* form state */
  const [pack,       setPack]       = useState(2);
  const [payment,    setPayment]    = useState('prepaid');
  const [form,       setForm]       = useState({ name:'', mobile:'', email:'', address:'', pincode:'', city:'', state:'' });
  const [loading,    setLoading]    = useState(false);
  const [openFaq,    setOpenFaq]    = useState(null);
  const [toast,      setToast]      = useState(null);
  const [welcomeBack,    setWelcomeBack]    = useState(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [utm,            setUtm]            = useState({});
  const [showSticky, setShowSticky] = useState(false);
  const [exitIntent, setExitIntent] = useState(false);
  const [deliveryEst, setDeliveryEst] = useState('');
  const [shipsBy,     setShipsBy]     = useState(null);
  const [touched,     setTouched]     = useState({});
  const [galleryIdx,  setGalleryIdx]  = useState(0);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referrerId,       setReferrerId]       = useState('');
  const orderPlaced  = useRef(false);
  const pincodeAbort = useRef(null);
  const swipeX       = useRef(null);

  /* sticky CTA on scroll */
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* compute ships-by once on mount (client-only — avoids SSR mismatch) */
  useEffect(() => { setShipsBy(getShipsBy()); }, []);

  /* ── Cookie helpers ─────────────────────────────────────────────────────── */
  const readCustomerCookie = () => {
    try {
      const m = document.cookie.match('(^|;)\\s*vedayu_customer\\s*=\\s*([^;]+)');
      return m ? JSON.parse(decodeURIComponent(m[2])) : null;
    } catch (_) { return null; }
  };
  const writeCustomerCookie = (data) => {
    try {
      const v = encodeURIComponent(JSON.stringify(data));
      // 180-day expiry, covers repeat purchases well
      document.cookie = `vedayu_customer=${v}; max-age=${180 * 24 * 3600}; path=/; SameSite=Lax`;
    } catch (_) {}
  };

  /* ── Restore from cookie on first load ──────────────────────────────────── */
  useEffect(() => {
    const c = readCustomerCookie();
    if (c?.name) {
      setForm(f => ({
        name:    c.name    || f.name,
        mobile:  c.mobile  || f.mobile,
        email:   c.email   || f.email,
        address: c.address || f.address,
        pincode: c.pincode || f.pincode,
        city:    c.city    || f.city,
        state:   c.state   || f.state,
      }));
      setWelcomeBack(c.name);  // re-use the existing green welcome-back banner
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* exit intent — desktop: mouse leaves top of viewport
                  mobile:   back button, fast scroll-up, or tab switch      */
  useEffect(() => {
    let shown = false;
    const show = () => {
      if (shown || orderPlaced.current) return;
      shown = true;
      setExitIntent(true);
    };

    // ── Desktop: cursor leaves through the top ────────────────────────────
    const onMouseLeave = (e) => { if (e.clientY <= 0) show(); };
    document.addEventListener('mouseleave', onMouseLeave);

    // ── Mobile: back button (push a dummy state so we can intercept it) ───
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) {
      history.pushState({ exitGuard: true }, '');
      const onPopState = (e) => {
        if (e.state?.exitGuard) { show(); history.pushState({ exitGuard: true }, ''); }
      };
      window.addEventListener('popstate', onPopState);

      // ── Mobile: fast upward scroll (≥ 200px upward within 400ms) ────────
      let lastY = window.scrollY;
      let lastT = Date.now();
      const onScroll = () => {
        const y = window.scrollY;
        const t = Date.now();
        if (y < lastY && (lastY - y) > 200 && (t - lastT) < 400) show();
        lastY = y; lastT = t;
      };
      window.addEventListener('scroll', onScroll, { passive: true });

      // ── Mobile: tab/app switch ────────────────────────────────────────
      const onVisibility = () => { if (document.visibilityState === 'hidden') show(); };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        document.removeEventListener('mouseleave', onMouseLeave);
        window.removeEventListener('popstate', onPopState);
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }

    return () => document.removeEventListener('mouseleave', onMouseLeave);
  }, []);

  /* cart abandonment — beacon on page leave if form partially filled */
  useEffect(() => {
    const onUnload = () => {
      if (orderPlaced.current) return;
      const { name, mobile } = form;
      if (!name.trim() && !mobile.trim()) return;
      const payload = JSON.stringify({ name, mobile, email: form.email, pack, payment });
      navigator.sendBeacon('/api/track-abandon', new Blob([payload], { type: 'application/json' }));
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [form, pack, payment]);

  /* Meta Pixel — ViewContent on page load */
  useEffect(() => {
    fbq('ViewContent', { content_name: 'Vijaysar Wooden Glass', content_ids: ['vijaysar-glass'], content_type: 'product', currency: 'INR', value: 499 });
  }, []);

  /* Capture UTM params + fbclid from URL on first load */
  useEffect(() => {
    if (!router.isReady) return;
    const { utm_source, utm_medium, utm_campaign, utm_content, fbclid } = router.query;
    const captured = {};
    if (utm_source)  captured.source   = utm_source;
    if (utm_medium)  captured.medium   = utm_medium;
    if (utm_campaign) captured.campaign = utm_campaign;
    if (utm_content) captured.content  = utm_content;
    if (fbclid)      captured.fbclid   = fbclid;
    if (Object.keys(captured).length) setUtm(captured);

    /* Referral — ?ref=VED-COD-XXXX gives ₹50 off */
    const { ref } = router.query;
    if (ref && /^VED-(COD|PRE)-\d+$/.test(ref)) {
      setReferrerId(ref);
      setReferralDiscount(50);
    }
  }, [router.isReady]);

  /* New-customer guard — runs whenever referrerId or mobile changes */
  useEffect(() => {
    if (!referrerId || !/^[6-9]\d{9}$/.test(form.mobile)) return;
    fetch(`/api/referral-validate?mobile=${form.mobile}`)
      .then(r => r.json())
      .then(d => { if (!d.valid) { setReferralDiscount(0); setReferrerId(''); showToast('Referral discount is for new customers only.', 'info'); } })
      .catch(() => {});
  }, [referrerId, form.mobile]);

  /* Meta Pixel — AddToCart when pack changes (after first interaction) */
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    fbq('AddToCart', { content_name: PACKS[pack].label, content_ids: [`vijaysar-${pack}`], content_type: 'product', currency: 'INR', value: PACKS[pack].price, num_items: PACKS[pack].qty });
  }, [pack]);

  /* show toast */
  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* inline validation helpers */
  const touch = (f) => setTouched(t => ({ ...t, [f]: true }));
  const fieldOk = {
    name:    () => form.name.trim().length > 1,
    mobile:  () => /^[6-9][0-9]{9}$/.test(form.mobile.trim()),
    email:   () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    address: () => form.address.trim().length > 5,
    pincode: () => /^[1-9][0-9]{5}$/.test(form.pincode),
    city:    () => form.city.trim().length > 0,
    state:   () => form.state.length > 0,
  };
  const vStyle = (f) => touched[f] ? { borderColor: fieldOk[f]() ? '#4A7C59' : '#e53e3e', boxShadow: fieldOk[f]() ? '0 0 0 2px rgba(74,124,89,.15)' : '0 0 0 2px rgba(229,62,62,.15)' } : {};
  const vIcon  = (f) => touched[f] ? (fieldOk[f]() ? <span style={{color:'#4A7C59',marginLeft:4,fontSize:'.8rem'}}>✓</span> : <span style={{color:'#e53e3e',marginLeft:4,fontSize:'.8rem'}}>✗</span>) : null;

  /* returning customer lookup — triggers when both mobile (10 digits) + email are filled */
  const lookupRef = useRef(null);
  const tryLookup = useCallback(async (mobile, email) => {
    if (!/^[6-9][0-9]{9}$/.test(mobile)) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    clearTimeout(lookupRef.current);
    lookupRef.current = setTimeout(async () => {
      try {
        const res  = await fetch('/api/lookup-customer', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ mobile, email }),
        });
        const data = await res.json();
        if (data.found) {
          const c = data.customer;
          setForm(f => ({
            ...f,
            name:    f.name    || c.name,
            address: f.address || c.address,
            pincode: f.pincode || c.pincode,
            city:    f.city    || c.city,
            state:   f.state   || c.state,
          }));
          setWelcomeBack(c.name);
        }
      } catch (_) {}
    }, 400);
  }, []);

  /* pincode auto-fill + real-time delivery estimate
     1. Calls /api/pincode-lookup to auto-fill city/state.
     2. Calls /api/delivery-estimate (Velocity Rates API) for a real ETA.
        Falls back to the static estimate if Velocity is unconfigured. */
  const handlePincode = useCallback(async (val) => {
    // always update the raw pincode value and clear stale city/state
    setForm(f => ({ ...f, pincode: val, city: '', state: '' }));

    // clear delivery estimate if pincode is incomplete
    if (val.length < 6) setDeliveryEst('');

    // cancel any in-flight request from previous keystroke
    if (pincodeAbort.current) pincodeAbort.current.abort();

    if (!/^[1-9]\d{5}$/.test(val)) {
      setPincodeLoading(false);
      return;
    }

    setPincodeLoading(true);
    pincodeAbort.current = new AbortController();

    try {
      // Run pincode lookup and delivery estimate in parallel
      const [pinRes, estRes] = await Promise.allSettled([
        fetch(`/api/pincode-lookup?pin=${val}`, { signal: pincodeAbort.current.signal }),
        fetch(`/api/delivery-estimate?pincode=${val}&cod=1&price=999`),
      ]);

      // Auto-fill city/state from Velocity serviceability DB (pincode-lookup)
      if (pinRes.status === 'fulfilled') {
        const pinData = await pinRes.value.json().catch(() => null);
        if (pinData?.city || pinData?.state) {
          setForm(f => ({
            ...f,
            city:  pinData.city  || f.city,
            state: pinNormaliseState(pinData.state) || f.state,
          }));
        }
        // Pincode not serviceable — clear estimate and show warning
        if (pinData && pinData.serviceable === false) {
          setDeliveryEst('⚠️ Delivery not available to this pincode');
          setPincodeLoading(false);
          return;
        }
      }

      // Real-time delivery estimate from Velocity Rates API
      if (estRes.status === 'fulfilled') {
        const est = await estRes.value.json().catch(() => null);
        if (est?.serviceable && est?.etaFormatted) {
          setDeliveryEst(`by ${est.etaFormatted}`);
        } else if (est?.codAvailable === false) {
          setDeliveryEst('⚠️ COD not available — prepaid only for this pincode');
        } else {
          setDeliveryEst(getDeliveryEst(val));
        }
      } else {
        setDeliveryEst(getDeliveryEst(val));
      }
    } catch (_) {
      // AbortError from rapid typing — silently ignored
    }

    setPincodeLoading(false);
  }, []);

  /* validation */
  const validate = () => {
    if (!form.name.trim())                                        return 'Please enter your full name.';
    if (!/^[6-9][0-9]{9}$/.test(form.mobile.trim()))             return 'Please enter a valid 10-digit mobile number.';
    if (!form.email.trim()) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (!form.address.trim())                                     return 'Please enter your delivery address.';
    if (!/^[1-9][0-9]{5}$/.test(form.pincode))                   return 'Please enter a valid 6-digit pincode.';
    if (!form.city.trim())                                        return 'Please enter your city.';
    if (!form.state)                                              return 'Please select your state.';
    return null;
  };

  /* ── place order ── */
  const placeOrder = async () => {
    const err = validate();
    if (err) { showToast(err); return; }
    setLoading(true);

    const selectedPack  = PACKS[pack];
    const finalPrice    = effectivePrice(pack, payment);
    const orderData = {
      pack:       selectedPack.name,
      price:      finalPrice,
      qty:        selectedPack.qty,
      payment,
      utm,
      referrerId: referrerId || undefined,
      ...form,
    };

    try {
      if (payment === 'cod') {
        /* ── COD flow ── */
        const res  = await fetch('/api/submit-cod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to place order');
        orderPlaced.current = true;
        writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, address: form.address, pincode: form.pincode, city: form.city, state: form.state });
        try { sessionStorage.setItem('vc_upsell_ctx', JSON.stringify({ mobile: form.mobile, email: form.email || '' })); } catch (_) {}
        router.push(`/order-confirmed?method=cod&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(data.orderId)}`);

      } else {
        /* ── Razorpay prepaid flow ── */
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error('Payment gateway failed to load. Please try again.');

        const res  = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: finalPrice, packName: selectedPack.name, customerName: form.name, referrerId: referrerId || undefined, mobile: form.mobile }),
        });
        const { order_id, amount } = await res.json();
        if (!res.ok) throw new Error('Could not create payment order. Please try again.');

        const rzp = new window.Razorpay({
          key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount,
          currency:    'INR',
          order_id,
          name:        'Vedayu',
          description: `Vijaysar Wooden Glass — ${selectedPack.name} (10% prepaid discount applied)`,
          image:       '/images/logo.png',
          prefill:     { name: form.name, contact: `+91${form.mobile}`, email: form.email || '' },
          notes:       { address: `${form.address}, ${form.city}, ${form.state} - ${form.pincode}` },
          theme:       { color: '#5C3D1E' },
          modal: {
            ondismiss: () => {
              setLoading(false);
              showToast('Payment incomplete — you can try COD to pay on delivery instead.', 'info');
              setPayment('cod');
              setTimeout(() => document.getElementById('checkout')?.scrollIntoView({ behavior:'smooth', block:'center' }), 300);
            }
          },
          handler: async (response) => {
            orderPlaced.current = true;
            writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, address: form.address, pincode: form.pincode, city: form.city, state: form.state });
            let finalOrderId = response.razorpay_payment_id || order_id || '';
            try {
              // Verify payment server-side + fire CAPI Purchase
              const vRes  = await fetch('/api/verify-payment', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                  razorpay_order_id:   order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                  amount,
                  pack:       selectedPack.name,
                  qty:        selectedPack.qty,
                  utm,
                  referrerId: referrerId || undefined,
                  ...form,
                }),
              });
              const vData = await vRes.json();
              if (vData.orderId) finalOrderId = vData.orderId;
            } catch { /* non-blocking — redirect regardless */ }
            try { sessionStorage.setItem('vc_upsell_ctx', JSON.stringify({ mobile: form.mobile, email: form.email || '' })); } catch (_) {}
            router.push(`/order-confirmed?method=prepaid&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(finalOrderId)}`);
          },
        });
        rzp.open();
        return; /* loading stays true until modal closes or handler fires */
      }
    } catch (e) {
      showToast(e.message || 'Something went wrong. Please try again.');
    } finally {
      if (payment === 'cod') setLoading(false);
    }
  };

  const scrollToCheckout = (packId, forcePayment) => {
    const selectedPack = packId || pack;
    if (packId) setPack(packId);
    if (forcePayment) setPayment(forcePayment);
    fbq('InitiateCheckout', { content_name: PACKS[selectedPack].label, content_ids: [`vijaysar-${selectedPack}`], content_type: 'product', currency: 'INR', value: PACKS[selectedPack].price, num_items: PACKS[selectedPack].qty });
    document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* prepaid is 10% off; referral gives flat ₹50 off the base price */
  const PREPAID_DISC = 0.10;
  const effectivePrice = (packId, method) => {
    const base = Math.max(0, PACKS[packId].price - referralDiscount);
    return method === 'prepaid' ? Math.round(base * (1 - PREPAID_DISC)) : base;
  };
  const discountAmt = (packId) => PACKS[packId].price - effectivePrice(packId, 'prepaid');

  const currentPack  = PACKS[pack];
  const currentPrice = effectivePrice(pack, payment);
  const WA_NUM       = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999';

  /* ═══════ JSX ═══════ */
  return (
    <>
      <Head>
        {/* ── Title — primary keyword first, commercial intent, price anchor ── */}
        <title>Vijaysar Wooden Glass — Buy Online India | Vedayu | From ₹499</title>

        {/* ── Meta description — keyword-rich, emotional hook, under 155 chars ── */}
        <meta name="description" content="Vijaysar Wooden Glass — fill overnight, drink infused water each morning. Ancient Ayurvedic wellness ritual. Starting ₹499 · Free delivery across India · COD available." />

        {/* ── Open Graph — WhatsApp / Facebook / Twitter share preview ── */}
        <meta property="og:type"        content="product" />
        <meta property="og:title"       content="Vijaysar Wooden Glass — Ayurvedic Wellness | Vedayu" />
        <meta property="og:description" content="Fill overnight, drink infused water each morning. Natural Vijaysar wood wellness ritual. From ₹499 · Free delivery · COD available." />
        <meta property="og:image"       content="https://vedayulife.com/images/og-image.jpg" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url"         content="https://vedayulife.com/" />
        <meta property="og:site_name"   content="Vedayu" />
        <meta property="product:price:amount"   content="499" />
        <meta property="product:price:currency" content="INR" />

        {/* ── Twitter card ── */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="Vijaysar Wooden Glass — Ayurvedic Wellness | Vedayu" />
        <meta name="twitter:description" content="Fill overnight, drink infused water each morning. From ₹499 · Free delivery · COD available." />
        <meta name="twitter:image"       content="https://vedayulife.com/images/og-image.jpg" />

        {/* ── Canonical ── */}
        <link rel="canonical" href="https://vedayulife.com/" />

        {/* ── JSON-LD Structured Data ── */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [

            // 1. WebSite
            {
              '@type': 'WebSite',
              '@id': 'https://vedayulife.com/#website',
              url: 'https://vedayulife.com',
              name: 'Vedayu',
              description: 'Natural Ayurvedic wellness products — Vijaysar Wooden Glass for daily wellness rituals.',
              inLanguage: 'en-IN',
            },

            // 2. Organization
            {
              '@type': 'Organization',
              '@id': 'https://vedayulife.com/#organization',
              name: 'Vedayu',
              legalName: 'Hashcart eCommerce Pvt. Ltd.',
              url: 'https://vedayulife.com',
              logo: 'https://vedayulife.com/favicon.svg',
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+91-70707-01956',
                contactType: 'customer service',
                email: 'hi@vedayulife.com',
                areaServed: 'IN',
                availableLanguage: ['English', 'Hindi'],
              },
            },

            // 3. Product — with images, seller, SKU, reviews
            {
              '@type': 'Product',
              '@id': 'https://vedayulife.com/#product',
              name: 'Vijaysar Wooden Glass',
              alternateName: ['Vijaysar Tumbler', 'Vijaysar Wood Glass', 'Vijaysar Herbal Glass'],
              description: 'Handcrafted tumbler made from 100% natural Vijaysar wood (Pterocarpus marsupium). Fill with water overnight, drink infused water each morning as part of an Ayurvedic wellness ritual. 6-inch height, 80ml capacity. Free delivery across India.',
              brand: { '@type': 'Brand', name: 'Vedayu' },
              manufacturer: { '@type': 'Organization', name: 'Vedayu', url: 'https://vedayulife.com' },
              sku: 'VED-VWG-01',
              material: 'Vijaysar Wood (Pterocarpus marsupium)',
              image: [
                'https://vedayulife.com/images/product.jpg',
                'https://vedayulife.com/images/lifestyle.jpg',
                'https://vedayulife.com/images/authentic.jpg',
                'https://vedayulife.com/images/benefits.jpg',
                'https://vedayulife.com/images/how-to-use.jpg',
              ],
              offers: [
                {
                  '@type': 'Offer',
                  name: 'Pack of 1',
                  sku: 'VED-VWG-01-P1',
                  price: '499',
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock',
                  url: 'https://vedayulife.com/',
                  seller: { '@type': 'Organization', name: 'Vedayu', url: 'https://vedayulife.com' },
                  shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
                    deliveryTime: { '@type': 'ShippingDeliveryTime', businessDays: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 6 } },
                    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
                  },
                  hasMerchantReturnPolicy: {
                    '@type': 'MerchantReturnPolicy',
                    applicableCountry: 'IN',
                    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                    merchantReturnDays: 7,
                    returnMethod: 'https://schema.org/ReturnByMail',
                    returnFees: 'https://schema.org/FreeReturn',
                  },
                },
                {
                  '@type': 'Offer',
                  name: 'Pack of 2',
                  sku: 'VED-VWG-01-P2',
                  price: '899',
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock',
                  url: 'https://vedayulife.com/',
                  seller: { '@type': 'Organization', name: 'Vedayu', url: 'https://vedayulife.com' },
                  shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
                    deliveryTime: { '@type': 'ShippingDeliveryTime', businessDays: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 6 } },
                    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
                  },
                  hasMerchantReturnPolicy: {
                    '@type': 'MerchantReturnPolicy',
                    applicableCountry: 'IN',
                    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                    merchantReturnDays: 7,
                    returnMethod: 'https://schema.org/ReturnByMail',
                    returnFees: 'https://schema.org/FreeReturn',
                  },
                },
                {
                  '@type': 'Offer',
                  name: 'Pack of 5',
                  sku: 'VED-VWG-01-P5',
                  price: '1999',
                  priceCurrency: 'INR',
                  availability: 'https://schema.org/InStock',
                  url: 'https://vedayulife.com/',
                  seller: { '@type': 'Organization', name: 'Vedayu', url: 'https://vedayulife.com' },
                  shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingRate: { '@type': 'MonetaryAmount', value: '0', currency: 'INR' },
                    deliveryTime: { '@type': 'ShippingDeliveryTime', businessDays: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 6 } },
                    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
                  },
                  hasMerchantReturnPolicy: {
                    '@type': 'MerchantReturnPolicy',
                    applicableCountry: 'IN',
                    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                    merchantReturnDays: 7,
                    returnMethod: 'https://schema.org/ReturnByMail',
                    returnFees: 'https://schema.org/FreeReturn',
                  },
                },
              ],
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '4.8',
                reviewCount: '200',
                bestRating: '5',
                worstRating: '1',
              },
              review: [
                {
                  '@type': 'Review',
                  reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
                  author: { '@type': 'Person', name: 'Priya Sharma' },
                  reviewBody: 'Been using it for 3 months. My morning feels more grounded and my digestion has improved noticeably. The wood quality is excellent.',
                  datePublished: '2026-03-15',
                },
                {
                  '@type': 'Review',
                  reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
                  author: { '@type': 'Person', name: 'Rajesh Verma' },
                  reviewBody: 'Gifted the family pack to my parents. They love the daily ritual. Very authentic Vijaysar wood and fast delivery.',
                  datePublished: '2026-02-28',
                },
                {
                  '@type': 'Review',
                  reviewRating: { '@type': 'Rating', ratingValue: '5', bestRating: '5' },
                  author: { '@type': 'Person', name: 'Sunita Patel' },
                  reviewBody: 'The water does turn slightly pinkish-brown overnight which shows the wood is real. Simple habit, feels very Ayurvedic.',
                  datePublished: '2026-04-10',
                },
              ],
            },

            // 4. FAQPage
            {
              '@type': 'FAQPage',
              mainEntity: FAQS.map(f => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },

            // 5. BreadcrumbList
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://vedayulife.com/' },
                { '@type': 'ListItem', position: 2, name: 'Vijaysar Wooden Glass', item: 'https://vedayulife.com/' },
              ],
            },

          ],
        }) }} />
      </Head>

      {/* ── TRUST STRIP ── */}
      <div className="trust-strip">
        <div className="trust-list">
          <span>🚚 Free Delivery All Over India</span>
          <span>↩️ 7-Day Replacement</span>
          <span>💳 Razorpay Secure | COD Available</span>
          <span>🌿 100% Natural Vijaysar Wood</span>
          <span>🇮🇳 Indian Wellness Brand</span>
        </div>
      </div>

      {/* ── MARQUEE ── */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {(() => {
            const items = ['🌿 Natural Vijaysar Wood','🚚 Free Delivery All Over India','🏺 Inspired by Traditional Ayurveda','💳 COD Available','↩️ 7-Day Replacement Guarantee','✋ Premium Handcrafted Finish','☀️ Sugar-Conscious Wellness Ritual','🎁 Gift for Parents & Family'];
            return [...items, ...items].map((t, i) => (
              <span key={i} className="marquee-item">{t}</span>
            ));
          })()}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          HERO
          ══════════════════════════════════════════ */}
      <section className="hero" id="hero">
        <div className="container">
          <div className="hero-grid">

            <div>
              <div className="badge-row">
                <span className="badge">🌿 Inspired by Ayurveda</span>
                <span className="badge badge-green">🚚 Free Delivery</span>
                <span className="badge">💳 COD Available</span>
              </div>
              <p className="eyebrow">Vedayu — Indian Wellness</p>
              <h1>Vijaysar Wooden Glass — Start Your Daily Ayurvedic Wellness Ritual</h1>
              <p className="hero-sub" style={{ marginTop: 14 }}>The traditional Vijaysar wooden tumbler — fill with water overnight, drink first thing each morning. A simple, natural hydration ritual inspired by thousands of years of Ayurvedic wisdom.</p>
              <div className="hero-price">
                <span className="price-main">₹499</span>
                <span className="price-original">₹699</span>
                <span className="price-save">Save ₹200</span>
              </div>
              <div className="hero-cta">
                <button className="btn btn-brown btn-lg" onClick={() => scrollToCheckout()}>🛒 Buy Now — Free Delivery</button>
                <a href="#how-it-works" className="btn btn-outline">How It Works ↓</a>
              </div>
              <div className="hero-micro">
                <span>✅ Razorpay Secure</span>
                <span>✅ Cash on Delivery</span>
                <span>✅ 7-Day Replacement</span>
                <span>✅ Made in India</span>
              </div>
            </div>

            <div className="hero-img-wrap">
              {/* Gallery */}
              <div
                style={{ position:'relative', borderRadius:16, overflow:'hidden', cursor:'grab', userSelect:'none', aspectRatio:'1/1', background:'#f9f5f0' }}
                onTouchStart={e => { swipeX.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                  if (swipeX.current === null) return;
                  const dx = e.changedTouches[0].clientX - swipeX.current;
                  if (Math.abs(dx) > 40) setGalleryIdx(i => dx < 0 ? Math.min(i+1, GALLERY.length-1) : Math.max(i-1, 0));
                  swipeX.current = null;
                }}
                onMouseDown={e => { swipeX.current = e.clientX; }}
                onMouseUp={e => {
                  if (swipeX.current === null) return;
                  const dx = e.clientX - swipeX.current;
                  if (Math.abs(dx) > 40) setGalleryIdx(i => dx < 0 ? Math.min(i+1, GALLERY.length-1) : Math.max(i-1, 0));
                  swipeX.current = null;
                }}
              >
                <Image
                  src={GALLERY[galleryIdx].src}
                  alt={GALLERY[galleryIdx].alt}
                  className="hero-product-img"
                  width={520}
                  height={520}
                  priority
                  style={{ transition:'opacity .25s', display:'block', width:'100%', height:'100%', objectFit:'contain' }}
                />
                {/* Prev / Next arrows */}
                {galleryIdx > 0 && (
                  <button onClick={() => setGalleryIdx(i => i-1)} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.85)', border:'none', borderRadius:'50%', width:36, height:36, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.15)' }} aria-label="Previous image">‹</button>
                )}
                {galleryIdx < GALLERY.length - 1 && (
                  <button onClick={() => setGalleryIdx(i => i+1)} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.85)', border:'none', borderRadius:'50%', width:36, height:36, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.15)' }} aria-label="Next image">›</button>
                )}
                {/* Dot indicators */}
                <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
                  {GALLERY.map((_, i) => (
                    <button key={i} onClick={() => setGalleryIdx(i)} style={{ width: i===galleryIdx ? 20 : 8, height:8, borderRadius:4, border:'none', background: i===galleryIdx ? '#5C3D1E' : 'rgba(255,255,255,.7)', cursor:'pointer', transition:'all .2s', padding:0 }} aria-label={`Image ${i+1}`} />
                  ))}
                </div>
              </div>
              <div className="spec-pills">
                <span className="spec-pill">📏 6 inch tall</span>
                <span className="spec-pill">💧 80 ml capacity</span>
                <span className="spec-pill">🪵 100% Natural Wood</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PROBLEM
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="problem">
        <div className="container">
          <h2 className="section-title">Does This Sound Like Your Daily Struggle?</h2>
          <p className="section-sub">Millions of Indian families face these everyday wellness challenges</p>
          <div className="divider" />
          <div className="problem-grid">
            {[
              { icon: '🍬', title: 'Too Much Sugar in Daily Diet',       body: 'Sweets, chai, processed foods — sugar sneaks into every meal. You want to be more mindful but don\'t know where to anchor a healthy habit.' },
              { icon: '💧', title: 'No Healthy Morning Routine',          body: 'You wake up, reach for your phone, have chai, and rush. There\'s no simple, grounding wellness ritual to start your day right.' },
              { icon: '🌿', title: 'Searching for Natural Alternatives',  body: 'Expensive supplements and pills feel artificial. You want something rooted in Indian tradition — natural, simple, and trustworthy.' },
              { icon: '👨‍👩‍👧‍👦', title: 'Worried About Parents\' Health',   body: 'You want to gift your parents something meaningful — not another pill, but a timeless natural daily habit they\'ll actually love.' },
              { icon: '⏰', title: 'No Time for Complex Routines',        body: 'Complex diets don\'t stick. You need something that takes 30 seconds each morning and builds into a habit automatically.' },
              { icon: '🏺', title: 'Disconnected from Ayurvedic Roots',  body: 'Our grandparents had simple, effective wellness traditions. In the rush of modern life, those traditions have been forgotten.' },
            ].map(({ icon, title, body }) => (
              <div className="problem-card" key={title}>
                <div className="problem-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <div className="cta-strip">
        <div className="container">
          <p>Start a simple, natural daily wellness ritual today.</p>
          <button className="btn btn-gold btn-lg" onClick={() => scrollToCheckout()}>🛒 Order Now — Free Delivery All Over India</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SOLUTION
          ══════════════════════════════════════════ */}
      <section className="section" id="solution">
        <div className="container">
          <div className="solution-grid">
            <div className="solution-img-wrap">
              <div className="solution-circle">
                <Image
                  src="/images/lifestyle.jpg"
                  alt="Vedayu Vijaysar Wooden Glass — Premium Natural Wood"
                  width={400}
                  height={400}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
              </div>
            </div>
            <div>
              <p className="solution-sub">The Solution</p>
              <h2>Meet Your New Daily Wellness Companion — The Vedayu Vijaysar Wooden Glass</h2>
              <div className="divider divider-left" style={{ marginTop: 14 }} />
              <p style={{ marginBottom: 20 }}>Vijaysar wood has been used in traditional Indian wellness practices for generations. The Vedayu Vijaysar Wooden Glass brings this ancient tradition into your modern daily routine — simply, beautifully, and naturally.</p>
              <ul className="solution-points">
                {[
                  'Fill with **room temperature** water **overnight** — let the natural wood do its work while you sleep',
                  'Drink your first glass of **Vijaysar wood infused water** every morning',
                  'Support your **sugar-conscious lifestyle** with a purposeful natural hydration ritual',
                  '**100% natural**, reusable, eco-friendly — no chemicals, no artificial ingredients',
                  'Inspired by **Ayurveda** — a tradition trusted for thousands of years in India',
                  'A deeply meaningful **gift** for parents, family, and wellness-conscious loved ones',
                ].map(pt => (
                  <li key={pt}><span className="check" /><span>{renderBold(pt)}</span></li>
                ))}
              </ul>
              <button className="btn btn-brown" onClick={() => scrollToCheckout()}>Get Yours — ₹499 Only →</button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CELEBRITY ENDORSEMENT
          ══════════════════════════════════════════ */}
      <section className="section" id="celebrity">
        <div className="container">
          <div className="celebrity-label">🎬 As Seen With</div>
          <h2 className="section-title">Sanjay Mishra on Vijaysar Wood</h2>
          <p className="section-sub">Popular Bollywood actor Sanjay Mishra shares why he swears by the power of Vijaysar wood</p>
          <div className="divider" />
          <div className="celebrity-wrap">
            <div className="celebrity-video-wrap">
              <video
                className="video-player"
                controls
                playsInline
                preload="metadata"
                poster="/images/thumb-celebrity.jpg"
              >
                <source src={process.env.NEXT_PUBLIC_VIDEO_CELEBRITY || "/videos/celebrity.mp4"} type="video/mp4" />
              </video>
            </div>
            <div className="celebrity-side">
              <div className="celebrity-quote-block">
                <p className="celebrity-quote">&ldquo;Vijaysar wood ke fayde hazaron saal se Ayurveda mein maane jaate hain. Yeh ek aisi cheez hai jo nature ne humein di hai — aur humein iska fayda uthana chahiye.&rdquo;</p>
                <div className="celebrity-byline">— Sanjay Mishra, Actor</div>
              </div>
              <div className="celebrity-badges">
                <span className="video-badge">🎬 Actor</span>
                <span className="video-badge">✅ Verified Endorsement</span>
              </div>
              <a href="#checkout" className="btn btn-brown btn-lg">
                🛒 Order Now — Free Delivery
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          VIDEO TESTIMONIAL
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="video-testimonial">
        <div className="container">
          <h2 className="section-title">See Why 25,000+ Families Trust Vedayu</h2>
          <p className="section-sub">Real customers, real stories — hear it in their own words</p>
          <div className="divider" />
          <div className="video-duo-wrap">
            <div className="video-duo-item">
              <div className="video-player-wrap">
                <video
                  className="video-player"
                  controls
                  playsInline
                  preload="metadata"
                  poster="/images/thumb-testimonial.jpg"
                >
                  <source src={process.env.NEXT_PUBLIC_VIDEO_TESTIMONIAL || "/videos/testimonial.mp4"} type="video/mp4" />
                </video>
              </div>
              <div className="video-duo-caption">
                <div className="video-stars">★★★★★</div>
                <p className="video-pull-quote">&ldquo;Maine pehle kai products try kiye — kuch kaam aaya, kuch nahi. Vijaysar glass ne meri subah ki routine change kar di.&rdquo;</p>
                <div className="video-author-line">Verified Customer &nbsp;·&nbsp; Vedayu Order</div>
              </div>
            </div>
            <div className="video-duo-item">
              <div className="video-player-wrap">
                <video
                  className="video-player"
                  controls
                  playsInline
                  preload="metadata"
                  poster="/images/thumb-meta-ad.jpg"
                >
                  <source src={process.env.NEXT_PUBLIC_VIDEO_METAAD || "/videos/meta-ad.mp4"} type="video/mp4" />
                </video>
              </div>
              <div className="video-duo-caption">
                <div className="video-stars">★★★★★</div>
                <p className="video-pull-quote">&ldquo;Vijaysar wood — 2,000 years of Ayurvedic tradition, one simple morning habit. Pure, natural, and genuinely effective.&rdquo;</p>
                <div className="video-author-line">Vedayu &nbsp;·&nbsp; Official</div>
              </div>
            </div>
          </div>
          <div className="video-section-cta">
            <div className="video-badges">
              <span className="video-badge">✅ Real Customers</span>
              <span className="video-badge">📦 25,000+ Orders</span>
              <span className="video-badge">🇮🇳 Made in India</span>
            </div>
            <a href="#checkout" className="btn btn-brown btn-lg" style={{ marginTop: 20, display: 'inline-block' }}>
              🛒 Order Now — Free Delivery
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          BENEFITS
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="benefits">
        <div className="container">
          <h2 className="section-title">Why Choose Vedayu Vijaysar Wooden Glass?</h2>
          <p className="section-sub">Everything you need. Nothing you don&apos;t.</p>
          <div className="divider" />
          <div className="benefits-grid">
            {[
              { icon: '🌿', title: 'Supports Sugar-Conscious Lifestyle',  body: 'Build a daily habit of Vijaysar wood infused water as part of a mindful, natural morning wellness routine.' },
              { icon: '🏺', title: 'Inspired by Traditional Ayurveda',    body: 'Vijaysar wood has been part of Indian wellness traditions for centuries. This tumbler honours that living heritage.' },
              { icon: '🪵', title: '100% Natural Vijaysar Wood',           body: 'No plastic, no coatings, no chemicals. Pure, naturally harvested Vijaysar wood — exactly as nature intended.' },
              { icon: '💧', title: 'Simple Overnight Infusion',            body: 'Fill before bed. Drink in the morning. A complete daily wellness ritual in just 30 seconds of effort.' },
              { icon: '🔄', title: 'Reusable & Eco-Friendly',             body: 'A one-time purchase that lasts. No disposable packets or wasteful packaging. Good for you and the planet.' },
              { icon: '✋', title: 'Premium Handcrafted Finish',           body: 'Each tumbler is shaped by skilled artisans. Unique natural grain patterns make every piece one-of-a-kind.' },
              { icon: '🎁', title: 'Perfect Gift for Parents',             body: 'A thoughtful gift for parents, in-laws, and elders — something they\'ll use and value every single day.' },
              { icon: '☀️', title: 'Builds a Purposeful Morning Habit',    body: 'Replace empty morning habits with a grounding wellness ritual. Start each day with intention.' },
            ].map(({ icon, title, body }) => (
              <div className="benefit-card" key={title}>
                <div className="benefit-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════ */}
      <section className="section" id="how-it-works">
        <div className="container">
          <h2 className="section-title">How to Use Your Vijaysar Wooden Glass</h2>
          <p className="section-sub">4 simple steps. One powerful daily wellness habit.</p>
          <div className="divider" />
          {/* Two-column layout: image left, steps right on desktop */}
          <div className="how-to-grid">

            {/* Left — infographic image */}
            <div className="how-to-img-col">
              <Image
                src="/images/how-to-use.jpg"
                alt="How to use Vijaysar Wooden Glass — 4 steps infographic"
                width={480}
                height={480}
                style={{ width: '100%', maxWidth: 480, height: 'auto', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.12)', display: 'block', margin: '0 auto' }}
              />
            </div>

            {/* Right — steps + tips + CTA */}
            <div className="how-to-steps-col">
              <div className="steps-vertical">
                {[
                  { icon: '💧', title: 'Step 1 — Fill',           body: 'Fill the tumbler with normal room temperature drinking water. Do not use hot water.' },
                  { icon: '🌙', title: 'Step 2 — Rest',           body: 'Cover and keep overnight for 6–8 hours. Let the Vijaysar wood naturally infuse into the water.' },
                  { icon: '☀️', title: 'Step 3 — Drink',          body: 'First thing in the morning, drink the Vijaysar wood infused water — ideally on an empty stomach.' },
                  { icon: '♻️', title: 'Step 4 — Rinse & Repeat', body: 'Rinse gently with plain water. Dry thoroughly. Refill tonight. Build your daily ritual.' },
                ].map(({ icon, title, body }) => (
                  <div className="step-v" key={title}>
                    <div className="step-v-icon">{icon}</div>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--vd-dark-brown)' }}>{title}</h3>
                      <p style={{ margin: 0, fontSize: '.9rem', color: 'var(--vd-text-light)', lineHeight: 1.6 }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="usage-tips" style={{ marginTop: 24 }}>
                <h3>📋 Care Tips</h3>
                <ul>
                  <li>Use only <strong>room temperature water</strong> — never hot</li>
                  <li>Rinse with plain water only — <strong>no soap or chemicals</strong></li>
                  <li><strong>Dry completely</strong> after each use</li>
                  <li>Do not soak for more than 8–10 hours</li>
                </ul>
              </div>

              <button className="btn btn-brown btn-lg" style={{ marginTop: 28, width: '100%' }} onClick={() => scrollToCheckout()}>
                🛒 Order Now — Starting ₹499
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          MAKING PROCESS
          ══════════════════════════════════════════ */}
      <section className="section section-dark" id="making">
        <div className="container">
          <h2 className="section-title" style={{ color: '#fff' }}>Crafted with Care. Inspected Before Dispatch.</h2>
          <p className="section-sub" style={{ color: 'rgba(255,255,255,.72)' }}>Every Vedayu tumbler goes through a 6-step quality process before it reaches you</p>
          <div className="divider" />
          <div className="process-grid">
            {[
              { n:1, title:'Wood Selection',    body:'Only mature, high-quality Vijaysar wood is selected. Each piece checked for purity and integrity.' },
              { n:2, title:'Cutting & Sizing',  body:'Precisely cut to 6 inch height and 2 inch diameter for the perfect handheld size.' },
              { n:3, title:'Hollowing',         body:'Skilled artisans carefully hollow the tumbler to an 80 ml capacity — smooth inside for clean water infusion.' },
              { n:4, title:'Natural Finishing', body:'No chemical varnishes or synthetic paints. Naturally sanded for a premium, safe finish.' },
              { n:5, title:'Quality Check',     body:'Every tumbler individually inspected — checked for cracks, smoothness, and correct dimensions.' },
              { n:6, title:'Safe Packaging',    body:'Each tumbler carefully packed to ensure safe delivery to your door anywhere in India.' },
            ].map(({ n, title, body }) => (
              <div className="process-item" key={n}>
                <div className="process-num">{n}</div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRODUCT SPECS
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="product-details">
        <div className="container">
          <h2 className="section-title">Product Specifications</h2>
          <p className="section-sub">Everything you need to know about the Vedayu Vijaysar Wooden Glass</p>
          <div className="divider" />

          {/* Product infographics */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
            <Image
              src="/images/specs.jpg"
              alt="Vijaysar Wood Tumbler dimensions — 6.1 inch height, 80ml capacity"
              width={380}
              height={380}
              style={{ width: '100%', maxWidth: 380, height: 'auto', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}
            />
            <Image
              src="/images/authentic.jpg"
              alt="100% Authentic Vijaysar Wood vs Jamun Wood — how to identify"
              width={380}
              height={380}
              style={{ width: '100%', maxWidth: 380, height: 'auto', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}
            />
          </div>

          <div className="specs-table">
            {[
              ['Product Name',       'Vedayu Vijaysar Wooden Herbal Glass / Tumbler'],
              ['Material',           '100% Natural Vijaysar Wood (Pterocarpus marsupium)'],
              ['Height',             '6 inches (approx. 15 cm)'],
              ['Diameter',           '2 inches (approx. 5 cm)'],
              ['Capacity',           '80 ml'],
              ['Finish',             'Natural wood finish — no chemical coating or paint'],
              ['Usage',              'Water infusion only (room temperature water only)'],
              ['Available Packs',    'Pack of 1 | Pack of 2 (Couple) | Pack of 5 (Family)'],
              ['Delivery',           'Free delivery all over India'],
              ['Return/Replacement', '7 days from date of delivery'],
              ['Payment',            'Razorpay (Prepaid) + Cash on Delivery (COD)'],
              ['Country of Origin',  'India'],
              ['Care',               'Rinse with plain water only. Dry thoroughly after use.'],
              ['Note',               'Natural grain, colour & texture vary — each piece is unique.'],
            ].map(([label, value]) => (
              <div className="spec-row" key={label}>
                <div className="spec-label">{label}</div>
                <div className="spec-value">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRICING
          ══════════════════════════════════════════ */}
      <section className="section" id="pricing">
        <div className="container">
          <h2 className="section-title">Choose Your Pack</h2>
          <p className="section-sub">Free delivery on all orders &nbsp;·&nbsp; Razorpay Secure &nbsp;·&nbsp; COD Available</p>
          <div className="divider" />
          <div className="pricing-grid">

            {/* Pack of 1 */}
            <div className="pricing-card">
              <h3>Pack of 1</h3>
              <span className="pricing-tag">Try It Pack</span>
              <div className="pricing-price">₹499</div>
              <div className="pricing-original">₹699</div>
              <div className="pricing-saving">You save ₹200</div>
              <ul className="pricing-features">
                {['1 Vijaysar Wooden Glass','Free delivery all over India','7-day replacement guarantee','Razorpay Prepaid + COD','Usage guide included'].map(f => (
                  <li key={f}><span className="check" />{f}</li>
                ))}
              </ul>
              <button className="btn btn-brown btn-full" onClick={() => scrollToCheckout(1)}>Buy Pack of 1</button>
            </div>

            {/* Pack of 2 — Most Popular */}
            <div className="pricing-card pricing-card-popular">
              <div className="pricing-badge">⭐ Most Popular</div>
              <h3>Pack of 2</h3>
              <span className="pricing-tag">Couple Pack</span>
              <div className="pricing-price">₹899</div>
              <div className="pricing-original">₹1,398</div>
              <div className="pricing-saving">You save ₹499 — ₹449.50 per glass</div>
              <ul className="pricing-features">
                {['2 Vijaysar Wooden Glasses','Ideal for couples & parents','Free delivery all over India','7-day replacement guarantee','Razorpay Prepaid + COD'].map(f => (
                  <li key={f}><span className="check" />{f}</li>
                ))}
              </ul>
              <button className="btn btn-green btn-full" onClick={() => scrollToCheckout(2)}>Buy Couple Pack</button>
            </div>

            {/* Pack of 5 — Best Value */}
            <div className="pricing-card pricing-card-family">
              <div className="pricing-badge pricing-badge-gold">🏆 Best Value Family Pack</div>
              <h3>Pack of 5</h3>
              <span className="pricing-tag">Family Pack</span>
              <div className="pricing-price">₹1,999</div>
              <div className="pricing-original">₹3,495</div>
              <div className="pricing-saving">You save ₹1,496 — only ₹399.80 per glass!</div>
              <ul className="pricing-features">
                {['5 Vijaysar Wooden Glasses','Ideal for family & gifting','Free delivery all over India','7-day replacement guarantee','Razorpay Prepaid + COD','Best price per piece'].map(f => (
                  <li key={f}><span className="check" />{f}</li>
                ))}
              </ul>
              <button className="btn btn-gold btn-full" onClick={() => scrollToCheckout(5)}>Buy Family Pack</button>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CHECKOUT
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="checkout">
        <div className="container">
          <h2 className="section-title">Complete Your Order</h2>
          <p className="section-sub">Free delivery &nbsp;·&nbsp; Secure payment &nbsp;·&nbsp; 7-day replacement</p>
          <div className="divider" />

          {/* ── Referral discount banner ── */}
          {referralDiscount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(90deg, #2d6b40, #4A7C59)',
              borderRadius: 12, padding: '14px 20px', marginBottom: 20,
            }}>
              <span style={{ fontSize: '1.6rem' }}>🎁</span>
              <div>
                <p style={{ margin: 0, color: '#fff', fontWeight: 800, fontSize: '.95rem' }}>
                  ₹50 referral discount applied!
                </p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,.8)', fontSize: '.78rem' }}>
                  A friend shared this with you — your price is already reduced below.
                </p>
              </div>
            </div>
          )}

          <div className="checkout-wrap">
            <div className="checkout-head">
              <h3>Order Vedayu Vijaysar Wooden Glass</h3>
              <p>🔒 Secure checkout &nbsp;·&nbsp; Razorpay Prepaid &nbsp;·&nbsp; Cash on Delivery</p>
            </div>

            <div className="checkout-body">

              {/* Pack selector */}
              <label className="field-label" style={{ marginBottom: 8 }}>Select Your Pack:</label>
              <div className="pack-selector">
                {[1, 2, 5].map(p => (
                  <div key={p} className={`pack-option${pack === p ? ' active' : ''}`} onClick={() => setPack(p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPack(p)}>
                    {p === 2 && <span className="pack-popular-tag">⭐ Most Popular</span>}
                    {p === 5 && <span className="pack-popular-tag" style={{background:'#C9A84C',color:'#3D2610'}}>🏆 Best Value</span>}
                    <span className="pack-name">{PACKS[p].name}</span>
                    <span className="pack-price">{fmt(PACKS[p].price)}</span>
                    <span style={{ fontSize:'.72rem', color:'#2d6b40', fontWeight:600, marginTop:2 }}>
                      {p === 1 ? '₹499/glass' : p === 2 ? '₹449.50/glass' : '₹399.80/glass'}
                    </span>
                    {p > 1 && <span style={{ fontSize:'.68rem', background:'#d4edda', color:'#1a5c2a', padding:'2px 6px', borderRadius:10, marginTop:3, display:'inline-block', fontWeight:600 }}>
                      Save {fmt(PACKS[p].original - PACKS[p].price)}
                    </span>}
                  </div>
                ))}
              </div>

              {/* Order summary */}
              <div className="order-summary">
                <div className="order-row"><span>{currentPack.label}</span><span>{fmt(currentPack.price)}</span></div>
                {payment === 'prepaid' && (
                  <div className="order-row" style={{ color: '#4A7C59', fontWeight: 600 }}>
                    <span>🎉 Prepaid Discount (10% off)</span>
                    <span>− {fmt(discountAmt(pack))}</span>
                  </div>
                )}
                <div className="order-row order-row-free"><span>🚚 Delivery</span><span>FREE</span></div>
                <div className="order-row order-row-total"><span>Total</span><span>{fmt(currentPrice)}</span></div>
              </div>

              {/* Welcome back — cookie or server KV lookup restored details */}
              {welcomeBack && (
                <div style={{ background: '#F0F9F3', border: '1px solid #4A7C59', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.88rem', color: '#2d6b40', display: 'flex', alignItems: 'center', gap: 8 }}>
                  👋 <span>Welcome back, <strong>{welcomeBack}</strong>! Your delivery details are pre-filled — just place your order.</span>
                </div>
              )}

              {/* Customer details */}
              <label className="field-label" style={{ marginBottom: 8 }}>Your Delivery Details:</label>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label" htmlFor="name">Full Name *{vIcon('name')}</label>
                  <input id="name" type="text" placeholder="Your full name" autoComplete="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onBlur={() => touch('name')} style={vStyle('name')} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="mobile">Mobile Number *{vIcon('mobile')}</label>
                  <input id="mobile" type="tel" placeholder="10-digit number" maxLength={10} inputMode="numeric" value={form.mobile} onChange={e => { const v = e.target.value.replace(/\D/g,''); setForm(f => ({ ...f, mobile: v })); tryLookup(v, form.email); }} onBlur={async () => { touch('mobile'); if (referrerId && /^[6-9]\d{9}$/.test(form.mobile)) { try { const r = await fetch(`/api/referral-validate?mobile=${form.mobile}`); const d = await r.json(); if (!d.valid) { setReferralDiscount(0); setReferrerId(''); showToast('Referral discount is for new customers only.', 'info'); } } catch {} } }} style={vStyle('mobile')} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="email">
                  Email Address{vIcon('email')}
                </label>
                <input id="email" type="email" placeholder="yourname@gmail.com" autoComplete="email" required value={form.email} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, email: v })); tryLookup(form.mobile, v); }} onBlur={() => touch('email')} style={vStyle('email')} />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="address">Full Delivery Address *{vIcon('address')}</label>
                <textarea id="address" rows={2} placeholder="House no., Street, Area, Landmark" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} onBlur={() => touch('address')} style={{ resize: 'vertical', ...vStyle('address') }} />
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label" htmlFor="pincode">
                    Pincode *{vIcon('pincode')}{pincodeLoading && <span style={{ fontWeight:400, color:'#4A7C59', fontSize:'.76rem', marginLeft:6 }}>🔍 detecting…</span>}
                  </label>
                  <input id="pincode" type="text" placeholder="6-digit pincode" maxLength={6} inputMode="numeric" value={form.pincode} onChange={e => handlePincode(e.target.value.replace(/\D/g,''))} onBlur={() => touch('pincode')} style={vStyle('pincode')} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="city">City *{vIcon('city')}</label>
                  <input id="city" type="text" placeholder={pincodeLoading ? 'Detecting city…' : 'City / Town'} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} onBlur={() => touch('city')} style={vStyle('city')} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="state">State *{vIcon('state')}</label>
                <select id="state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} onBlur={() => touch('state')} style={vStyle('state')}>
                  <option value="">{pincodeLoading ? 'Detecting state…' : 'Select State'}</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {(deliveryEst || shipsBy) && (
                <div style={{ background:'#F0F9F3', border:'1px solid #4A7C59', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:'.88rem', color:'#2d6b40' }}>
                  {shipsBy && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: deliveryEst ? 5 : 0 }}>
                      📦 <span>Ships: <strong>{shipsBy.label}</strong>{shipsBy.note && <span style={{ fontWeight:400, color:'#4A7C59', marginLeft:6 }}>· {shipsBy.note}</span>}</span>
                    </div>
                  )}
                  {deliveryEst && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      🚚 <span>Expected delivery: <strong>{deliveryEst}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment */}
              <label className="field-label" style={{ marginBottom: 8 }}>Payment Method:</label>
              <div className="payment-grid">
                <div className={`payment-option${payment === 'prepaid' ? ' active' : ''}`} onClick={() => setPayment('prepaid')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPayment('prepaid')}>
                  <span className="payment-icon">💳</span>
                  <span className="payment-label">Pay Online</span>
                  <span className="payment-sub">Razorpay · UPI · Cards · Wallets</span>
                  <span style={{ display:'inline-block', marginTop:4, background:'#4A7C59', color:'#fff', fontSize:'.68rem', fontWeight:700, padding:'2px 8px', borderRadius:20 }}>🎉 10% OFF</span>
                </div>
                <div className={`payment-option${payment === 'cod' ? ' active' : ''}`} onClick={() => setPayment('cod')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPayment('cod')}>
                  <span className="payment-icon">💵</span>
                  <span className="payment-label">Cash on Delivery</span>
                  <span className="payment-sub">Pay when delivered</span>
                </div>
              </div>

              <button className="btn btn-brown btn-full" style={{ padding: '17px', fontSize: '1.05rem' }} onClick={placeOrder} disabled={loading}>
                {loading ? <><span className="spinner" />Processing...</> : '🛒 Place Order — Free Delivery'}
              </button>
              <p className="form-footer">🔒 100% Secure &nbsp;·&nbsp; Your details are safe &nbsp;·&nbsp; No spam</p>
            </div>
          </div>

          <div className="disclaimer">
            <strong>⚠️ Important Disclaimer</strong>
            This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease. The Vijaysar Wooden Glass is a traditional wellness product used as part of a healthy hydration routine, inspired by Ayurvedic practice. People with diabetes or any medical condition should consult a qualified doctor before making any changes to their routine.
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST
          ══════════════════════════════════════════ */}
      <section className="section section-green" id="trust">
        <div className="container">
          <h2 className="section-title" style={{ color: '#fff' }}>Why Thousands of Indian Families Trust Vedayu</h2>
          <div className="divider" />
          <div className="trust-grid">
            {[
              { icon:'🔒', title:'Razorpay Secure',       body:'India\'s most trusted payment gateway. UPI, cards, wallets — all accepted safely.' },
              { icon:'💵', title:'COD Available',         body:'Pay cash when your order is delivered. No advance payment required.' },
              { icon:'🚚', title:'Free Delivery',         body:'Free shipping to every pincode across India. No minimum order value.' },
              { icon:'↩️', title:'7-Day Replacement',     body:'Not satisfied with quality? Get a replacement within 7 days of delivery.' },
              { icon:'📦', title:'Careful Packaging',     body:'Every tumbler individually packed and quality checked before dispatch.' },
              { icon:'🌿', title:'Indian Wellness Brand', body:'Proudly Indian — rooted in Ayurvedic tradition, made for Indian families.' },
              { icon:'💬', title:'WhatsApp Support',      body:'Questions? Chat with us on WhatsApp anytime. We respond fast.' },
              { icon:'✅', title:'Quality Checked',       body:'Every tumbler inspected before dispatch. You receive only the best.' },
            ].map(({ icon, title, body }) => (
              <div className="trust-item" key={title}>
                <div className="trust-icon">{icon}</div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip 2 */}
      <div style={{ background: 'var(--vd-off-white)', padding: '48px 20px', textAlign: 'center', borderTop: '1px solid var(--vd-border)' }}>
        <div className="container">
          <h2 style={{ color: 'var(--vd-dark-brown)', marginBottom: 10 }}>Ready to Start Your Daily Wellness Ritual?</h2>
          <p style={{ color: 'var(--vd-text-light)', marginBottom: 26 }}>Join Indian families building healthier morning habits — naturally, simply, daily.</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-brown btn-lg" onClick={() => scrollToCheckout()}>🛒 Order Now — Starting ₹499</button>
            <a href="#pricing" className="btn btn-outline">View All Packs →</a>
          </div>
          <p style={{ marginTop: 14, fontSize: '.76rem', color: 'var(--vd-text-light)' }}>Free delivery · 7-day replacement · Razorpay + COD</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          REVIEWS
          ══════════════════════════════════════════ */}
      <section className="section" id="reviews">
        <div className="container">
          <h2 className="section-title">What Our Customers Are Saying</h2>
          <p className="section-sub">Real experiences from real Indian families across the country</p>
          <div className="divider" />
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--vd-brown)', lineHeight: 1 }}>4.8 / 5</div>
            <div style={{ color: 'var(--vd-gold)', fontSize: '1.4rem', letterSpacing: 4, margin: '5px 0' }}>★★★★★</div>
            <div style={{ fontSize: '.82rem', color: 'var(--vd-text-light)' }}>Based on 25,000+ verified orders across India</div>
          </div>
          <div className="reviews-grid">
            {[
              { color:'#C9A84C', name:'Rama Devi',      loc:'Varanasi, Uttar Pradesh', ago:'2 weeks ago',  stars:'★★★★★', text:'बहुत अच्छा उत्पाद है। मेरे पति पिछले 3 महीनों से रोज़ सुबह इस गिलास का पानी पी रहे हैं। लकड़ी की गुणवत्ता बहुत अच्छी है, असली विजयसर की लकड़ी है। पानी रात भर रखने के बाद हल्का गुलाबी रंग हो जाता है — यह देख कर मन को संतोष होता है। पैकिंग भी बहुत सुरक्षित थी।' },
              { color:'#5C3D1E', name:'Kumar Raghav',   loc:'Patna, Bihar',            ago:'3 weeks ago',  stars:'★★★★★', text:'Bhai, 2 mahine ho gaye use karte hue. Subah uthke seedha yahi paani peeta hoon. Pehle koi routine nahi tha, ab yeh glass yaad dilata hai. Delivery bhi 4 din mein aa gayi — COD mein koi problem nahi hui. Quality ekdum solid hai, koi plastic smell nahi, pure wood.' },
              { color:'#4A7C59', name:'Priya Sharma',   loc:'Pune, Maharashtra',       ago:'1 month ago',  stars:'★★★★★', text:'Bought this for my father after my aunt recommended it. The wood quality is really premium — you can tell it\'s handcrafted. He uses it every morning now and genuinely enjoys the ritual. Packaging was very safe, no damage at all. Fast delivery to Pune within 3 days!' },
              { color:'#7a5028', name:'Kavita Jha',     loc:'Jaipur, Rajasthan',       ago:'5 weeks ago',  stars:'★★★★★', text:'पहले पानी पीने का कोई नियम नहीं था, बस जब मन करे पी लिया। अब रोज़ रात को गिलास भर देती हूँ और सुबह सबसे पहले यही पानी पीती हूँ। 90 दिन का ritual complete किया — अब दूसरा गिलास मँगवाया है। बहुत सुंदर तोहफ़ा भी है बुज़ुर्गों के लिए।' },
              { color:'#3D2610', name:'Arjun Nair',     loc:'Bangalore, Karnataka',    ago:'6 weeks ago',  stars:'★★★★★', text:'Was skeptical initially but glad I ordered. The glass is beautifully crafted — each piece has a unique grain pattern which shows it\'s genuinely handmade. My mother uses it every single morning without fail. Delivery in 3 days to Bangalore. Totally worth it!' },
              { color:'#9e5c2e', name:'Pooja Mehta',    loc:'Surat, Gujarat',          ago:'7 weeks ago',  stars:'★★★★☆', text:'Mummy ke liye family pack liya tha — 5 glasses. Sabko bahut pasand aaya. Ek ek glass ka grain pattern alag hai, toh pata chalta hai ki handmade hai. COD tha toh tension nahi thi. Packaging bhi dam se ki thi, ek bhi glass nahi toota. Recommend karunga sabko!' },
            ].map(({ color, name, loc, ago, stars, text }) => (
              <div className="review-card" key={name}>
                <div className="review-stars">{stars}</div>
                <p className="review-text">&ldquo;{text}&rdquo;</p>
                <div className="review-author">
                  <div className="review-avatar-img" style={{ background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>{name[0]}</div>
                  <div>
                    <div className="review-name">{name}</div>
                    <div className="review-meta">{loc} · {ago}</div>
                    <div className="review-verified">✅ Verified Purchase</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FAQ
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="faq">
        <div className="container">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-sub">Everything you need to know before ordering</p>
          <div className="divider" />
          <div className="faq-wrap">
            {FAQS.map((item, i) => (
              <div key={i} className={`faq-item${openFaq === i ? ' open' : ''}`}>
                <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {item.q}
                </button>
                <div className="faq-answer">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FINAL CTA
          ══════════════════════════════════════════ */}
      <section style={{ background: 'linear-gradient(135deg,#5C3D1E,#3D2610)', padding: '60px 20px', textAlign: 'center' }} id="final-cta">
        <div className="container">
          <h2 style={{ color: '#fff', marginBottom: 10 }}>Your Daily Wellness Ritual Starts Today</h2>
          <p style={{ color: 'rgba(255,255,255,.82)', marginBottom: 30 }}>Natural Vijaysar wood infused water. Simple routine. Ayurvedic tradition. Starting at just ₹499.</p>
          <button className="btn btn-gold btn-lg" onClick={() => scrollToCheckout()}>🛒 Order Now — Free Delivery</button>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.76rem', marginTop: 18 }}>✅ Free delivery &nbsp;·&nbsp; ✅ 7-day replacement &nbsp;·&nbsp; ✅ Razorpay + COD &nbsp;·&nbsp; ✅ Made in India</p>
        </div>
      </section>

      {/* ── DISCLAIMER FOOTER ── */}
      <div style={{ background: '#FFF8E1', borderTop: '2px solid #FFD54F', padding: '20px' }}>
        <div className="container">
          <p style={{ fontSize: '.76rem', color: '#6D4C00', textAlign: 'center', lineHeight: 1.7 }}>
            <strong>Disclaimer:</strong> This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease. The Vedayu Vijaysar Wooden Glass is a traditional wellness product used as part of a healthy hydration routine, inspired by Ayurvedic practice. People with diabetes or any medical condition should consult a qualified doctor before making any changes to their routine. Results may vary.
          </p>
        </div>
      </div>

      {/* ── STICKY CTA (mobile) ── */}
      {showSticky && (() => {
        const formReady = !validate();
        return (
          <div className="sticky-cta">
            <div className="sticky-cta-inner">
              <div className="sticky-text">
                {formReady
                  ? <><strong>Ready to order!</strong> {fmt(PACKS[pack].price)} · Free Delivery</>
                  : <><strong>Vijaysar Wooden Glass</strong> From ₹499 · Free Delivery</>
                }
              </div>
              <button
                onClick={formReady ? placeOrder : () => scrollToCheckout()}
                disabled={loading}
                style={{ background: formReady ? '#4A7C59' : 'var(--vd-gold)', color: formReady ? '#fff' : 'var(--vd-dark-brown)', fontWeight: 700, padding: '11px 22px', borderRadius: 6, fontSize: '.88rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .3s' }}
              >
                {loading ? '⏳' : formReady ? '✅ Place Order' : '🛒 Buy Now'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── SITE FOOTER ── */}
      <SiteFooter />

      {/* ── WHATSAPP FLOAT ── */}
      <a className="wa-float" href={`https://wa.me/91${WA_NUM}?text=Hi%20Vedayu%2C%20I%20want%20to%20order%20the%20Vijaysar%20Wooden%20Glass`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* ── TOAST ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.type === 'error' ? '⚠️' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* ── EXIT INTENT POPUP ── */}
      {exitIntent && (
        <div className="exit-overlay" onClick={() => setExitIntent(false)}>
          <div className="exit-modal" onClick={e => e.stopPropagation()}>
            <button className="exit-close" onClick={() => setExitIntent(false)} aria-label="Close">✕</button>
            <div className="exit-badge">Limited Offer 🎁</div>
            <h2 className="exit-title">Wait! Before You Go…</h2>
            <p className="exit-sub">Pay online &amp; get <strong>10% OFF</strong> your order instantly — no coupon needed!</p>
            <div className="exit-discount-box">
              <div className="exit-pack-row">
                {[1,2,5].map(p => (
                  <div key={p} className="exit-pack-item">
                    <span className="exit-pack-name">{PACKS[p].name}</span>
                    <span className="exit-pack-old">{fmt(PACKS[p].price)}</span>
                    <span className="exit-pack-new">{fmt(effectivePrice(p,'prepaid'))}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="btn btn-green btn-full"
              style={{ marginTop: 20, fontSize: '1rem', padding: '14px' }}
              onClick={() => { setExitIntent(false); scrollToCheckout(null, 'prepaid'); }}
            >
              🎉 Claim 10% Off — Pay Online
            </button>
            <button
              className="exit-skip"
              onClick={() => setExitIntent(false)}
            >
              No thanks, I'll pay full price on delivery
            </button>
          </div>
        </div>
      )}
    </>
  );
}
