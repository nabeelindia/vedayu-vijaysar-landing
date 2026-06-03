import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact Us — Vedayu</title>
        <meta name="robots" content="noindex,follow" />
        <meta name="description" content="Get in touch with Vedayu for order queries, support, or feedback." />
      </Head>

      <header className="policy-header">
        <div className="container">
          <Link href="/" className="policy-back">← Back to Store</Link>
          <h1>Contact Us</h1>
          <p>We're here to help — reach out via any channel below.</p>
        </div>
      </header>

      <main className="policy-main">
        <div className="container policy-content">

          <div className="contact-grid">
            {/* Email */}
            <div className="contact-card">
              <div className="contact-icon">✉️</div>
              <h3>Email</h3>
              <p>For order queries, returns, or general questions:</p>
              <a href="mailto:hi@vedayulife.com" className="contact-link">hi@vedayulife.com</a>
              <p className="contact-note">We reply within 24–48 business hours.</p>
            </div>

            {/* Phone / WhatsApp */}
            <div className="contact-card">
              <div className="contact-icon">📞</div>
              <h3>Phone &amp; WhatsApp</h3>
              <p>Call or WhatsApp us for quick support:</p>
              <a href="tel:+917070701956" className="contact-link">+91 70707 01956</a>
              <a href="https://wa.me/917070701956?text=Hi%20Vedayu%2C%20I%20need%20help%20with%20my%20order." className="contact-link contact-wa" target="_blank" rel="noopener noreferrer">
                💬 Chat on WhatsApp
              </a>
              <p className="contact-note">Available Mon–Sat, 10 AM – 6 PM IST.</p>
            </div>
          </div>

          {/* Grievance Officer */}
          <div className="grievance-box">
            <h2>Grievance Redressal Officer</h2>
            <p>
              As per the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
              and RBI Payment Aggregator guidelines, you may escalate unresolved complaints to our Grievance Officer:
            </p>
            <table className="grievance-table">
              <tbody>
                <tr><td>Name</td><td>Nabeel Ahmed</td></tr>
                <tr><td>Designation</td><td>Director</td></tr>
                <tr><td>Email</td><td><a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a></td></tr>
                <tr><td>Phone</td><td><a href="tel:+917070701956">+91 70707 01956</a></td></tr>
                <tr><td>Address</td><td>Hashcart eCommerce Pvt. Ltd., India</td></tr>
                <tr><td>Hours</td><td>Mon–Sat, 10 AM – 6 PM IST</td></tr>
                <tr><td>Response Time</td><td>Acknowledgement within 48 hours · Resolution within 30 days</td></tr>
              </tbody>
            </table>
          </div>

        </div>
      </main>

      <SiteFooter />
    </>
  );
}
