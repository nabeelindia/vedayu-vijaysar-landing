import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function ShippingPolicy() {
  return (
    <>
      <Head>
        <title>Shipping Policy — Vedayu</title>
        <meta name="description" content="Vedayu's shipping policy — free delivery across India, dispatch timelines, and tracking." />
      </Head>

      <header className="policy-header">
        <div className="container">
          <Link href="/" className="policy-back">← Back to Store</Link>
          <h1>Shipping &amp; Delivery Policy</h1>
          <p>Last updated: May 2025</p>
        </div>
      </header>

      <main className="policy-main">
        <div className="container policy-content">

          <div className="policy-highlight">
            <strong>Free Delivery</strong> on all orders across India — no minimum order value, no hidden charges.
          </div>

          <h2>1. Shipping Coverage</h2>
          <p>
            We currently ship to all serviceable pin codes across India. If your pin code is not serviceable, we will notify you after order placement and issue a full refund.
          </p>

          <h2>2. Dispatch Timeline</h2>
          <ul>
            <li><strong>Prepaid orders:</strong> Dispatched within <strong>1–2 business days</strong> of order confirmation</li>
            <li><strong>COD orders:</strong> Dispatched within <strong>1–3 business days</strong> of order placement</li>
            <li>Business days are Monday to Saturday, excluding public holidays</li>
            <li>Orders placed after 5 PM IST may be processed the next business day</li>
          </ul>

          <h2>3. Delivery Timeline</h2>
          <ul>
            <li><strong>Metro cities</strong> (Delhi, Mumbai, Bangalore, Chennai, Hyderabad, Pune, Kolkata): 2–4 business days after dispatch</li>
            <li><strong>Tier 2 &amp; 3 cities:</strong> 3–6 business days after dispatch</li>
            <li><strong>Remote / rural areas:</strong> 5–9 business days after dispatch</li>
          </ul>
          <p>Delivery timelines are estimates and may vary due to courier delays, weather, or local conditions.</p>

          <h2>4. Shipping Partners</h2>
          <p>
            We ship via reputed courier partners including Delhivery, BlueDart, Ekart, and others depending on your location.
            The courier partner for your order will be assigned at the time of dispatch.
          </p>

          <h2>5. Tracking Your Order</h2>
          <p>
            Once your order is dispatched, you will receive a tracking number via WhatsApp or email (if provided).
            You can track your shipment on the courier partner's website using the tracking number.
            For any tracking queries, contact us at <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a> with your Order ID.
          </p>

          <h2>6. Failed Delivery Attempts</h2>
          <ul>
            <li>Our courier partners will attempt delivery up to <strong>3 times</strong></li>
            <li>Please ensure your mobile number and address are accurate at the time of ordering</li>
            <li>If all delivery attempts fail, the package will be returned to us. You may request re-delivery (re-shipping charges may apply)</li>
            <li>For COD orders, repeated failed deliveries may result in restrictions on future COD orders</li>
          </ul>

          <h2>7. Damaged in Transit</h2>
          <p>
            If your order arrives damaged due to shipping, please take photos/video immediately and contact us within
            <strong> 48 hours of delivery</strong> at <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a>.
            We will arrange a replacement at no cost to you. See our <Link href="/refund-policy">Refund &amp; Return Policy</Link> for full details.
          </p>

          <h2>8. Contact for Shipping Queries</h2>
          <p>
            <strong>Hashcart eCommerce Pvt. Ltd.</strong><br />
            Email: <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a><br />
            Phone / WhatsApp: <a href="tel:+917070701956">+91 70707 01956</a><br />
            Support hours: Mon–Sat, 10 AM – 6 PM IST
          </p>

        </div>
      </main>

      <SiteFooter />
    </>
  );
}
