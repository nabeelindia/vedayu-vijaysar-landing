import Head from 'next/head';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import SiteFooter from '../components/SiteFooter';
import ChatWidget from '../components/ChatWidget';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { hi as hiLocale, ta as taLocale, te as teLocale } from 'date-fns/locale';
import { getHolidayDates } from '../lib/holidays';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

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
function getDeliveryEst(pincode, locale) {
  const p = parseInt((pincode || '').slice(0, 3), 10);
  const isMetro = [110,111,400,401,402,560,561,600,601,700,500,380,411,122,302,226,208].some(m => p === m);
  const [lo, hi] = isMetro ? [3, 5] : [5, 8];
  const addDays = (n) => {
    const d = new Date();
    let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) added++; }
    return d;
  };
  const dtLocale = locale === 'hi' ? 'hi-IN' : locale === 'ta' ? 'ta-IN' : locale === 'te' ? 'te-IN' : 'en-IN';
  const fmt2 = d => d.toLocaleDateString(dtLocale, { weekday:'short', day:'numeric', month:'short' });
  return `${fmt2(addDays(lo))} – ${fmt2(addDays(hi))}`;
}

/* ─── Ships-by helper ──────────────────────────────────────────
 * Computes the expected dispatch date based on IST time.
 * Cut-off: 6:00 PM IST every day except Sunday (off day).
 *
 * Returns one of:
 *   { label: 'Today',        note: '2 hrs 30 min left to order' }
 *   { label: 'Today',        note: 'Order by 6:00 PM IST'       }  ← < 60 min left
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

function getShipsBy(dtLocale) {
  const now = new Date();
  // Convert to IST by adding UTC+5:30 offset
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);

  const dayOfWeek    = ist.getUTCDay();   // 0 = Sunday
  const hour         = ist.getUTCHours();
  const minute       = ist.getUTCMinutes();
  const isSunday     = dayOfWeek === 0;
  const beforeCutoff = hour < 17;         // before 5:00 PM IST

  if (!isSunday && beforeCutoff) {
    const totalMinsLeft = (17 * 60) - (hour * 60 + minute);
    const h = Math.floor(totalMinsLeft / 60);
    const m = totalMinsLeft % 60;
    const note = h > 0
      ? `order within ${h} hr${h > 1 ? 's' : ''} ${m} min`
      : `order within ${totalMinsLeft} min`;
    return { label: 'Today', note, minsLeft: totalMinsLeft };
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
    : next.toLocaleDateString(dtLocale || 'en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  return { label, note: null };
}

/* ─── Product gallery images ────────────────────────────────── */
const GALLERY = [
  { src:'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/product_rsek8j',   alt:'Vedayu Vijaysar Wooden Glass — front view' },
  { src:'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/lifestyle_ehmoyv', alt:'Vijaysar Glass — morning wellness ritual' },
  { src:'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/authentic_k9fg3q', alt:'100% authentic Vijaysar wood — how to identify' },
  { src:'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/specs_slhudw',     alt:'Vijaysar Glass dimensions — 6 inch, 80ml' },
];

/* ─── FAQ data ──────────────────────────────────────────── */

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
  const { t } = useTranslation('common');

  const FAQS = [
    { q: t('faq.q1'),  a: t('faq.a1')  },
    { q: t('faq.q2'),  a: t('faq.a2')  },
    { q: t('faq.q3'),  a: t('faq.a3')  },
    { q: t('faq.q4'),  a: t('faq.a4')  },
    { q: t('faq.q5'),  a: t('faq.a5')  },
    { q: t('faq.q6'),  a: t('faq.a6')  },
    { q: t('faq.q7'),  a: t('faq.a7')  },
    { q: t('faq.q8'),  a: t('faq.a8')  },
    { q: t('faq.q9'),  a: t('faq.a9')  },
    { q: t('faq.q10'), a: t('faq.a10') },
    { q: t('faq.q11'), a: t('faq.a11') },
    { q: t('faq.q12'), a: t('faq.a12') },
    { q: t('faq.q13'), a: t('faq.a13') },
    { q: t('faq.q14'), a: t('faq.a14') },
    { q: t('faq.q15'), a: t('faq.a15') },
    { q: t('faq.q16'), a: t('faq.a16') },
    { q: t('faq.q17'), a: t('faq.a17') },
    { q: t('faq.q18'), a: t('faq.a18') },
    { q: t('faq.q19'), a: t('faq.a19') },
    { q: t('faq.q20'), a: t('faq.a20') },
    { q: t('faq.q21'), a: t('faq.a21') },
    { q: t('faq.q22'), a: t('faq.a22') },
    { q: t('faq.q23'), a: t('faq.a23') },
    { q: t('faq.q24'), a: t('faq.a24') },
    { q: t('faq.q25'), a: t('faq.a25') },
    { q: t('faq.q26'), a: t('faq.a26') },
  ];

  /* form state */
  const [pack,       setPack]       = useState(1);
  const [payment,    setPayment]    = useState('prepaid');
  const [form,       setForm]       = useState({ name:'', mobile:'', email:'', house:'', area:'', landmark:'', pincode:'', city:'', state:'' });
  const [mobSummaryOpen, setMobSummaryOpen] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [openFaq,    setOpenFaq]    = useState(null);
  const [toast,      setToast]      = useState(null);
  const [welcomeBack,    setWelcomeBack]    = useState(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [utm,            setUtm]            = useState({});
  const [showSticky, setShowSticky] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const [exitIntent, setExitIntent] = useState(false);
  const [deliveryEst, setDeliveryEst] = useState('');
  const [shipsBy,     setShipsBy]     = useState(null);
  const [scheduleOpen,    setScheduleOpen]    = useState(false);
  const [scheduledDate,   setScheduledDate]   = useState(null); // Date object | null
  const [touched,     setTouched]     = useState({});
  const [galleryIdx,  setGalleryIdx]  = useState(0);
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referrerId,       setReferrerId]       = useState('');
  const [lightbox,         setLightbox]         = useState(null); // { imgs: [...], idx: 0 }
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const orderPlaced       = useRef(false);
  const pincodeAbort      = useRef(null);
  const swipeX            = useRef(null);
  const schedulePopupRef  = useRef(null);
  const scheduleBtnRef    = useRef(null);
  const [schedulePopupPos, setSchedulePopupPos] = useState({ top: 0, left: 0 });

  /* sticky CTA + header hide-on-scroll-down / show-on-scroll-up */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setShowSticky(y > 500);
      setScrolled(y > 80);
      lastScrollY.current = y;
      setScheduleOpen(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* compute ships-by once on mount (client-only — avoids SSR mismatch) */
  useEffect(() => {
    const raw = getShipsBy(dtLocale);
    if (!raw) return;
    const todayLabel = t('delivery.today') || 'Today';
    const tomorrowLabel = t('delivery.tomorrow') || 'Tomorrow';
    const notePrefix = t('delivery.order_within') || 'order within';
    let label = raw.label;
    if (label === 'Today') label = todayLabel;
    else if (label === 'Tomorrow') label = tomorrowLabel;
    let note = raw.note;
    if (note && note.startsWith('order within')) note = notePrefix + note.slice('order within'.length);
    setShipsBy({ label, note });
  }, []);

  const dayPickerLocale = router.locale === 'hi' ? hiLocale : router.locale === 'ta' ? taLocale : router.locale === 'te' ? teLocale : undefined;

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
        ...f,
        name:    c.name    || f.name,
        mobile:  c.mobile  || f.mobile,
        email:   c.email   || f.email,
        house:   c.house   || f.house,
        area:    c.area    || f.area,
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

  useEffect(() => {
    if (!scheduleOpen) return;
    const handleClickOutside = (e) => {
      if (
        schedulePopupRef.current && !schedulePopupRef.current.contains(e.target) &&
        scheduleBtnRef.current && !scheduleBtnRef.current.contains(e.target)
      ) {
        setScheduleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [scheduleOpen]);

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
    house:   () => form.house.trim().length > 2,
    area:    () => form.area.trim().length > 2,
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
          setDeliveryEst('⚠️ ' + t('delivery.not_available'));
          setPincodeLoading(false);
          return;
        }
      }

      // Real-time delivery estimate from Velocity Rates API
      if (estRes.status === 'fulfilled') {
        const est = await estRes.value.json().catch(() => null);
        if (est?.serviceable && est?.etaFormatted) {
          setDeliveryEst(t('delivery.by_prefix') + ' ' + est.etaFormatted);
        } else if (est?.codAvailable === false) {
          setDeliveryEst('⚠️ ' + t('delivery.cod_not_available'));
        } else {
          setDeliveryEst(getDeliveryEst(val, router.locale));
        }
      } else {
        setDeliveryEst(getDeliveryEst(val, router.locale));
      }
    } catch (_) {
      // AbortError from rapid typing — silently ignored
    }

    setPincodeLoading(false);
  }, []);

  const handleScheduledDate = async (date) => {
    if (!date) {
      setScheduledDate(null);
      // Revert to default ETA
      if (form.pincode?.length === 6) {
        const est = await fetch(`/api/delivery-estimate?pincode=${form.pincode}&cod=1`).then(r => r.json());
        if (est?.serviceable && est?.etaFormatted) setDeliveryEst(t('delivery.by_prefix') + ' ' + est.etaFormatted);
      }
      return;
    }
    setScheduledDate(date);
    const fromDate = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const est = await fetch(`/api/delivery-estimate?pincode=${form.pincode}&cod=1&fromDate=${fromDate}`).then(r => r.json());
    if (est?.serviceable && est?.etaFormatted) setDeliveryEst(`by ${est.etaFormatted}`);
  };

  const dtLocale = router.locale === 'hi' ? 'hi-IN' : router.locale === 'ta' ? 'ta-IN' : router.locale === 'te' ? 'te-IN' : 'en-IN';
  const scheduledDateFormatted = scheduledDate
    ? scheduledDate.toLocaleDateString(dtLocale, { weekday:'short', day:'numeric', month:'short', timeZone:'Asia/Kolkata' })
    : null;

  /* validation */
  const validate = () => {
    if (!form.name.trim())                                        return 'Please enter your full name.';
    if (!/^[6-9][0-9]{9}$/.test(form.mobile.trim()))             return 'Please enter a valid 10-digit mobile number.';
    if (!form.email.trim()) return 'Please enter your email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid email address.';
    if (!form.house.trim())  return 'Please enter your house / flat / building.';
    if (!form.area.trim())   return 'Please enter your area / locality.';
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
    const computedAddress = [form.house, form.area, form.landmark].filter(Boolean).join(', ');
    const orderData = {
      pack:       selectedPack.name,
      price:      finalPrice,
      qty:        selectedPack.qty,
      payment,
      utm,
      referrerId: referrerId || undefined,
      scheduledShipDate: scheduledDate
        ? scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        : null,
      ...form,
      address: computedAddress,
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
        writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, address: computedAddress, pincode: form.pincode, city: form.city, state: form.state });
        try { sessionStorage.setItem('vc_upsell_ctx', JSON.stringify({ mobile: form.mobile, email: form.email || '' })); } catch (_) {}
        router.push(`/order-confirmed?method=cod&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(data.orderId)}${scheduledDate ? `&scheduledShipDate=${scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}` : ''}`);

      } else {
        /* ── Razorpay prepaid flow ── */
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error('Payment gateway failed to load. Please try again.');

        const res  = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount:       finalPrice,
            packName:     selectedPack.name,
            qty:          selectedPack.qty,
            customerName: form.name,
            mobile:       form.mobile,
            email:        form.email || '',
            address:      computedAddress,
            city:         form.city,
            state:        form.state,
            pincode:      form.pincode,
            referrerId:   referrerId || undefined,
          }),
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
          notes:       { address: `${computedAddress}, ${form.city}, ${form.state} - ${form.pincode}` },
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
            writeCustomerCookie({ name: form.name, mobile: form.mobile, email: form.email, address: computedAddress, pincode: form.pincode, city: form.city, state: form.state });
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
                  scheduledShipDate: scheduledDate
                    ? scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
                    : null,
                  ...form,
                }),
              });
              const vData = await vRes.json();
              if (vData.orderId) finalOrderId = vData.orderId;
            } catch (verifyErr) {
              console.error('verify-payment error:', verifyErr);
              // Don't redirect on failure — the order may not be saved.
              // The Razorpay webhook will recover the order server-side.
              // Show an error to the user so they can contact support.
              setLoading(false);
              showToast('Payment received but order confirmation failed. Please WhatsApp us with your payment ID: ' + response.razorpay_payment_id, 'error');
              return;
            }
            try { sessionStorage.setItem('vc_upsell_ctx', JSON.stringify({ mobile: form.mobile, email: form.email || '' })); } catch (_) {}
            router.push(`/order-confirmed?method=prepaid&pack=${encodeURIComponent(selectedPack.name)}&price=${finalPrice}&name=${encodeURIComponent(form.name)}&orderId=${encodeURIComponent(finalOrderId)}${scheduledDate ? `&scheduledShipDate=${scheduledDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}` : ''}`);
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

  useEffect(() => {
    const handler = (e) => scrollToCheckout(e.detail);
    window.addEventListener('vedayu:selectPack', handler);
    return () => window.removeEventListener('vedayu:selectPack', handler);
  }, []);

  /* prepaid is 10% off; referral gives flat ₹50 off the base price */
  const PREPAID_DISC = 0.10;
  const effectivePrice = (packId, method) => {
    const base = Math.max(0, PACKS[packId].price - referralDiscount);
    return method === 'prepaid' ? Math.round(base * (1 - PREPAID_DISC)) : base;
  };
  const discountAmt = (packId) => PACKS[packId].price - effectivePrice(packId, 'prepaid');

  const currentPack  = PACKS[pack];
  const currentPrice = effectivePrice(pack, payment);

  /* ═══════ JSX ═══════ */
  return (
    <>
      <Head>
        {/* ── Title — primary keyword first, commercial intent, price anchor ── */}
        <title>Vijaysar Wooden Glass — Buy Online India | Vedayu | From ₹499</title>

        {/* ── Meta description — keyword-rich, emotional hook, under 155 chars ── */}
        <meta name="description" content="Vijaysar Wooden Glass (Pterocarpus marsupium) — fill overnight, drink infused water each morning. Traditional Ayurvedic blood sugar wellness ritual. From ₹499 · Free delivery · COD available." />

        {/* ── Open Graph — WhatsApp / Facebook / Twitter share preview ── */}
        <meta property="og:type"        content="product" />
        <meta property="og:title"       content="Vijaysar Wooden Glass — Ayurvedic Wellness | Vedayu" />
        <meta property="og:description" content="Vijaysar Wooden Glass (Pterocarpus marsupium) — fill overnight, drink infused water each morning. Ayurvedic blood sugar wellness ritual. From ₹499 · Free delivery · COD available." />
        <meta property="og:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
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
        <meta name="twitter:image"       content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />

        {/* ── Canonical + hreflang ── */}
        <link rel="canonical" href="https://vedayulife.com/" />
        <link rel="alternate" hrefLang="en" href="https://vedayulife.com/" />
        <link rel="alternate" hrefLang="hi" href="https://vedayulife.com/hi/" />
        <link rel="alternate" hrefLang="ta" href="https://vedayulife.com/ta/" />
        <link rel="alternate" hrefLang="te" href="https://vedayulife.com/te/" />
        <link rel="alternate" hrefLang="x-default" href="https://vedayulife.com/" />

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
                'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/product_rsek8j',
                'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/lifestyle_ehmoyv',
                'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/authentic_k9fg3q',
                'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/benefits_fnxzdh',
                'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/how-to-use_lycjln',
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

      {/* ── NAVBAR ── */}
      {(() => {
        const NAV = [
          { label: t('nav.problem'),      href: '#problem' },
          { label: t('nav.solution'),     href: '#solution' },
          { label: t('nav.benefits'),     href: '#benefits',          desktopHide: true },
          { label: t('nav.how_it_works'), href: '#how-it-works' },
          { label: t('nav.videos'),       href: '#video-testimonial', desktopHide: true },
          { label: t('nav.lab'),          href: '#lab-certified' },
          { label: t('nav.specs'),        href: '#product-details',   mobileHide: true },
          { label: t('nav.pricing'),      href: '#pricing' },
          { label: t('nav.reviews'),      href: '#reviews' },
          { label: t('nav.faqs'),         href: '#faq' },
        ];
        const navClick = (e, href) => {
          e.preventDefault();
          setDrawerOpen(false);
          setTimeout(() => {
            document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
          }, drawerOpen ? 320 : 0);
        };
        return (
          <>
            <div className="nav-spacer" aria-hidden="true" />
            <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:200, background:'#fff', boxShadow: scrolled ? '0 4px 20px rgba(92,61,30,.18)' : '0 1px 4px rgba(92,61,30,.08)', transition:'box-shadow .25s' }}>
              {/* Brown trust bar — inside fixed nav, desktop only */}
              <div className="nav-trust-bar">
                <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:0, flexWrap:'nowrap', overflow:'hidden' }}>
                  {[
                    t('nav.trust.delivery'),
                    t('nav.trust.replacement'),
                    t('nav.trust.payment'),
                    t('nav.trust.natural'),
                    t('nav.trust.brand'),
                  ].map((label, i, arr) => (
                    <span key={label} className="trust-item">
                      {label}
                      {i < arr.length - 1 && <span className="trust-sep" aria-hidden="true"> · </span>}
                    </span>
                  ))}
                </div>
              </div>
              {/* Main nav row */}
              <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:46 }}>
                {/* Logo / brand */}
                <a href="#hero" onClick={e => navClick(e, '#hero')} style={{ fontWeight:800, fontSize:'1rem', color:'#5C3D1E', textDecoration:'none', letterSpacing:-.3, flexShrink:0 }}>🌿 Vedayu</a>
                {/* Desktop links */}
                <div style={{ display:'flex', gap:0, alignItems:'center', flexWrap:'nowrap', minWidth:0, overflow:'visible' }} className="nav-desktop">
                  {NAV.filter(n => !n.desktopHide).map(({ label, href }) => (
                    <a key={href} href={href} onClick={e => navClick(e, href)}
                      className="nav-link"
                      style={{ color:'#5C3D1E', textDecoration:'none', borderRadius:6, whiteSpace:'nowrap', transition:'background .15s' }}
                      onMouseEnter={e => e.currentTarget.style.background='#fdf6ec'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >{label}</a>
                  ))}
                  <LanguageSwitcher />
                  <a href="#checkout" onClick={e => navClick(e, '#checkout')}
                    className="nav-cta"
                    style={{ color:'#fff', background:'#5C3D1E', borderRadius:20, textDecoration:'none', whiteSpace:'nowrap', marginLeft:6, flexShrink:0 }}>
                    {t('nav.order_now')}
                  </a>
                </div>
                {/* Hamburger (mobile) */}
                <button onClick={() => setDrawerOpen(o => !o)} aria-label="Menu"
                  style={{ display:'none', background:'none', border:'none', cursor:'pointer', padding:6, color:'#5C3D1E' }}
                  className="nav-hamburger">
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                    {drawerOpen
                      ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                      : <><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></>
                    }
                  </svg>
                </button>
              </div>
            </nav>
            {/* Mobile drawer */}
            <div style={{
              position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:199,
              background:'rgba(0,0,0,.45)',
              opacity: drawerOpen ? 1 : 0,
              pointerEvents: drawerOpen ? 'auto' : 'none',
              transition:'opacity .3s',
            }} onClick={() => setDrawerOpen(false)} aria-hidden />
            <div style={{
              position:'fixed', top:0, right:0, bottom:0, zIndex:300,
              width:270, background:'var(--vd-cream)', boxShadow:'-4px 0 24px rgba(0,0,0,.35)',
              transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
              transition:'transform .3s cubic-bezier(.4,0,.2,1)',
              display:'flex', flexDirection:'column', padding:'60px 24px 32px',
              overflowY:'hidden',
            }}>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu"
                style={{ position:'absolute', top:14, right:16, background:'none', border:'none', cursor:'pointer', color:'var(--vd-brown)', fontSize:'1.5rem', lineHeight:1 }}>✕</button>
              <p style={{ fontSize:'.65rem', fontWeight:800, color:'#aaa', letterSpacing:1.5, textTransform:'uppercase', marginBottom:16 }}>{t('nav.navigate')}</p>
              {NAV.filter(n => !n.mobileHide).map(({ label, href }) => (
                <a key={href} href={href} onClick={e => navClick(e, href)}
                  style={{ fontSize:'.97rem', fontWeight:600, color:'var(--vd-brown)', textDecoration:'none', padding:'11px 0', borderBottom:'1px solid var(--vd-border)', flexShrink:0 }}>
                  {label}
                </a>
              ))}

              <div style={{ padding:'14px 0', borderBottom:'1px solid var(--vd-border)' }}>
                <LanguageSwitcher inline />
              </div>
              <a href="#checkout" onClick={e => navClick(e, '#checkout')}
                style={{ marginTop:24, background:'var(--vd-brown)', color:'#fff', textAlign:'center', padding:'14px', borderRadius:10, fontWeight:800, fontSize:'1rem', textDecoration:'none' }}>
                {t('nav.order_now')} →
              </a>
            </div>
            <style>{`
              /* mobile base */
              .nav-spacer    { height: 46px; }
              .nav-trust-bar { display: none; }
              .nav-desktop   { display: none !important; }
              .nav-hamburger { display: block !important; }

              /* desktop 769px+ — trust bar (30px) + nav row (46px) = 76px */
              @media (min-width: 769px) {
                .nav-spacer { height: 76px; }
                .nav-trust-bar {
                  display: block;
                  background: #5C3D1E;
                  padding: 5px 0;
                  overflow: hidden;
                }
                .trust-item {
                  font-size: .75rem;
                  font-weight: 600;
                  color: rgba(255,255,255,.92);
                  white-space: nowrap;
                  padding: 0 8px;
                }
                .trust-sep { color: rgba(255,255,255,.4); }
                .nav-desktop   { display: flex !important; }
                .nav-hamburger { display: none !important; }
                .nav-link { font-size: .82rem; font-weight: 600; padding: 4px 6px; }
                .nav-cta  { font-size: .82rem; font-weight: 800; padding: 5px 12px; }
              }

              /* mid desktop 769–1050px */
              @media (min-width: 769px) and (max-width: 1050px) {
                .trust-item { font-size: .68rem; padding: 0 5px; }
                .nav-link   { font-size: .75rem; padding: 4px 4px; }
                .nav-cta    { font-size: .75rem; padding: 5px 9px; }
              }

              /* large desktop 1051px+ */
              @media (min-width: 1051px) {
                .trust-item { font-size: .80rem; padding: 0 14px; }
                .nav-link   { font-size: .88rem; padding: 5px 10px; }
                .nav-cta    { font-size: .88rem; padding: 6px 18px; }
              }
            `}</style>
          </>
        );
      })()}

      {/* ── MARQUEE ── */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {(() => {
            const items = [1,2,3,4,5,6,7,8,9].map(n => t(`marquee.${n}`));
            return [...items, ...items].map((item, i) => (
              <span key={i} className="marquee-item">{item}</span>
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
                <span className="badge">🌿 {t('badge.ayurveda')}</span>
                <span className="badge badge-green">🚚 {t('badge.free_delivery')}</span>
                <span className="badge">💳 {t('badge.cod')}</span>
              </div>
              <p className="eyebrow">{t('hero.eyebrow')}</p>
              <h1 onClick={() => scrollToCheckout()} style={{ cursor:'pointer' }} title="Tap to order">
                {utm.source === 'facebook' || utm.source === 'instagram' || utm.medium === 'paid'
                  ? 'Yes, This Is the Vijaysar Glass From the Ad — Here\'s Why 500+ Families Use It Daily'
                  : t('hero.title')}
              </h1>
              <p className="hero-sub" style={{ marginTop: 14 }}>
                {utm.source === 'facebook' || utm.source === 'instagram' || utm.medium === 'paid'
                  ? 'Fill with water overnight, drink first thing each morning. Natural Vijaysar wood — no chemicals, no pills. Just an ancient Indian wellness ritual, delivered to your door.'
                  : t('hero.desc')}
              </p>
              <div className="hero-price">
                <span className="price-main">₹{PACKS[pack].price.toLocaleString('en-IN')}</span>
                <span className="price-original">₹{PACKS[pack].original.toLocaleString('en-IN')}</span>
                <span className="price-save">{t('pack.save_prefix')} ₹{(PACKS[pack].original - PACKS[pack].price).toLocaleString('en-IN')}</span>
              </div>

              {/* Quick pack picker */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, margin:'12px 0' }}>
                {Object.entries(PACKS).map(([k, p]) => (
                  <div
                    key={k}
                    onClick={() => setPack(+k)}
                    className={`pack-option${pack === +k ? ' active' : ''}`}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setPack(+k)}
                  >
                    {+k === 2 && <span className="pack-popular-tag">{t('pack.most_popular_badge')}</span>}
                    {+k === 5 && <span className="pack-popular-tag" style={{ background:'var(--vd-gold)' }}>🏆 {t('pack.best_value')}</span>}
                    {+k === 1 && <span style={{ display:'block', height:18, marginBottom:2 }} />}
                    <span className="pack-name">{+k === 1 ? t('pricing.pack1.title') : +k === 2 ? t('pricing.pack2.title') : t('pricing.pack5.title')}</span>
                    <span className="pack-price">₹{p.price.toLocaleString('en-IN')}</span>
                    <span style={{ fontSize:'.68rem', color:'var(--vd-text-light)', display:'block', marginTop:2 }}>
                      {t(`pack.per_glass_${+k}`)}
                    </span>
                    {+k > 1 && <span style={{ fontSize:'.62rem', background:'var(--vd-off-white)', color:'var(--vd-green)', padding:'1px 5px', borderRadius:8, marginTop:3, display:'inline-block', fontWeight:700 }}>
                      {t('pack.save_prefix')} ₹{(p.original - p.price).toLocaleString('en-IN')}
                    </span>}
                  </div>
                ))}
              </div>

              <div className="hero-cta">
                <button className="btn btn-brown btn-lg" onClick={() => scrollToCheckout()}>{t('hero.cta_order')}</button>
                <a href="#how-it-works" className="btn btn-outline">{t('hero.cta_how')}</a>
              </div>
              <div className="hero-micro">
                <span>{t('hero.micro.razorpay')}</span>
                <span>{t('hero.micro.cod')}</span>
                <span>{t('hero.micro.replacement')}</span>
                <span>{t('hero.micro.made_in_india')}</span>
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
                  onClick={() => setLightbox({ imgs: GALLERY.map(g => g.src), idx: galleryIdx })}
                  style={{ transition:'opacity .25s', display:'block', width:'100%', height:'100%', objectFit:'contain', cursor:'zoom-in' }}
                />
                <span onClick={() => setLightbox({ imgs: GALLERY.map(g => g.src), idx: galleryIdx })} style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.45)', color:'#fff', fontSize:'.65rem', padding:'3px 8px', borderRadius:20, cursor:'zoom-in', zIndex:2 }}>{t('spec.zoom')}</span>
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
                <span className="spec-pill">{t('spec.pill1')}</span>
                <span className="spec-pill">{t('spec.pill2')}</span>
                <span className="spec-pill">{t('spec.pill3')}</span>
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
          <h2 className="section-title">{t('section.problem')}</h2>
          <p className="section-sub">{t('section.problem_sub')}</p>
          <div className="divider" />
          <div className="problem-grid">
            {[
              { icon: '🍬', title: t('problem.p1.title'), body: t('problem.p1.body') },
              { icon: '💧', title: t('problem.p2.title'), body: t('problem.p2.body') },
              { icon: '🌿', title: t('problem.p3.title'), body: t('problem.p3.body') },
              { icon: '👨‍👩‍👧‍👦', title: t('problem.p4.title'), body: t('problem.p4.body') },
              { icon: '⏰', title: t('problem.p5.title'), body: t('problem.p5.body') },
              { icon: '🏺', title: t('problem.p6.title'), body: t('problem.p6.body') },
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
          <p>{t('cta.problem_strip')}</p>
          <button className="btn btn-gold btn-lg" onClick={() => scrollToCheckout()}>{t('hero.cta_order')}</button>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          SOLUTION
          ══════════════════════════════════════════ */}
      <section className="section" id="solution">
        <div className="container">
          <div className="solution-grid">
            <div className="solution-img-wrap">
              <div className="solution-circle" onClick={() => setLightbox({ imgs:['https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/lifestyle_ehmoyv'], idx:0 })} style={{ cursor:'zoom-in', position:'relative' }}>
                <Image
                  src="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/lifestyle_ehmoyv"
                  alt="Vedayu Vijaysar Wooden Glass — Premium Natural Wood"
                  width={400}
                  height={400}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                />
                <span style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,.45)', color:'#fff', fontSize:'.65rem', padding:'3px 8px', borderRadius:20, whiteSpace:'nowrap' }}>{t('spec.zoom')}</span>
              </div>
            </div>
            <div>
              <p className="solution-sub">{t('solution.sub')}</p>
              <h2>{t('solution.heading')}</h2>
              <div className="divider divider-left" style={{ marginTop: 14 }} />
              <p style={{ marginBottom: 20 }}>{t('solution.desc')}</p>
              <ul className="solution-points">
                {[1,2,3,4,5,6].map(n => (
                  <li key={n}><span className="check" /><span>{t(`solution.pt${n}`)}</span></li>
                ))}
              </ul>
              <button className="btn btn-brown" onClick={() => scrollToCheckout()}>{t('solution.cta')}</button>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CELEBRITY ENDORSEMENT
          ══════════════════════════════════════════ */}
      <section className="section" id="celebrity">
        <div className="container">
          <div className="celebrity-label">{t('celebrity.label')}</div>
          <h2 className="section-title">{t('section.celebrity')}</h2>
          <p className="section-sub">{t('section.celebrity_sub')}</p>
          <div className="divider" />
          <div className="celebrity-wrap">
            <div className="celebrity-video-wrap">
              <video
                className="video-player"
                controls
                playsInline
                preload="metadata"
                poster="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/thumb-celebrity_aifzvx"
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
                <span className="video-badge">{t('celebrity.badge.actor')}</span>
                <span className="video-badge">{t('celebrity.badge.verified')}</span>
              </div>
              <a href="#checkout" className="btn btn-brown btn-lg">
                {t('hero.cta_order')}
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
          <h2 className="section-title">{t('section.video_reviews')}</h2>
          <p className="section-sub">{t('section.video_reviews_sub')}</p>
          <div className="divider" />
          <div className="video-duo-wrap">
            <div className="video-duo-item">
              <div className="video-player-wrap">
                <video
                  className="video-player"
                  controls
                  playsInline
                  preload="metadata"
                  poster="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/thumb-testimonial_btk4ko"
                >
                  <source src={process.env.NEXT_PUBLIC_VIDEO_TESTIMONIAL || "/videos/testimonial.mp4"} type="video/mp4" />
                </video>
              </div>
              <div className="video-duo-caption">
                <div className="video-stars">★★★★★</div>
                <p className="video-pull-quote">&ldquo;Maine pehle kai products try kiye — kuch kaam aaya, kuch nahi. Vijaysar glass ne meri subah ki routine change kar di.&rdquo;</p>
                <div className="video-author-line">{t('video.t1.author')}</div>
              </div>
            </div>
            <div className="video-duo-item">
              <div className="video-player-wrap">
                <video
                  className="video-player"
                  controls
                  playsInline
                  preload="metadata"
                  poster="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/thumb-meta-ad_jzvhar"
                >
                  <source src={process.env.NEXT_PUBLIC_VIDEO_METAAD || "/videos/meta-ad.mp4"} type="video/mp4" />
                </video>
              </div>
              <div className="video-duo-caption">
                <div className="video-stars">★★★★★</div>
                <p className="video-pull-quote">&ldquo;Vijaysar wood — 2,000 years of Ayurvedic tradition, one simple morning habit. Pure, natural, and genuinely effective.&rdquo;</p>
                <div className="video-author-line">{t('video.t2.author')}</div>
              </div>
            </div>
          </div>
          <div className="video-section-cta">
            <div className="video-badges">
              <span className="video-badge">{t('video.badge.customers')}</span>
              <span className="video-badge">{t('video.badge.orders')}</span>
              <span className="video-badge">{t('video.badge.india')}</span>
            </div>
            <a href="#checkout" className="btn btn-brown btn-lg" style={{ marginTop: 20, display: 'inline-block' }}>
              {t('hero.cta_order')}
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          BENEFITS
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="benefits">
        <div className="container">
          <h2 className="section-title">{t('section.benefits')}</h2>
          <p className="section-sub">{t('section.benefits_sub')}</p>
          <div className="divider" />
          <div className="benefits-grid">
            {[
              { icon: '🌿', key: 'b1' },
              { icon: '🏺', key: 'b2' },
              { icon: '🪵', key: 'b3' },
              { icon: '💧', key: 'b4' },
              { icon: '🔄', key: 'b5' },
              { icon: '✋', key: 'b6' },
              { icon: '🎁', key: 'b7' },
              { icon: '☀️', key: 'b8' },
            ].map(({ icon, key }) => {
              const title = t(`benefits.${key}.title`);
              const body = t(`benefits.${key}.body`);
              return (
              <div className="benefit-card" key={key}>
                <div className="benefit-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            );})}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════ */}
      <section className="section" id="how-it-works">
        <div className="container">
          <h2 className="section-title">{t('section.how_it_works')}</h2>
          <p className="section-sub">{t('section.how_it_works_sub')}</p>
          <div className="divider" />
          {/* Two-column layout: image left, steps right on desktop */}
          <div className="how-to-grid">

            {/* Left — infographic image */}
            <div className="how-to-img-col">
              <button onClick={() => setLightbox({ imgs:['https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/how-to-use_lycjln'], idx:0 })} style={{ background:'none', border:'none', padding:0, cursor:'zoom-in', width:'100%', position:'relative', display:'block' }}>
                <Image
                  src="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/how-to-use_lycjln"
                  alt="How to use Vijaysar Wooden Glass — 4 steps infographic"
                  width={480}
                  height={480}
                  style={{ width: '100%', maxWidth: 480, height: 'auto', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.12)', display: 'block', margin: '0 auto' }}
                />
                <span style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.45)', color:'#fff', fontSize:'.65rem', padding:'3px 8px', borderRadius:20 }}>{t('spec.zoom')}</span>
              </button>
            </div>

            {/* Right — steps + tips + CTA */}
            <div className="how-to-steps-col">
              <div className="steps-vertical">
                {[
                  { icon: '💧', key: 's1' },
                  { icon: '🌙', key: 's2' },
                  { icon: '☀️', key: 's3' },
                  { icon: '♻️', key: 's4' },
                ].map(({ icon, key }) => {
                  const title = t(`steps.${key}.title`);
                  const body = t(`steps.${key}.body`);
                  return (
                  <div className="step-v" key={title}>
                    <div className="step-v-icon">{icon}</div>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: 'var(--vd-dark-brown)' }}>{title}</h3>
                      <p style={{ margin: 0, fontSize: '.9rem', color: 'var(--vd-text-light)', lineHeight: 1.6 }}>{body}</p>
                    </div>
                  </div>
                );})}
              </div>

              <div className="usage-tips" style={{ marginTop: 24 }}>
                <h3>{t('care.heading')}</h3>
                <ul>
                  <li>{t('care.tip1')}</li>
                  <li>{t('care.tip2')}</li>
                  <li>{t('care.tip3')}</li>
                  <li>{t('care.tip4')}</li>
                </ul>
              </div>

              <button className="btn btn-brown btn-lg" style={{ marginTop: 28, width: '100%' }} onClick={() => scrollToCheckout()}>
                {t('cta.order_starting')}
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
          <h2 className="section-title" style={{ color: '#fff' }}>{t('section.quality')}</h2>
          <p className="section-sub" style={{ color: 'rgba(255,255,255,.72)' }}>{t('section.quality_sub')}</p>
          <div className="divider" />
          <div className="process-grid">
            {[1,2,3,4,5,6].map(n => {
              const title = t(`making.m${n}.title`);
              const body = t(`making.m${n}.body`);
              return (
              <div className="process-item" key={n}>
                <div className="process-num">{n}</div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            );})}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          LAB CERTIFICATE
          ══════════════════════════════════════════ */}
      <section className="section" id="lab-certified">
        <div className="container">
          <p className="eyebrow" style={{ textAlign:'center' }}>{t('section.lab_eyebrow')}</p>
          <h2 className="section-title">{t('section.lab_title')}</h2>
          <p className="section-sub">{t('section.lab_sub')}</p>
          <div className="divider" />
          <div style={{ display:'flex', flexWrap:'wrap', gap:32, alignItems:'center', justifyContent:'center', marginTop:32 }}>
            {/* Certificate thumbnail */}
            <div style={{ flex:'0 0 auto' }}>
              <button
                onClick={() => setLightbox({ imgs:['/lab-cert-1.jpg'], idx:0 })}
                style={{ background:'none', border:'2px solid #e8d5b0', borderRadius:12, padding:0, cursor:'zoom-in', display:'block', boxShadow:'0 4px 24px rgba(92,61,30,.12)', overflow:'hidden', maxWidth:260 }}
                aria-label="View lab certificate"
              >
                <Image
                  src="/lab-cert-1.jpg"
                  alt="Hydel Laboratories test report for Vijaysar Herbal Wood Tumbler"
                  width={800}
                  height={600}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  loading="lazy"
                />
                <div style={{ background:'#5C3D1E', color:'#fff', fontSize:'.78rem', fontWeight:700, padding:'8px 12px', textAlign:'center', letterSpacing:.5 }}>{t('lab.tap_view')}</div>
              </button>
              <a href="/lab-certificate.pdf" download style={{ display:'block', textAlign:'center', marginTop:10, fontSize:'.78rem', color:'var(--vd-brown)', fontWeight:600, textDecoration:'underline' }}>{t('lab.download')}</a>
            </div>
            {/* Key findings */}
            <div style={{ flex:'1 1 280px', maxWidth:480 }}>
              <p style={{ fontSize:'.8rem', fontWeight:700, color:'#888', letterSpacing:1, textTransform:'uppercase', marginBottom:16 }}>Hydel Laboratories (P) Ltd. — Report No. HLPL20-260420-01</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[
                  { icon:'✅', n:1 },
                  { icon:'♻️', n:2 },
                  { icon:'🌿', n:3 },
                  { icon:'🔬', n:4 },
                  { icon:'🪵', n:5 },
                  { icon:'💧', n:6 },
                ].map(({ icon, n }) => {
                  const label = t(`lab.finding${n}.label`);
                  const value = t(`lab.finding${n}.value`);
                  return (
                  <div key={n} style={{ background:'#fdf6ec', border:'1px solid #e8d5b0', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:'1.3rem', marginBottom:4 }}>{icon}</div>
                    <div style={{ fontSize:'.7rem', color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:.5 }}>{label}</div>
                    <div style={{ fontSize:'.92rem', fontWeight:800, color:'#5C3D1E', marginTop:2 }}>{value}</div>
                  </div>
                );})}
              </div>
              <div style={{ marginTop:18, background:'#eaf4ee', border:'1px solid #b2d8be', borderRadius:10, padding:'12px 16px', fontSize:'.82rem', color:'#2d6a4f', lineHeight:1.6 }}>
                <strong>Lab Note:</strong> {t('lab.note')}
              </div>
              <p style={{ fontSize:'.72rem', color:'#aaa', marginTop:10 }}>Tested by Hydel Laboratories (P) Ltd. · ISO:9001:2015 · ISO:14001:2015 · ISO:45001:2018 Certified</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PRODUCT SPECS
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="product-details">
        <div className="container">
          <h2 className="section-title">{t('section.specs_title')}</h2>
          <p className="section-sub">{t('section.specs_sub')}</p>
          <div className="divider" />

          {/* Product infographics */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
            {[
              { src:'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/specs_slhudw',     alt:'Vijaysar Wood Tumbler dimensions — 6.1 inch height, 80ml capacity' },
              { src:'https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/authentic_k9fg3q', alt:'100% Authentic Vijaysar Wood vs Jamun Wood — how to identify' },
            ].map(({ src, alt }, i, arr) => (
              <button key={src} onClick={() => setLightbox({ imgs: arr.map(a => a.src), idx: i })} aria-label={`Zoom: ${alt}`}
                style={{ background:'none', border:'none', padding:0, cursor:'zoom-in', width:'100%', maxWidth:380, position:'relative' }}>
                <Image src={src} alt={alt} width={380} height={380}
                  style={{ width:'100%', height:'auto', borderRadius:12, boxShadow:'0 4px 20px rgba(0,0,0,.10)', display:'block' }} />
                <span style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.45)', color:'#fff', fontSize:'.65rem', padding:'3px 8px', borderRadius:20 }}>{t('spec.zoom')}</span>
              </button>
            ))}
          </div>

          {/* Lightbox */}
          {lightbox && (() => {
            const { imgs, idx } = lightbox;
            const prev = () => setLightbox(l => ({ ...l, idx: Math.max(l.idx - 1, 0) }));
            const next = () => setLightbox(l => ({ ...l, idx: Math.min(l.idx + 1, imgs.length - 1) }));

            // Mutable state stored outside render cycle via closure object
            const t = lightbox._t || (lightbox._t = {
              scale: 1, tx: 0, ty: 0,
              pinchDist: null, pinchScale: 1,
              dragStartX: null, dragStartY: null, dragTx: 0, dragTy: 0,
              swipeStartX: null,
              el: null,
            });

            const applyTransform = () => {
              if (t.el) t.el.style.transform = `translate(${t.tx}px,${t.ty}px) scale(${t.scale})`;
            };

            const resetTransform = () => { t.scale=1; t.tx=0; t.ty=0; applyTransform(); };

            const onTouchStart = e => {
              e.stopPropagation();
              if (e.touches.length === 1) {
                t.dragStartX = e.touches[0].clientX;
                t.dragStartY = e.touches[0].clientY;
                t.dragTx = t.tx; t.dragTy = t.ty;
                t.swipeStartX = t.scale === 1 ? e.touches[0].clientX : null;
                t.pinchDist = null;
              } else if (e.touches.length === 2) {
                t.swipeStartX = null;
                t.dragStartX = null;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                t.pinchDist = Math.hypot(dx, dy);
                t.pinchScale = t.scale;
              }
            };
            const onTouchMove = e => {
              e.preventDefault(); e.stopPropagation();
              if (e.touches.length === 2 && t.pinchDist) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                t.scale = Math.min(Math.max(t.pinchScale * (Math.hypot(dx,dy) / t.pinchDist), 1), 4);
                applyTransform();
              } else if (e.touches.length === 1 && t.dragStartX !== null && t.scale > 1) {
                t.tx = t.dragTx + (e.touches[0].clientX - t.dragStartX);
                t.ty = t.dragTy + (e.touches[0].clientY - t.dragStartY);
                applyTransform();
              }
            };
            const onTouchEnd = e => {
              e.stopPropagation();
              if (e.touches.length === 0) {
                // swipe navigation only when not zoomed
                if (t.swipeStartX !== null && t.scale === 1) {
                  const dx = e.changedTouches[0].clientX - t.swipeStartX;
                  if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
                }
                t.pinchDist = null; t.dragStartX = null; t.swipeStartX = null;
                // snap back if panned too far when zoomed
                if (t.el && t.scale > 1) {
                  const maxTx = (t.el.naturalWidth * t.scale - window.innerWidth) / 2;
                  const maxTy = (t.el.naturalHeight * t.scale - window.innerHeight) / 2;
                  t.tx = Math.min(Math.max(t.tx, -maxTx), maxTx);
                  t.ty = Math.min(Math.max(t.ty, -maxTy), maxTy);
                  applyTransform();
                }
              }
              if (e.touches.length < 2) t.pinchDist = null;
            };

            return (
              <div
                style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.92)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
                onClick={() => setLightbox(null)}
                onKeyDown={e => { if (e.key==='ArrowLeft') { e.stopPropagation(); resetTransform(); prev(); } if (e.key==='ArrowRight') { e.stopPropagation(); resetTransform(); next(); } if (e.key==='Escape') setLightbox(null); }}
                tabIndex={0}
              >
                <img
                  key={imgs[idx]}
                  ref={el => { t.el = el; }}
                  src={imgs[idx]}
                  alt="Zoomed view"
                  onClick={e => e.stopPropagation()}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{ maxWidth:'100%', maxHeight:'90vh', borderRadius:8, boxShadow:'0 8px 40px rgba(0,0,0,.5)', userSelect:'none', touchAction:'none', transformOrigin:'center' }}
                />
                {/* Close */}
                <button onClick={() => setLightbox(null)} style={{ position:'absolute', top:16, right:20, background:'none', border:'none', color:'#fff', fontSize:'2rem', cursor:'pointer', lineHeight:1 }}>✕</button>
                {/* Prev arrow */}
                {idx > 0 && (
                  <button onClick={e => { e.stopPropagation(); prev(); }} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.15)', border:'none', color:'#fff', fontSize:'1.6rem', width:44, height:44, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
                )}
                {/* Next arrow */}
                {idx < imgs.length - 1 && (
                  <button onClick={e => { e.stopPropagation(); next(); }} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,.15)', border:'none', color:'#fff', fontSize:'1.6rem', width:44, height:44, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
                )}
                {/* Dot indicators */}
                {imgs.length > 1 && (
                  <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>
                    {imgs.map((_, i) => (
                      <span key={i} onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: i })); }} style={{ width:8, height:8, borderRadius:'50%', background: i===idx ? '#fff' : 'rgba(255,255,255,.35)', cursor:'pointer', display:'block' }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="specs-table">
            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14].map(n => (
              <div className="spec-row" key={n}>
                <div className="spec-label">{t(`specs.row${n}.label`)}</div>
                <div className="spec-value">{t(`specs.row${n}.value`)}</div>
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
          <h2 className="section-title">{t('section.pricing')}</h2>
          <p className="section-sub">{t('section.pricing_sub')}</p>
          <div className="divider" />
          <div className="pricing-grid">

            {/* Pack of 1 */}
            <div className="pricing-card">
              <h3>{t('pricing.pack1.title')}</h3>
              <span className="pricing-tag">{t('pack.try_it')}</span>
              <div className="pricing-price">₹499</div>
              <div className="pricing-original">₹699</div>
              <div className="pricing-saving">{t('pricing.pack1.save')}</div>
              <ul className="pricing-features">
                {t('pricing.features.p1').split('|').map(f => (
                  <li key={f}><span className="check" />{f}</li>
                ))}
              </ul>
              <button className="btn btn-brown btn-full" onClick={() => scrollToCheckout(1)}>{t('pricing.pack1.cta')}</button>
            </div>

            {/* Pack of 2 — Most Popular */}
            <div className="pricing-card pricing-card-popular">
              <div className="pricing-badge">{t('pack.most_popular_badge')}</div>
              <h3>{t('pricing.pack2.title')}</h3>
              <span className="pricing-tag">{t('pack.couple')}</span>
              <div className="pricing-price">₹899</div>
              <div className="pricing-original">₹1,398</div>
              <div className="pricing-saving">{t('pricing.pack2.save')}</div>
              <ul className="pricing-features">
                {t('pricing.features.p2').split('|').map(f => (
                  <li key={f}><span className="check" />{f}</li>
                ))}
              </ul>
              <button className="btn btn-green btn-full" onClick={() => scrollToCheckout(2)}>{t('pricing.pack2.cta')}</button>
            </div>

            {/* Pack of 5 — Best Value */}
            <div className="pricing-card pricing-card-family">
              <div className="pricing-badge pricing-badge-gold">{t('pricing.pack5.badge')}</div>
              <h3>{t('pricing.pack5.title')}</h3>
              <span className="pricing-tag">{t('pack.family')}</span>
              <div className="pricing-price">₹1,999</div>
              <div className="pricing-original">₹3,495</div>
              <div className="pricing-saving">{t('pricing.pack5.save')}</div>
              <ul className="pricing-features">
                {t('pricing.features.p5').split('|').map(f => (
                  <li key={f}><span className="check" />{f}</li>
                ))}
              </ul>
              <button className="btn btn-gold btn-full" onClick={() => scrollToCheckout(5)}>{t('pricing.pack5.cta')}</button>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CHECKOUT
          ══════════════════════════════════════════ */}
      <section className="section section-alt" id="checkout">
        <div className="container">
          <h2 className="section-title">{t('section.checkout')}</h2>
          <p className="section-sub">{t('section.checkout_sub')}</p>
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

          {/* ── shared pack selector snippet ── */}
          {(() => {
            const PackSelector = () => (
              <div className="pack-selector">
                {[1, 2, 5].map(p => (
                  <div key={p} className={`pack-option${pack === p ? ' active' : ''}`} onClick={() => setPack(p)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPack(p)}>
                    {p === 2 && <span className="pack-popular-tag">{t('pack.most_popular_badge')}</span>}
                    {p === 5 && <span className="pack-popular-tag" style={{background:'var(--vd-gold)'}}>🏆 {t('pack.best_value')}</span>}
                    {p === 1 && <span style={{ display:'block', height:18, marginBottom:2 }} />}
                    <span className="pack-name">{p === 1 ? t('pricing.pack1.title') : p === 2 ? t('pricing.pack2.title') : t('pricing.pack5.title')}</span>
                    <span className="pack-price">{fmt(PACKS[p].price)}</span>
                    <span style={{ fontSize:'.68rem', color:'var(--vd-text-light)', fontWeight:600, display:'block', marginTop:2 }}>{t(`pack.per_glass_${p}`)}</span>
                    {p > 1 && <span style={{ fontSize:'.62rem', background:'var(--vd-off-white)', color:'var(--vd-green)', padding:'1px 5px', borderRadius:8, marginTop:3, display:'inline-block', fontWeight:700 }}>{t('pack.save_prefix')} {fmt(PACKS[p].original - PACKS[p].price)}</span>}
                  </div>
                ))}
              </div>
            );

            const ctaLabel = loading
              ? <><span className="spinner" />{t('checkout.processing')}</>
              : payment === 'prepaid'
                ? <>💳 Pay Now & Save ₹{discountAmt(pack).toLocaleString('en-IN')} →</>
                : <>💵 Place COD Order — ₹{currentPrice.toLocaleString('en-IN')} →</>;

            const DeliveryEstimate = () => (deliveryEst || shipsBy) ? (
              <div style={{ background:'#F0F9F3', border:'1px solid #4A7C59', borderRadius:8, padding:'10px 14px', marginBottom:6, fontSize:'.88rem', color:'#2d6b40' }}>
                {shipsBy && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: deliveryEst ? 5 : 0 }}>
                    📦 <span>{t('delivery.ships_label')} <strong>{scheduledDate ? t('delivery.ships_scheduled', { date: scheduledDateFormatted }) : shipsBy.label}</strong>{!scheduledDate && shipsBy.note && <span style={{ fontWeight:400, color:'#4A7C59', marginLeft:6 }}>· {shipsBy.note}</span>}</span>
                  </div>
                )}
                {deliveryEst && (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    🚚 <span>{t('delivery.eta_label')} <strong>{deliveryEst}</strong></span>
                  </div>
                )}
              </div>
            ) : null;

            const ScheduleLater = () => {
              if (!deliveryEst && !shipsBy) return null;
              const today = new Date(); today.setHours(0,0,0,0);
              const minDate = new Date(today); minDate.setDate(minDate.getDate() + 2);
              const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 14);
              const holidayDates = getHolidayDates();
              return (
                <div style={{ marginBottom:10 }}>
                  <button type="button" ref={scheduleBtnRef}
                    onClick={() => { if (scheduleBtnRef.current) { const r = scheduleBtnRef.current.getBoundingClientRect(); setSchedulePopupPos({ top: r.bottom + 6, left: r.left }); } setScheduleOpen(o => !o); }}
                    style={{ background: scheduledDate ? '#F0F9F3' : 'none', border: scheduledDate ? '1px solid #4A7C59' : 'none', borderRadius:6, color: scheduledDate ? '#2d6b40' : '#4A7C59', fontSize:'.82rem', fontWeight:600, cursor:'pointer', padding: scheduledDate ? '5px 10px' : '2px 0', textDecoration: scheduledDate ? 'none' : 'underline', display:'flex', alignItems:'center', gap:5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {scheduledDate ? scheduledDateFormatted : 'Need delivery later? Schedule here'}
                    {scheduledDate && <span onClick={e => { e.stopPropagation(); setScheduleOpen(false); handleScheduledDate(null); }} style={{ marginLeft:4, color:'#888', fontWeight:400, fontSize:'.78rem' }}>✕</span>}
                  </button>
                  {scheduleOpen && (
                    <div ref={schedulePopupRef} style={(() => { const isMobile = typeof window !== 'undefined' && window.innerWidth < 500; return isMobile ? { position:'fixed', zIndex:9999, left:8, right:8, bottom:80, background:'#fff', border:'1px solid #4A7C59', borderRadius:14, boxShadow:'0 -4px 32px rgba(0,0,0,.18)', padding:'14px 10px 10px', overflowX:'hidden' } : { position:'fixed', zIndex:9999, top:schedulePopupPos.top, left:Math.min(schedulePopupPos.left, typeof window!=='undefined'?window.innerWidth-310:0), background:'#fff', border:'1px solid #4A7C59', borderRadius:10, boxShadow:'0 4px 24px rgba(0,0,0,.18)', padding:'12px 14px 10px', minWidth:280, maxWidth:'calc(100vw - 32px)' }; })()}>
                      <div style={{ fontSize:'.78rem', fontWeight:600, color:'#2d6b40', marginBottom:6 }}>{t('delivery.schedule_choose')}</div>
                      <DayPicker mode="single" selected={scheduledDate} onSelect={(date) => { handleScheduledDate(date); if (date) setScheduleOpen(false); }} startMonth={new Date(minDate.getFullYear(), minDate.getMonth(), 1)} endMonth={new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)} hideNavigation={minDate.getMonth()===maxDate.getMonth()&&minDate.getFullYear()===maxDate.getFullYear()} disabled={[{before:minDate},{after:maxDate},{dayOfWeek:[0]},...holidayDates]} locale={dayPickerLocale} style={{ margin:0, width:'100%' }} />
                      {scheduledDate && <button type="button" onClick={() => { setScheduleOpen(false); handleScheduledDate(null); }} style={{ background:'none', border:'none', color:'#888', fontSize:'.75rem', cursor:'pointer', textDecoration:'underline', padding:'4px 0 2px' }}>{t('delivery.schedule_asap')}</button>}
                    </div>
                  )}
                </div>
              );
            };

            const PaymentSection = () => (
              <>
                <label className="field-label" style={{ marginBottom: 10 }}>{t('checkout.payment_label')}</label>
                <div className="co-pay-options">
                  {/* Prepaid */}
                  <div className={`co-pay-card${payment === 'prepaid' ? ' active' : ''}`} onClick={() => setPayment('prepaid')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPayment('prepaid')}>
                    <div className="co-pay-card-top">
                      <div className="co-pay-radio"><div className="co-pay-radio-dot" /></div>
                      <div className="co-pay-info">
                        <div className="co-pay-name">
                          💳 {t('checkout.prepaid_label')}
                          <span className="co-pay-rec-badge">RECOMMENDED</span>
                          <span className="co-pay-off-badge">🎉 10% OFF</span>
                        </div>
                        <div className="co-pay-sub">UPI · Cards · Netbanking · Wallets</div>
                      </div>
                    </div>
                    <div className="co-pay-logos">
                      <span title="UPI" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', height:24, padding:'0 6px', border:'1.5px solid #097939', borderRadius:4, fontSize:'.72rem', fontWeight:800, color:'#097939', letterSpacing:'.5px', lineHeight:1 }}>UPI</span>
                      <svg title="Paytm" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{width:'auto'}}><path fill="#00BAF2" d="M15.85 8.167a.204.204 0 0 0-.04.004c-.68.19-.543 1.148-1.781 1.23h-.12a.23.23 0 0 0-.052.005h-.001a.24.24 0 0 0-.184.235v1.09c0 .134.106.241.237.241h.645v4.623c0 .132.104.238.233.238h1.058a.236.236 0 0 0 .233-.238v-4.623h.6c.13 0 .236-.107.236-.241v-1.09a.239.239 0 0 0-.236-.24h-.612V8.386a.218.218 0 0 0-.216-.22zm4.225 1.17c-.398 0-.762.15-1.042.395v-.124a.238.238 0 0 0-.234-.224h-1.07a.24.24 0 0 0-.236.242v5.92a.24.24 0 0 0 .236.242h1.07c.12 0 .217-.091.233-.209v-4.25a.393.393 0 0 1 .371-.408h.196a.41.41 0 0 1 .226.09.405.405 0 0 1 .145.319v4.074l.004.155a.24.24 0 0 0 .237.241h1.07a.239.239 0 0 0 .235-.23l-.001-4.246c0-.14.062-.266.174-.34a.419.419 0 0 1 .196-.068h.198c.23.02.37.2.37.408.005 1.396.004 2.8.004 4.224a.24.24 0 0 0 .237.241h1.07c.13 0 .236-.108.236-.241v-4.543c0-.31-.034-.442-.08-.577a1.601 1.601 0 0 0-1.51-1.09h-.015a1.58 1.58 0 0 0-1.152.5c-.291-.308-.7-.5-1.153-.5zM.232 9.4A.234.234 0 0 0 0 9.636v5.924c0 .132.096.238.216.241h1.09c.13 0 .237-.107.237-.24l.004-1.658H2.57c.857 0 1.453-.605 1.453-1.481v-1.538c0-.877-.596-1.484-1.453-1.484H.232zm9.032 0a.239.239 0 0 0-.237.241v2.47c0 .94.657 1.608 1.579 1.608h.675s.016 0 .037.004a.253.253 0 0 1 .222.253c0 .13-.096.235-.219.251l-.018.004-.303.006H9.739a.239.239 0 0 0-.236.24v1.09a.24.24 0 0 0 .236.242h1.75c.92 0 1.577-.669 1.577-1.608v-4.56a.239.239 0 0 0-.236-.24h-1.07a.239.239 0 0 0-.236.24c-.005.787 0 1.525 0 2.255a.253.253 0 0 1-.25.25h-.449a.253.253 0 0 1-.25-.255c.005-.754-.005-1.5-.005-2.25a.239.239 0 0 0-.236-.24zm-4.004.006a.232.232 0 0 0-.238.226v1.023c0 .132.113.24.252.24h1.413c.112.017.2.1.213.23v.14c-.013.124-.1.214-.207.224h-.7c-.93 0-1.594.63-1.594 1.515v1.269c0 .88.57 1.506 1.495 1.506h1.94c.348 0 .63-.27.63-.6v-4.136c0-1.004-.508-1.637-1.72-1.637zm-3.713 1.572h.678c.139 0 .25.115.25.256v.836a.253.253 0 0 1-.25.256h-.1c-.192.002-.386 0-.578 0zm4.67 1.977h.445c.139 0 .252.108.252.24v.932a.23.23 0 0 1-.014.076.25.25 0 0 1-.238.164h-.445a.247.247 0 0 1-.252-.24v-.933c0-.132.113-.239.252-.239Z"/></svg>
                      <svg title="PhonePe" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{width:'auto'}}><path fill="#5f259f" d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243 1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433zm-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z"/></svg>
                      <span title="RuPay" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', height:24, padding:'0 6px', background:'#E31837', borderRadius:4, fontSize:'.68rem', fontWeight:800, color:'#fff', letterSpacing:'.3px', lineHeight:1 }}>RuPay</span>
                      <svg title="Mastercard" height="24" viewBox="0 0 38 24" xmlns="http://www.w3.org/2000/svg" style={{width:'auto',borderRadius:3,border:'1px solid #ddd'}}><rect width="38" height="24" rx="3" fill="#fff"/><circle cx="15" cy="12" r="7" fill="#EB001B"/><circle cx="23" cy="12" r="7" fill="#F79E1B"/><path d="M19 6.8a7 7 0 0 1 0 10.4A7 7 0 0 1 19 6.8z" fill="#FF5F00"/></svg>
                      <svg title="Visa" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{width:'auto'}}><path fill="#1A1F71" d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"/></svg>
                    </div>
                  </div>
                  {/* COD */}
                  <div className={`co-pay-card${payment === 'cod' ? ' active' : ''}`} onClick={() => setPayment('cod')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPayment('cod')}>
                    <div className="co-pay-card-top">
                      <div className="co-pay-radio"><div className="co-pay-radio-dot" /></div>
                      <div className="co-pay-info">
                        <div className="co-pay-name">💵 {t('checkout.cod_label')}</div>
                        <div style={{ fontSize:'.72rem', color:'#4A7C59', fontWeight:600, marginTop:4 }}>✓ {t('checkout.no_cod_fee')}</div>
                        <div style={{ fontSize:'.68rem', color:'var(--vd-text-light)', marginTop:3 }}>No harassment · Easy returns</div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );

            const ContactBelow = () => (
              <div className="checkout-contact-below">
                <span>📞 <a href="tel:+917070701956">+91 7070701956</a></span>
                <span style={{ color:'#ccc' }}>|</span>
                <span>✉️ <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a></span>
              </div>
            );

            return (
              <div className="checkout-wrap-new">

                {/* Full-width gradient header */}
                <div className="checkout-head-full">
                  <h3>{t('checkout.heading_order')}</h3>
                  <p>{t('checkout.secure')}</p>
                </div>

                <div className="checkout-cols">
                {/* ── LEFT: Delivery Form ── */}
                <div className="checkout-form-col">
                  <div className="checkout-body">

                    {/* Mobile-only: collapsible order summary */}
                    <div className="mob-order-summary">
                      <div className="mob-order-summary-toggle" onClick={() => setMobSummaryOpen(o => !o)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setMobSummaryOpen(o => !o)}>
                        <span className="mot-left">{t('checkout.order_summary_toggle')}</span>
                        <span className="mot-right">
                          {fmt(currentPrice)}
                          <span className={`mot-chevron${mobSummaryOpen ? ' open' : ''}`}>▼</span>
                        </span>
                      </div>
                      {mobSummaryOpen && (
                        <div className="mob-order-summary-body">
                          <div className="checkout-order-panel">
                            <div className="op-product">
                              <img src="https://res.cloudinary.com/ddmmfkvwb/image/upload/w_80,h_80,c_fill,q_auto,f_auto/product_rsek8j" alt="Vijaysar Wooden Glass" className="op-img" />
                              <div style={{ flex:1, minWidth:0 }}>
                                <div className="op-name">{t('checkout.item_glass')} × {currentPack.qty}</div>
                                <div className="op-variant">{currentPack.label}</div>
                              </div>
                              <div className="op-price">{fmt(currentPack.price)}</div>
                            </div>
                            <div className="op-rows">
                              {payment === 'prepaid' && <div className="op-row discount"><span>{t('checkout.prepaid_discount_label')}</span><span>− {fmt(discountAmt(pack))}</span></div>}
                              <div className="op-row free-ship"><span>{t('checkout.delivery_label')}</span><span style={{fontWeight:600}}>{t('delivery.free')}</span></div>
                              <div className="op-row total"><span>{t('checkout.total_label')}</span><span>{fmt(currentPrice)}</span></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile-only: pack selector */}
                    <div className="mob-pack-selector-wrap">
                      <label className="field-label" style={{ marginBottom: 8 }}>{t('checkout.select_pack')}</label>
                      <PackSelector />
                    </div>

                    {/* Delivery details section heading */}
                    <div className="co-section-head">
                      <span className="csh-icon">📦</span>
                      <div>
                        <h4>Delivery Details</h4>
                        <p>Enter your address for fast, free delivery</p>
                      </div>
                    </div>

                    {/* Welcome back banner */}
                    {welcomeBack && (
                      <div style={{ background: '#F0F9F3', border: '1px solid #4A7C59', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.88rem', color: '#2d6b40', display: 'flex', alignItems: 'center', gap: 8 }}>
                        👋 <span>Welcome back, <strong>{welcomeBack}</strong>! Your delivery details are pre-filled — just place your order.</span>
                      </div>
                    )}

                    {/* Delivery details */}
                    <label className="field-label" style={{ marginBottom: 8 }}>{t('checkout.your_details')}</label>

                    <div className="field-row">
                      <div className="field-group">
                        <label className="field-label" htmlFor="mobile">{t('checkout.mobile_label')}{vIcon('mobile')}</label>
                        <div style={{ display:'flex', alignItems:'stretch' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', padding:'0 10px', background:'#f7f7f7', border:'1.5px solid var(--vd-border)', borderRight:'none', borderRadius:'8px 0 0 8px', fontSize:'.85rem', color:'#555', whiteSpace:'nowrap', fontWeight:600 }}>🇮🇳 +91</span>
                          <input id="mobile" type="tel" placeholder={t('checkout.mobile_placeholder')} maxLength={10} inputMode="numeric" value={form.mobile} onChange={e => { const v = e.target.value.replace(/\D/g,''); setForm(f => ({ ...f, mobile: v })); tryLookup(v, form.email); if (v.length === 10) touch('mobile'); }} onBlur={async () => { touch('mobile'); if (referrerId && /^[6-9]\d{9}$/.test(form.mobile)) { try { const r = await fetch(`/api/referral-validate?mobile=${form.mobile}`); const d = await r.json(); if (!d.valid) { setReferralDiscount(0); setReferrerId(''); showToast('Referral discount is for new customers only.', 'info'); } } catch {} } }} style={{ flex:1, borderRadius:'0 8px 8px 0', ...vStyle('mobile') }} />
                        </div>
                        <div style={{ fontSize:'.72rem', color:'var(--vd-text-light)', marginTop:3 }}>We'll send order updates on this number</div>
                      </div>
                      <div className="field-group">
                        <label className="field-label" htmlFor="name">{t('checkout.name_label')}{vIcon('name')}</label>
                        <input id="name" type="text" placeholder={t('checkout.name_placeholder')} autoComplete="name" value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); if (e.target.value.trim().length >= 2) touch('name'); }} onBlur={() => touch('name')} style={vStyle('name')} />
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="email">{t('checkout.email_label')}{vIcon('email')}</label>
                      <input id="email" type="email" placeholder={t('checkout.email_placeholder')} autoComplete="email" value={form.email} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, email: v })); tryLookup(form.mobile, v); }} onBlur={() => touch('email')} style={vStyle('email')} />
                      <div style={{ fontSize:'.72rem', color:'var(--vd-text-light)', marginTop:3 }}>For order confirmation and updates</div>
                    </div>

                    <div className="field-row">
                      <div className="field-group">
                        <label className="field-label" htmlFor="pincode">
                          {t('checkout.pincode_label')}{vIcon('pincode')}{pincodeLoading && <span style={{ fontWeight:400, color:'#4A7C59', fontSize:'.76rem', marginLeft:6 }}>🔍 {t('checkout.detecting')}</span>}
                        </label>
                        <input id="pincode" type="text" placeholder={t('checkout.pincode_placeholder')} maxLength={6} inputMode="numeric" value={form.pincode} onChange={e => handlePincode(e.target.value.replace(/\D/g,''))} onBlur={() => touch('pincode')} style={vStyle('pincode')} />
                      </div>
                      <div className="field-group">
                        {(form.city || form.state) ? (
                          <>
                            <label className="field-label" style={{ opacity:0 }}>City/State</label>
                            <div style={{ border:'1.5px solid #4A7C59', borderRadius:8, padding:'10px 12px', background:'#f3fbf5', display:'flex', gap:20 }}>
                              {form.city && <div style={{ fontSize:'.82rem' }}><span style={{ fontSize:'.7rem', color:'#888', display:'block' }}>{t('checkout.city_label').replace(' *','')}</span><strong style={{ color:'#2d6b40' }}>{form.city}</strong> <span style={{ color:'#4A7C59', fontSize:'.8rem' }}>✓</span></div>}
                              {form.state && <div style={{ fontSize:'.82rem' }}><span style={{ fontSize:'.7rem', color:'#888', display:'block' }}>{t('checkout.state_label').replace(' *','')}</span><strong style={{ color:'#2d6b40' }}>{form.state}</strong> <span style={{ color:'#4A7C59', fontSize:'.8rem' }}>✓</span></div>}
                            </div>
                            <div style={{ fontSize:'.7rem', color:'#4A7C59', marginTop:3 }}>Auto-filled for accuracy</div>
                          </>
                        ) : (
                          <>
                            <label className="field-label" htmlFor="city">{t('checkout.city_label')}{vIcon('city')}</label>
                            <input id="city" type="text" placeholder={pincodeLoading ? t('checkout.detecting') : t('checkout.city_placeholder')} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} onBlur={() => touch('city')} style={vStyle('city')} />
                          </>
                        )}
                      </div>
                    </div>

                    {/* State hidden input (only when auto-filled, still part of form) */}
                    {(form.city || form.state) && (
                      <input type="hidden" value={form.state} />
                    )}
                    {/* State select shown when not auto-filled */}
                    {!form.state && (
                      <div className="field-group">
                        <label className="field-label" htmlFor="state">{t('checkout.state_label')}{vIcon('state')}</label>
                        <select id="state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} onBlur={() => touch('state')} style={vStyle('state')}>
                          <option value="">{pincodeLoading ? t('checkout.detecting') : t('checkout.state_placeholder')}</option>
                          {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="field-row">
                      <div className="field-group">
                        <label className="field-label" htmlFor="house">{t('checkout.house_label')}{vIcon('house')}</label>
                        <input id="house" type="text" placeholder={t('checkout.house_placeholder')} autoComplete="address-line1" value={form.house} onChange={e => { setForm(f => ({ ...f, house: e.target.value })); if (e.target.value.trim().length >= 3) touch('house'); }} onBlur={() => touch('house')} style={vStyle('house')} />
                      </div>
                      <div className="field-group">
                        <label className="field-label" htmlFor="area">{t('checkout.area_label')}{vIcon('area')}</label>
                        <input id="area" type="text" placeholder={t('checkout.area_placeholder')} autoComplete="address-line2" value={form.area} onChange={e => { setForm(f => ({ ...f, area: e.target.value })); if (e.target.value.trim().length >= 3) touch('area'); }} onBlur={() => touch('area')} style={vStyle('area')} />
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="landmark">{t('checkout.landmark_label')}</label>
                      <input id="landmark" type="text" placeholder={t('checkout.landmark_placeholder')} value={form.landmark} onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))} style={{}} />
                      <div style={{ fontSize:'.72rem', color:'var(--vd-text-light)', marginTop:3 }}>{t('checkout.landmark_helper')}</div>
                    </div>

                    {/* Dynamic delivery info bar — 2 columns */}
                    {(shipsBy || deliveryEst) && (
                      <div className="co-trust-bar co-trust-bar-2col" style={{ marginBottom: 14 }}>
                        {shipsBy && (() => {
                          const urgent = shipsBy.minsLeft != null && shipsBy.minsLeft <= 60;
                          const veryUrgent = shipsBy.minsLeft != null && shipsBy.minsLeft <= 30;
                          return (
                            <div className="co-trust-bar-item" style={urgent ? { background: veryUrgent ? '#fff5f5' : '#fffbf0' } : {}}>
                              <span className="tbi-icon">📦</span>
                              <div>
                                <div className="tbi-head">Ships {scheduledDate ? scheduledDateFormatted : shipsBy.label}</div>
                                {!scheduledDate && shipsBy.note && (
                                  <div className="tbi-sub" style={urgent ? { color: veryUrgent ? '#c53030' : '#b7791f' } : {}}>
                                    {shipsBy.note}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                        {deliveryEst && (
                          <div className="co-trust-bar-item">
                            <span className="tbi-icon">🚚</span>
                            <div>
                              <div className="tbi-head">Estimated Delivery</div>
                              <div className="tbi-sub">{deliveryEst}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <ScheduleLater />

                    <PaymentSection />

                    <button className="btn btn-brown btn-full" style={{ padding: '17px', fontSize: '1.05rem' }} onClick={placeOrder} disabled={loading}>
                      {ctaLabel}
                    </button>
                    <div className="co-trust-badges" style={{ marginTop: 10, marginBottom: 12 }}>
                      <div className="co-trust-badge"><span className="tbd-icon">🛡</span><div><span className="tbd-name">Secure Payment</span><span className="tbd-sub">256-bit SSL</span></div></div>
                      <div className="co-trust-badge"><span className="tbd-icon">🚚</span><div><span className="tbd-name">Free Delivery</span><span className="tbd-sub">Pan-India</span></div></div>
                      <div className="co-trust-badge"><span className="tbd-icon">🔄</span><div><span className="tbd-name">7-Day Replacement</span><span className="tbd-sub">Hassle-free</span></div></div>
                      <div className="co-trust-badge"><span className="tbd-icon">✅</span><div><span className="tbd-name">Quality Checked</span><span className="tbd-sub">Lab verified</span></div></div>
                    </div>
                    <ContactBelow />
                  </div>
                </div>

                {/* ── RIGHT: Sidebar (desktop only) ── */}
                <div className="checkout-sidebar">
                  <div className="checkout-sidebar-inner">
                    <div className="checkout-sidebar-pack-label">{t('checkout.select_pack')}</div>
                    <PackSelector />

                    <div className="checkout-order-panel">
                      <div className="op-product">
                        <img src="https://res.cloudinary.com/ddmmfkvwb/image/upload/w_80,h_80,c_fill,q_auto,f_auto/product_rsek8j" alt="Vijaysar Wooden Glass" className="op-img" />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className="op-name">{t('checkout.item_glass')} × {currentPack.qty}</div>
                          <div className="op-variant">{currentPack.label}</div>
                        </div>
                        <div className="op-price">{fmt(currentPack.price)}</div>
                      </div>
                      <div className="op-rows">
                        <div className="op-row discount" style={payment === 'cod' ? { opacity: .5 } : {}}>
                          <span>{t('checkout.prepaid_discount_label')}</span>
                          <span>{payment === 'prepaid' ? `− ${fmt(discountAmt(pack))}` : '₹0'}</span>
                        </div>
                        <div className="op-row free-ship"><span>{t('checkout.delivery_label')}</span><span style={{fontWeight:600}}>{t('delivery.free')}</span></div>
                        <div className="op-row total"><span>{t('checkout.total_label')}</span><span>{fmt(currentPrice)}</span></div>
                      </div>
                      {payment === 'prepaid' && discountAmt(pack) > 0 && (
                        <div className="checkout-saved-badge">🎉 You saved {fmt(discountAmt(pack))} with online payment</div>
                      )}
                      {payment === 'cod' && (
                        <div className="checkout-saved-badge" style={{ background:'#f7f3ee', color:'var(--vd-text-light)', border:'1px solid #e0d5c5' }}>💳 Switch to online payment to save {fmt(discountAmt(pack))}</div>
                      )}
                    </div>

                    <button className="checkout-sidebar-btn" onClick={placeOrder} disabled={loading}>
                      {loading ? t('checkout.processing') : payment === 'prepaid' ? <>🔒 Pay Now & Save ₹{discountAmt(pack).toLocaleString('en-IN')}</> : <>Place COD Order — ₹{currentPrice.toLocaleString('en-IN')}</>}
                    </button>
                    <p style={{ textAlign:'center', fontSize:'.7rem', color:'var(--vd-text-light)', marginTop:4 }}>🛡 Safe, Secure & Encrypted Payments</p>

                    <div className="checkout-need-help">
                      <div className="nh-icon">📞</div>
                      <div className="nh-text">
                        <div className="nh-heading">{t('checkout.need_help')}</div>
                        <div className="nh-sub">{t('checkout.need_help_sub')}</div>
                        <div className="nh-phone">+91 7070701956</div>
                        <div className="nh-email">hi@vedayulife.com</div>
                        <div className="nh-hours">{t('checkout.need_help_hours')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                </div>{/* end checkout-cols */}
              </div>
            );
          })()}

        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST
          ══════════════════════════════════════════ */}
      <section className="section section-green" id="trust">
        <div className="container">
          <h2 className="section-title" style={{ color: '#fff' }}>{t('section.trust')}</h2>
          <div className="divider" />
          <div className="trust-grid">
            {[
              { icon:'🔒', key:'t1' }, { icon:'💵', key:'t2' }, { icon:'🚚', key:'t3' }, { icon:'↩️', key:'t4' },
              { icon:'📦', key:'t5' }, { icon:'🌿', key:'t6' }, { icon:'💬', key:'t7' }, { icon:'✅', key:'t8' },
            ].map(({ icon, key }) => {
              const title = t(`trust.${key}.title`);
              const body = t(`trust.${key}.body`);
              return (
              <div className="trust-item" key={key}>
                <div className="trust-icon">{icon}</div>
                <h4>{title}</h4>
                <p>{body}</p>
              </div>
            );})}
          </div>
        </div>
      </section>

      {/* CTA strip 2 */}
      <div style={{ background: 'var(--vd-off-white)', padding: '48px 20px', textAlign: 'center', borderTop: '1px solid var(--vd-border)' }}>
        <div className="container">
          <h2 style={{ color: 'var(--vd-dark-brown)', marginBottom: 10 }}>{t('cta2.heading')}</h2>
          <p style={{ color: 'var(--vd-text-light)', marginBottom: 26 }}>{t('cta2.sub')}</p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-brown btn-lg" onClick={() => scrollToCheckout()}>{t('cta.order_starting')}</button>
            <a href="#pricing" className="btn btn-outline">{t('cta.view_packs')}</a>
          </div>
          <p style={{ marginTop: 14, fontSize: '.76rem', color: 'var(--vd-text-light)' }}>{t('cta2.note')}</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          REVIEWS
          ══════════════════════════════════════════ */}
      <section className="section" id="reviews">
        <div className="container">
          <h2 className="section-title">{t('section.reviews')}</h2>
          <p className="section-sub">{t('section.reviews_sub')}</p>
          <div className="divider" />
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--vd-brown)', lineHeight: 1 }}>4.8 / 5</div>
            <div style={{ color: 'var(--vd-gold)', fontSize: '1.4rem', letterSpacing: 4, margin: '5px 0' }}>★★★★★</div>
            <div style={{ fontSize: '.82rem', color: 'var(--vd-text-light)' }}>{t('review.rating_summary')}</div>
          </div>
          <div className="reviews-grid">
            {[
              { avatar:'https://res.cloudinary.com/ddmmfkvwb/image/upload/w_80,h_80,c_fill,g_face,q_auto,f_auto/indian-mature-woman-portrait-s-smiling-isolated-white-background-58884982_qetpyd.webp',     name:'Rama Devi',    loc:'Varanasi, Uttar Pradesh', ago:'2 weeks ago',  stars:'★★★★★', text:'बहुत अच्छा उत्पाद है। मेरे पति पिछले 3 महीनों से रोज़ सुबह इस गिलास का पानी पी रहे हैं। लकड़ी की गुणवत्ता बहुत अच्छी है, असली विजयसर की लकड़ी है। पानी रात भर रखने के बाद हल्का गुलाबी रंग हो जाता है — यह देख कर मन को संतोष होता है। पैकिंग भी बहुत सुरक्षित थी।' },
              { avatar:'https://i.pravatar.cc/80?img=13',  name:'Kumar Raghav', loc:'Patna, Bihar',            ago:'3 weeks ago',  stars:'★★★★★', text:'Bhai, 2 mahine ho gaye use karte hue. Subah uthke seedha yahi paani peeta hoon. Pehle koi routine nahi tha, ab yeh glass yaad dilata hai. Delivery bhi 4 din mein aa gayi — COD mein koi problem nahi hui. Quality ekdum solid hai, koi plastic smell nahi, pure wood.' },
              { avatar:'https://i.pravatar.cc/80?img=44', name:'Priya Sharma',  loc:'Pune, Maharashtra',       ago:'1 month ago',  stars:'★★★★★', text:'Bought this for my father after my aunt recommended it. The wood quality is really premium — you can tell it\'s handcrafted. He uses it every morning now and genuinely enjoys the ritual. Packaging was very safe, no damage at all. Fast delivery to Pune within 3 days!' },
              { avatar:'https://i.pravatar.cc/80?img=32',   name:'Kavita Jha',   loc:'Jaipur, Rajasthan',       ago:'5 weeks ago',  stars:'★★★★★', text:'पहले पानी पीने का कोई नियम नहीं था, बस जब मन करे पी लिया। अब रोज़ रात को गिलास भर देती हूँ और सुबह सबसे पहले यही पानी पीती हूँ। 90 दिन का ritual complete किया — अब दूसरा गिलास मँगवाया है। बहुत सुंदर तोहफ़ा भी है बुज़ुर्गों के लिए।' },
              { avatar:'https://i.pravatar.cc/80?img=52',   name:'Arjun Nair',   loc:'Bangalore, Karnataka',    ago:'6 weeks ago',  stars:'★★★★★', text:'Was skeptical initially but glad I ordered. The glass is beautifully crafted — each piece has a unique grain pattern which shows it\'s genuinely handmade. My mother uses it every single morning without fail. Delivery in 3 days to Bangalore. Totally worth it!' },
              { avatar:'https://i.pravatar.cc/80?img=26',  name:'Pooja Mehta',  loc:'Surat, Gujarat',          ago:'7 weeks ago',  stars:'★★★★☆', text:'Mummy ke liye family pack liya tha — 5 glasses. Sabko bahut pasand aaya. Ek ek glass ka grain pattern alag hai, toh pata chalta hai ki handmade hai. COD tha toh tension nahi thi. Packaging bhi dam se ki thi, ek bhi glass nahi toota. Recommend karunga sabko!' },
            ].map(({ avatar, name, loc, ago, stars, text }) => (
              <div className="review-card" key={name}>
                <div className="review-stars">{stars}</div>
                <p className="review-text">&ldquo;{text}&rdquo;</p>
                <div className="review-author">
                  <img src={avatar} alt={name} className="review-avatar-img" style={{ flexShrink:0, background:'var(--vd-off-white)' }} />
                  <div>
                    <div className="review-name">{name}</div>
                    <div className="review-meta">{loc} · {ago}</div>
                    <div className="review-verified">{t('review.verified')}</div>
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
          <h2 className="section-title">{t('faq.title')}</h2>
          <p className="section-sub">{t('section.faq_sub')}</p>
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
          <h2 style={{ color: '#fff', marginBottom: 10 }}>{t('finalcta.heading')}</h2>
          <p style={{ color: 'rgba(255,255,255,.82)', marginBottom: 30 }}>{t('finalcta.sub')}</p>
          <button className="btn btn-gold btn-lg" onClick={() => scrollToCheckout()}>{t('hero.cta_order')}</button>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.76rem', marginTop: 18 }}>{t('finalcta.note')}</p>
        </div>
      </section>

      {/* ── STICKY CTA (mobile) ── */}
      {showSticky && (() => {
        const formReady = !validate();
        return (
          <div className="sticky-cta">
            <div className="sticky-cta-inner">
              <div className="sticky-text">
                {formReady
                  ? payment === 'prepaid' && discountAmt(pack) > 0
                    ? <><strong>Save {fmt(discountAmt(pack))}</strong> · Pay {fmt(currentPrice)} · Free delivery</>
                    : <><strong>{t('sticky.ready')}</strong> {fmt(currentPrice)} · Free delivery</>
                  : <><strong>{pack === 1 ? t('pack.try_it') : pack === 2 ? t('pack.couple') : t('pack.family')}</strong> {fmt(PACKS[pack].price)} · {t('sticky.free_delivery')}</>
                }
              </div>
              <button
                onClick={formReady ? placeOrder : () => scrollToCheckout()}
                disabled={loading}
                style={{ background: formReady ? '#4A7C59' : 'var(--vd-gold)', color: '#fff', fontWeight: 700, padding: '11px 22px', borderRadius: 6, fontSize: '.88rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background .3s' }}
              >
                {loading ? '⏳' : formReady
                  ? payment === 'prepaid' ? <>💳 Pay & Save ₹{discountAmt(pack).toLocaleString('en-IN')}</>
                  : <>💵 Place COD Order</>
                  : t('sticky.buy_now')}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── GO TO TOP ── */}
      {scrolled && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            zIndex: 190, background: '#5C3D1E', color: '#fff',
            border: 'none', borderRadius: 24, padding: '9px 20px',
            display: 'flex', alignItems: 'center', gap: 7,
            fontSize: '.82rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(92,61,30,.35)',
            transition: 'opacity .2s, transform .2s',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          Top
        </button>
      )}

      {/* ── SITE FOOTER ── */}
      <SiteFooter />

      {/* ── AI CHAT WIDGET ── */}
      <ChatWidget />

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
            <div className="exit-badge">{t('exit.badge')}</div>
            <h2 className="exit-title">{t('exit.title')}</h2>
            <p className="exit-sub" dangerouslySetInnerHTML={{ __html: t('exit.sub') }} />
            <p className="exit-perks">{t('exit.perks')}</p>
            <div className="exit-discount-box">
              <div className="exit-pack-row">
                {[1,2,5].map(p => (
                  <div key={p} className="exit-pack-item">
                    <span className="exit-pack-name">{p === 1 ? t('pricing.pack1.title') : p === 2 ? t('pricing.pack2.title') : t('pricing.pack5.title')}</span>
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
              {t('exit.cta')}
            </button>
            <p className="exit-referral" dangerouslySetInnerHTML={{ __html: t('exit.referral') }} />
            <button
              className="exit-skip"
              onClick={() => setExitIntent(false)}
            >
              {t('exit.decline')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}
