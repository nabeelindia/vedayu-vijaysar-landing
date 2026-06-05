import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function RefundPolicy() {
  return (
    <>
      <Head>
        <title>Refund &amp; Return Policy — Vedayu</title>
        <meta name="robots" content="noindex,follow" />
        <meta name="description" content="Vedayu's 7-day refund and replacement policy for the Vijaysar Wooden Glass." />
      </Head>

      <header className="policy-header">
        <div className="container">
          <Link href="/" className="policy-back">← Back to Store</Link>
          <h1>Refund &amp; Return Policy</h1>
          <p>Last updated: May 2025</p>
        </div>
      </header>

      <main className="policy-main">
        <div className="container policy-content">

          <div className="policy-highlight">
            <strong>Our Promise:</strong> If your product arrives damaged, defective, or not as described — we will replace it or refund you in full. No questions asked within 7 days of delivery.
          </div>

          <h2>1. Eligibility for Return / Replacement</h2>
          <p>You may request a return or replacement within <strong>7 days of delivery</strong> if:</p>
          <ul>
            <li>The product is damaged or broken on arrival</li>
            <li>The product is defective (e.g., cracks, splits, unusable condition)</li>
            <li>You received the wrong product</li>
          </ul>
          <p>
            Returns are <strong>not accepted</strong> for change of mind once the product is in good condition and matches the description.
            Natural variations in wood grain, colour, and texture are not considered defects.
          </p>

          <h2>2. How to Initiate a Return</h2>
          <ol>
            <li>Contact us within 7 days of delivery at <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a> or WhatsApp <a href="https://wa.me/917070701956">+91 70707 01956</a></li>
            <li>Share your Order ID, a brief description of the issue, and clear photos/video of the product</li>
            <li>We will review your request within 48 hours and arrange pickup or advise next steps</li>
          </ol>

          <h2>3. Refund Process</h2>
          <ul>
            <li><strong>Prepaid orders:</strong> Refund will be credited to your original payment method within <strong>5–7 business days</strong> of return approval</li>
            <li><strong>COD orders:</strong> Refund will be processed via bank transfer (NEFT/UPI) within <strong>5–7 business days</strong> of return approval. You will need to share your bank account details or UPI ID.</li>
            <li>Shipping charges (if any) are non-refundable unless the return is due to our error</li>
          </ul>

          <h2>4. Replacement</h2>
          <p>
            In most cases, we prefer to send a replacement product rather than a refund. A fresh unit will be dispatched within
            <strong> 1–3 business days</strong> of return approval and return pickup (whichever is applicable).
          </p>

          <h2>5. Cancellations</h2>
          <ul>
            <li><strong>Before dispatch:</strong> Orders can be cancelled for a full refund. Contact us immediately at <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a> or call <a href="tel:+917070701956">+91 70707 01956</a>.</li>
            <li><strong>After dispatch:</strong> Orders cannot be cancelled once shipped. Please refuse delivery if you no longer want the order — it will be returned to us automatically.</li>
            <li><strong>COD cancellations:</strong> Repeated COD refusals may result in restrictions on future COD orders.</li>
          </ul>

          <h2>6. Non-Returnable Situations</h2>
          <ul>
            <li>Products returned after 7 days of delivery</li>
            <li>Products damaged due to misuse, improper cleaning, or exposure to harsh chemicals</li>
            <li>Products without original packaging (where required)</li>
            <li>Used products that are not defective</li>
          </ul>

          <h2>7. Contact for Refunds &amp; Returns</h2>
          <p>
            <strong>Hashcart eCommerce Pvt. Ltd.</strong><br />
            Email: <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a><br />
            Phone / WhatsApp: <a href="tel:+917070701956">+91 70707 01956</a><br />
            Response time: Within 48 hours · Resolution within 30 days
          </p>

        </div>
      </main>

      <SiteFooter />
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'en', ['common'])),
    },
  };
}
