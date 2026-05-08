import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Vedayu</title>
        <meta name="description" content="Privacy Policy for Vedayu — how we collect, use, and protect your data." />
      </Head>

      <header className="policy-header">
        <div className="container">
          <Link href="/" className="policy-back">← Back to Store</Link>
          <h1>Privacy Policy</h1>
          <p>Last updated: May 2025</p>
        </div>
      </header>

      <main className="policy-main">
        <div className="container policy-content">

          <p>
            Hashcart eCommerce Pvt. Ltd. ("Vedayu", "we", "us", or "our") operates the website <strong>vedayulife.com</strong>.
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or place an order.
          </p>

          <h2>1. Information We Collect</h2>
          <p>We collect the following information when you place an order or contact us:</p>
          <ul>
            <li><strong>Personal Identification:</strong> Name, email address, mobile number</li>
            <li><strong>Delivery Information:</strong> Shipping address, city, state, pincode</li>
            <li><strong>Order Information:</strong> Products ordered, payment method chosen, order value</li>
            <li><strong>Device &amp; Usage Data:</strong> IP address, browser type, pages visited, time spent on site (via standard web server logs)</li>
          </ul>
          <p>We do <strong>not</strong> collect or store your payment card details. All payments are processed securely by Razorpay.</p>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To process and fulfill your orders</li>
            <li>To send you order confirmation and shipping updates</li>
            <li>To respond to your queries and provide customer support</li>
            <li>To send you promotional communications (only if you opt in)</li>
            <li>To improve our website and services</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2>3. Sharing of Information</h2>
          <p>We do not sell or rent your personal data. We may share your information with:</p>
          <ul>
            <li><strong>Logistics partners</strong> (courier companies) solely for the purpose of delivering your order</li>
            <li><strong>Payment processors</strong> (Razorpay) to process transactions securely</li>
            <li><strong>Email service providers</strong> (Resend) to deliver transactional emails</li>
            <li><strong>Legal authorities</strong> if required by law or court order</li>
          </ul>

          <h2>4. Data Retention</h2>
          <p>
            We retain your personal data for as long as necessary to fulfill the purposes outlined in this policy, or as required by applicable law.
            Order records are typically retained for 7 years for accounting and legal compliance purposes.
          </p>

          <h2>5. Cookies</h2>
          <p>
            Our website may use essential cookies to ensure the website functions correctly. We do not use third-party advertising or tracking cookies.
            You can disable cookies through your browser settings; however, some features of the site may not function properly.
          </p>

          <h2>6. Security</h2>
          <p>
            We implement industry-standard security measures including SSL/TLS encryption for all data transmitted through our website.
            Payment transactions are processed by Razorpay, which is PCI-DSS compliant.
          </p>

          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data (subject to legal retention requirements)</li>
            <li>Opt out of marketing communications at any time</li>
          </ul>
          <p>To exercise any of these rights, please contact us at <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a>.</p>

          <h2>8. Third-Party Links</h2>
          <p>
            Our website may contain links to external sites. We are not responsible for the privacy practices of those sites
            and encourage you to read their privacy policies.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date.
            Continued use of our website after changes constitutes acceptance of the revised policy.
          </p>

          <h2>10. Contact</h2>
          <p>
            For any privacy-related queries, please contact:<br />
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
