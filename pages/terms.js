import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms &amp; Conditions — Vedayu</title>
        <meta name="description" content="Terms and Conditions for purchasing from Vedayu — vedayulife.com" />
      </Head>

      <header className="policy-header">
        <div className="container">
          <Link href="/" className="policy-back">← Back to Store</Link>
          <h1>Terms &amp; Conditions</h1>
          <p>Last updated: May 2025</p>
        </div>
      </header>

      <main className="policy-main">
        <div className="container policy-content">

          <p>
            These Terms and Conditions ("Terms") govern your use of <strong>vedayulife.com</strong> and your purchase of products
            from Hashcart eCommerce Pvt. Ltd. ("Vedayu", "we", "us", "our"). By placing an order, you agree to these Terms.
          </p>

          <h2>1. About Us</h2>
          <p>
            Vedayu is a brand operated by <strong>Hashcart eCommerce Pvt. Ltd.</strong>, a company incorporated under the laws of India.
            We sell Ayurvedic wellness products including the Vijaysar Wooden Glass through our website vedayulife.com.
          </p>

          <h2>2. Products</h2>
          <ul>
            <li>All products are genuine and sourced from authentic Vijaysar (Pterocarpus marsupium) wood.</li>
            <li>Product images are representative; slight variations in wood grain, colour, and texture are natural and expected.</li>
            <li>The Vijaysar Wooden Glass is a wellness product and is <strong>not a medicine</strong>. It is not intended to diagnose, treat, cure, or prevent any disease.</li>
            <li>Results may vary from person to person. We do not guarantee specific health outcomes.</li>
          </ul>

          <h2>3. Pricing</h2>
          <ul>
            <li>All prices are listed in Indian Rupees (₹) and are inclusive of applicable taxes.</li>
            <li>We offer a 10% discount for prepaid (online) orders. This discount is applied at checkout.</li>
            <li>Prices are subject to change without notice. The price at the time of order confirmation is final.</li>
            <li>Delivery is <strong>FREE</strong> on all orders across India.</li>
          </ul>

          <h2>4. Ordering &amp; Payment</h2>
          <ul>
            <li>Orders can be placed via our website using Cash on Delivery (COD) or online payment (via Razorpay).</li>
            <li>For online payments, we accept credit/debit cards, UPI, net banking, and wallets.</li>
            <li>Payment for COD orders is collected at the time of delivery. Please keep exact change ready.</li>
            <li>An order is confirmed only when you receive a confirmation email or order ID.</li>
            <li>We reserve the right to cancel any order at our discretion, with a full refund where applicable.</li>
          </ul>

          <h2>5. Delivery</h2>
          <p>Please refer to our <Link href="/shipping-policy">Shipping Policy</Link> for full details on delivery timelines, areas, and processes.</p>

          <h2>6. Returns &amp; Refunds</h2>
          <p>Please refer to our <Link href="/refund-policy">Refund &amp; Return Policy</Link> for complete details.</p>

          <h2>7. Intellectual Property</h2>
          <p>
            All content on this website including text, images, logos, and design is the property of Hashcart eCommerce Pvt. Ltd.
            You may not reproduce, distribute, or use any content without our prior written permission.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Vedayu shall not be liable for any indirect, incidental, or consequential damages
            arising from the use of our products or website. Our total liability in any case shall not exceed the amount paid for the specific order.
          </p>

          <h2>9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Updated Terms will be posted on this page.
            Continued use of our website after changes constitutes your acceptance.
          </p>

          <h2>11. Contact</h2>
          <p>
            For any queries related to these Terms:<br />
            <strong>Hashcart eCommerce Pvt. Ltd.</strong><br />
            Email: <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a><br />
            Phone: <a href="tel:+917070701956">+91 70707 01956</a>
          </p>

        </div>
      </main>

      <SiteFooter />
    </>
  );
}
