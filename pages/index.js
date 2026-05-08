import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

/* ─── pack data ─────────────────────────────────────────── */
const PACKS = {
  1: { qty: 1, price: 499,  original: 699,  label: 'Vijaysar Glass × 1', name: 'Pack of 1',       tag: 'Try It Pack',        saving: 'You save ₹200' },
  2: { qty: 2, price: 899,  original: 1398, label: 'Vijaysar Glass × 2', name: 'Pack of 2',       tag: 'Couple Pack',        saving: 'You save ₹499 — ₹449.50 per glass' },
  5: { qty: 5, price: 1999, original: 3495, label: 'Vijaysar Glass × 5', name: 'Pack of 5',       tag: 'Family Pack',        saving: 'You save ₹1,496 — ₹399.80 per glass!' },
};
const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

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
];

/* ─── Indian states ─────────────────────────────────────── */
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu & Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

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
  const [pack,    setPack]    = useState(2);
  const [payment, setPayment] = useState('prepaid');
  const [form,    setForm]    = useState({ name:'', mobile:'', address:'', pincode:'', city:'', state:'' });
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [toast,   setToast]   = useState(null);
  const [showSticky, setShowSticky] = useState(false);
  const pinTimer = useRef(null);

  /* sticky CTA on scroll */
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* show toast */
  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /* pincode auto-fill */
  const handlePincode = (val) => {
    setForm(f => ({ ...f, pincode: val, city: '', state: '' }));
    clearTimeout(pinTimer.current);
    if (!/^[1-9][0-9]{5}$/.test(val)) return;
    pinTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://api.postalpincode.in/pincode/${val}`);
        const data = await res.json();
        if (data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
          const po = data[0].PostOffice[0];
          setForm(f => ({
            ...f,
            city:  f.city  || po.District || po.Name || '',
            state: f.state || (STATES.find(s => s.toLowerCase() === (po.State||'').toLowerCase()) || ''),
          }));
        }
      } catch (_) {}
    }, 600);
  };

  /* validation */
  const validate = () => {
    if (!form.name.trim())                          return 'Please enter your full name.';
    if (!/^[6-9][0-9]{9}$/.test(form.mobile.trim())) return 'Please enter a valid 10-digit mobile number.';
    if (!form.address.trim())                       return 'Please enter your delivery address.';
    if (!/^[1-9][0-9]{5}$/.test(form.pincode))     return 'Please enter a valid 6-digit pincode.';
    if (!form.city.trim())                          return 'Please enter your city.';
    if (!form.state)                                return 'Please select your state.';
    return null;
  };

  /* ── place order ── */
  const placeOrder = async () => {
    const err = validate();
    if (err) { showToast(err); return; }
    setLoading(true);

    const selectedPack = PACKS[pack];
    const orderData = {
      pack:    selectedPack.name,
      price:   selectedPack.price,
      qty:     selectedPack.qty,
      payment,
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
        router.push(`/order-confirmed?method=cod&pack=${encodeURIComponent(selectedPack.name)}&price=${selectedPack.price}&name=${encodeURIComponent(form.name)}`);

      } else {
        /* ── Razorpay prepaid flow ── */
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error('Payment gateway failed to load. Please try again.');

        const res  = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: selectedPack.price, packName: selectedPack.name }),
        });
        const { order_id, amount } = await res.json();
        if (!res.ok) throw new Error('Could not create payment order. Please try again.');

        const rzp = new window.Razorpay({
          key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount,
          currency:    'INR',
          order_id,
          name:        'Vedayu',
          description: `Vijaysar Wooden Glass — ${selectedPack.name}`,
          image:       '/images/logo.png',
          prefill:     { name: form.name, contact: `+91${form.mobile}` },
          notes:       { address: `${form.address}, ${form.city}, ${form.state} - ${form.pincode}` },
          theme:       { color: '#5C3D1E' },
          modal:       { ondismiss: () => setLoading(false) },
          handler: () => {
            router.push(`/order-confirmed?method=prepaid&pack=${encodeURIComponent(selectedPack.name)}&price=${selectedPack.price}&name=${encodeURIComponent(form.name)}`);
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

  const scrollToCheckout = (packId) => {
    if (packId) setPack(packId);
    document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentPack = PACKS[pack];
  const WA_NUM = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '9999999999';

  /* ═══════ JSX ═══════ */
  return (
    <>
      <Head>
        <title>Vedayu Vijaysar Wooden Glass — Natural Ayurvedic Wellness Tumbler | Free Delivery India</title>
        <meta name="description" content="Order Vedayu Vijaysar Wooden Glass online. Natural Ayurvedic wellness tumbler inspired by Indian tradition. Free delivery all over India. COD available. Starting ₹499. 7-day replacement." />
        <meta name="keywords" content="Vijaysar wooden glass, Vijaysar tumbler, Ayurvedic wooden glass, herbal wooden tumbler, natural wellness glass India, Vijaysar wood infused water, Vedayu" />
        <meta property="og:title" content="Vedayu Vijaysar Wooden Glass — Natural Ayurvedic Wellness Tumbler" />
        <meta property="og:description" content="Natural Vijaysar wood tumbler for daily wellness. Free delivery all over India. COD available. Starting ₹499." />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || ''}/`} />

        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Organization',
              name: 'Vedayu',
              url: process.env.NEXT_PUBLIC_SITE_URL,
              description: 'Indian wellness brand offering natural Ayurvedic wellness products.',
            },
            {
              '@type': 'Product',
              name: 'Vedayu Vijaysar Wooden Herbal Glass / Tumbler',
              description: 'Natural wooden tumbler made from Vijaysar wood for daily wellness ritual inspired by Ayurveda.',
              brand: { '@type': 'Brand', name: 'Vedayu' },
              offers: [
                { '@type': 'Offer', name: 'Pack of 1', price: '499', priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
                { '@type': 'Offer', name: 'Pack of 2', price: '899', priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
                { '@type': 'Offer', name: 'Pack of 5', price: '1999', priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
              ],
              aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '200' },
            },
            {
              '@type': 'FAQPage',
              mainEntity: FAQS.map(f => ({
                '@type': 'Question', name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
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
          {['Natural Vijaysar Wood','Free Delivery All Over India','Inspired by Traditional Ayurveda','COD Available','7-Day Replacement Guarantee','Premium Handcrafted Finish','Sugar-Conscious Wellness Ritual','Gift for Parents & Family'].flatMap((t,i) => [
            <span key={`a${i}`} className="marquee-item">{t}</span>,
            <span key={`b${i}`} className="marquee-item">{t}</span>,
          ])}
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
              <h1>Start Your Daily Sugar&#8209;Conscious Wellness Routine with Natural Vijaysar Wood Infused Water</h1>
              <p className="hero-sub" style={{ marginTop: 14 }}>The traditional Vijaysar wooden tumbler — a simple, natural daily hydration ritual inspired by thousands of years of Ayurvedic wisdom. Just fill, wait, and drink.</p>
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
              <img
                src="/images/product.jpg"
                alt="Vedayu Vijaysar Wooden Herbal Glass — with box and herbal tea"
                className="hero-product-img"
                width={480}
                height={480}
                style={{ width: '100%', height: 'auto', borderRadius: 16, objectFit: 'cover', display: 'block' }}
              />
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
                <img
                  src="/images/lifestyle.jpg"
                  alt="Vedayu Vijaysar Wooden Glass — Premium Natural Wood"
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
                  'Fill with room temperature water overnight — let the natural wood do its work while you sleep',
                  'Drink your first glass of Vijaysar wood infused water every morning',
                  'Support your sugar-conscious lifestyle with a purposeful natural hydration ritual',
                  '100% natural, reusable, eco-friendly — no chemicals, no artificial ingredients',
                  'Inspired by Ayurveda — a tradition trusted for thousands of years in India',
                  'A deeply meaningful gift for parents, family, and wellness-conscious loved ones',
                ].map(pt => (
                  <li key={pt}><span className="check" /><span>{pt}</span></li>
                ))}
              </ul>
              <button className="btn btn-brown" onClick={() => scrollToCheckout()}>Get Yours — ₹499 Only →</button>
            </div>
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
          <div className="steps">
            {[
              { icon: '💧', title: 'Step 1 — Fill',            body: 'Fill the tumbler with normal room temperature drinking water. Do not use hot water.' },
              { icon: '🌙', title: 'Step 2 — Rest',            body: 'Cover and keep overnight or 6–8 hours. Let the Vijaysar wood naturally infuse into the water.' },
              { icon: '☀️', title: 'Step 3 — Drink',           body: 'First thing in the morning, drink the Vijaysar wood infused water — ideally on an empty stomach.' },
              { icon: '♻️', title: 'Step 4 — Rinse & Repeat',  body: 'Rinse gently with plain water. Dry thoroughly. Refill tonight. Build your daily ritual.' },
            ].map(({ icon, title, body }) => (
              <div className="step" key={title}>
                <div className="step-num">{icon}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          {/* How-to-use infographic */}
          <div style={{ textAlign: 'center', margin: '32px 0 8px' }}>
            <img
              src="/images/how-to-use.jpg"
              alt="How to use Vijaysar Wooden Glass — 4 steps infographic"
              style={{ maxWidth: '100%', width: 560, height: 'auto', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}
            />
          </div>

          <div className="usage-tips">
            <h3>📋 Important Care &amp; Usage Tips</h3>
            <ul>
              <li>Use only <strong>room temperature water</strong> — never hot water</li>
              <li>Wash with plain water only — <strong>no soap or chemicals</strong></li>
              <li><strong>Dry completely</strong> after each use to prevent moisture buildup</li>
              <li>Store in a dry, well-ventilated place</li>
              <li>Natural wood colour, grain, and texture will vary — each piece is unique</li>
              <li>Slight natural colour leaching into water is normal and completely safe</li>
              <li>Do not soak for more than 8–10 hours</li>
            </ul>
          </div>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <button className="btn btn-brown btn-lg" onClick={() => scrollToCheckout()}>🛒 Order Now — Starting ₹499</button>
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
            <img
              src="/images/specs.jpg"
              alt="Vijaysar Wood Tumbler dimensions — 6.1 inch height, 80ml capacity"
              style={{ width: '100%', maxWidth: 380, height: 'auto', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,.10)' }}
            />
            <img
              src="/images/authentic.jpg"
              alt="100% Authentic Vijaysar Wood vs Jamun Wood — how to identify"
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
                    {p === 2 && <span className="pack-popular-tag">⭐ Popular</span>}
                    <span className="pack-name">{PACKS[p].name}</span>
                    <span className="pack-price">{fmt(PACKS[p].price)}</span>
                  </div>
                ))}
              </div>

              {/* Order summary */}
              <div className="order-summary">
                <div className="order-row"><span>{currentPack.label}</span><span>{fmt(currentPack.price)}</span></div>
                <div className={`order-row order-row-free`}><span>🚚 Delivery</span><span>FREE</span></div>
                <div className={`order-row order-row-total`}><span>Total</span><span>{fmt(currentPack.price)}</span></div>
              </div>

              {/* Customer details */}
              <label className="field-label" style={{ marginBottom: 8 }}>Your Delivery Details:</label>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label" htmlFor="name">Full Name *</label>
                  <input id="name" type="text" placeholder="Your full name" autoComplete="name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="mobile">Mobile Number *</label>
                  <input id="mobile" type="tel" placeholder="10-digit number" maxLength={10} inputMode="numeric" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g,'') }))} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="address">Full Delivery Address *</label>
                <textarea id="address" rows={2} placeholder="House no., Street, Area, Landmark" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>

              <div className="field-row">
                <div className="field-group">
                  <label className="field-label" htmlFor="pincode">Pincode *</label>
                  <input id="pincode" type="text" placeholder="6-digit pincode" maxLength={6} inputMode="numeric" value={form.pincode} onChange={e => handlePincode(e.target.value.replace(/\D/g,''))} />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="city">City *</label>
                  <input id="city" type="text" placeholder="City / Town" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="state">State *</label>
                <select id="state" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">Select State</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Payment */}
              <label className="field-label" style={{ marginBottom: 8 }}>Payment Method:</label>
              <div className="payment-grid">
                <div className={`payment-option${payment === 'prepaid' ? ' active' : ''}`} onClick={() => setPayment('prepaid')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setPayment('prepaid')}>
                  <span className="payment-icon">💳</span>
                  <span className="payment-label">Pay Online</span>
                  <span className="payment-sub">Razorpay · UPI · Cards · Wallets</span>
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
            <div style={{ fontSize: '.82rem', color: 'var(--vd-text-light)' }}>Based on 200+ verified orders across India</div>
          </div>
          <div className="reviews-grid">
            {[
              { init:'P', name:'Priya Sharma',   loc:'Pune, Maharashtra',          ago:'3 weeks ago',  stars:'★★★★★', text:'Bought this for my father after my aunt recommended it. The wood quality is really premium — you can tell it\'s handcrafted. He uses it every morning now and loves the ritual. Packaging was very safe. Fast delivery to Pune within 3 days!' },
              { init:'R', name:'Rajesh Verma',   loc:'Delhi',                      ago:'1 month ago',  stars:'★★★★★', text:'Bought the couple pack for me and my wife. Beautiful wooden finish — looks very premium. We\'ve made it part of our morning routine. Fill at night, drink together every morning. The natural wood fragrance is also very pleasant!' },
              { init:'S', name:'Sunita Patel',   loc:'Ahmedabad, Gujarat',         ago:'2 months ago', stars:'★★★★☆', text:'Gifted the family pack to my in-laws for Diwali. They were very happy — it\'s a meaningful, practical gift. All 5 glasses came well packed with no damage. Follow the care instructions carefully. Overall excellent product!' },
              { init:'A', name:'Arjun Nair',     loc:'Bangalore, Karnataka',       ago:'6 weeks ago',  stars:'★★★★★', text:'I was a bit skeptical at first but decided to try. The Vijaysar glass is beautifully made. Each piece has a unique grain pattern. Delivery in 3 days to Bangalore. My mother loves it and uses it every single morning. Worth every rupee!' },
              { init:'M', name:'Meera Krishnan', loc:'Chennai, Tamil Nadu',        ago:'5 weeks ago',  stars:'★★★★★', text:'Good quality wooden glass. COD option was very convenient. The tumbler is sturdy and the natural finish looks great. I like that it\'s 100% natural with no coating. Already recommended to 3 friends. Very good value, especially the couple pack!' },
              { init:'K', name:'Kavita Singh',   loc:'Lucknow, Uttar Pradesh',     ago:'7 weeks ago',  stars:'★★★★★', text:'Perfect gift idea for parents! Bought the family pack — 5 glasses. Everyone impressed by the packaging and quality. Vijaysar wood is authentic. The natural grain on each glass is slightly different — very premium feel. Highly recommend!' },
            ].map(({ init, name, loc, ago, stars, text }) => (
              <div className="review-card" key={name}>
                <div className="review-stars">{stars}</div>
                <p className="review-text">&ldquo;{text}&rdquo;</p>
                <div className="review-author">
                  <div className="review-avatar">{init}</div>
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
      {showSticky && (
        <div className="sticky-cta">
          <div className="sticky-cta-inner">
            <div className="sticky-text">
              <strong>Vijaysar Wooden Glass</strong>
              Starting ₹499 · Free Delivery
            </div>
            <button onClick={() => scrollToCheckout()} style={{ background: 'var(--vd-gold)', color: 'var(--vd-dark-brown)', fontWeight: 700, padding: '11px 22px', borderRadius: 6, fontSize: '.88rem', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🛒 Buy Now
            </button>
          </div>
        </div>
      )}

      {/* ── WHATSAPP FLOAT ── */}
      <a className="wa-float" href={`https://wa.me/91${WA_NUM}?text=Hi%20Vedayu%2C%20I%20want%20to%20order%20the%20Vijaysar%20Wooden%20Glass`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* ── TOAST ── */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{toast.msg}</span>
        </div>
      )}
    </>
  );
}
