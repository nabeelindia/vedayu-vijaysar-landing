import Head from 'next/head';
import Link from 'next/link';
import SiteFooter from '../components/SiteFooter';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';

export default function Contact() {
  const { t } = useTranslation('common');
  return (
    <>
      <Head>
        <title>{t('contact.page_title')}</title>
        <meta name="robots" content="noindex,follow" />
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

      <header className="policy-header">
        <div className="container">
          <Link href="/" className="policy-back">{t('contact.back')}</Link>
          <h1>{t('contact.heading')}</h1>
          <p>{t('contact.subheading')}</p>
        </div>
      </header>

      <main className="policy-main">
        <div className="container policy-content">

          <div className="contact-grid">
            {/* Email */}
            <div className="contact-card">
              <div className="contact-icon">✉️</div>
              <h3>{t('contact.email.heading')}</h3>
              <p>{t('contact.email.desc')}</p>
              <a href="mailto:hi@vedayulife.com" className="contact-link">hi@vedayulife.com</a>
              <p className="contact-note">{t('contact.email.note')}</p>
            </div>

            {/* Phone / WhatsApp */}
            <div className="contact-card">
              <div className="contact-icon">📞</div>
              <h3>{t('contact.phone.heading')}</h3>
              <p>{t('contact.phone.desc')}</p>
              <a href="tel:+917070701956" className="contact-link">+91 70707 01956</a>
              <a href="https://wa.me/917070701956?text=Hi%20Vedayu%2C%20I%20need%20help%20with%20my%20order." className="contact-link contact-wa" target="_blank" rel="noopener noreferrer">
                {t('contact.phone.whatsapp_cta')}
              </a>
              <p className="contact-note">{t('contact.phone.note')}</p>
            </div>
          </div>

          {/* Grievance Officer */}
          <div className="grievance-box">
            <h2>{t('contact.grievance.heading')}</h2>
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
export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}
