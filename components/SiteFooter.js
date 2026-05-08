import Link from 'next/link';

const YEAR = new Date().getFullYear();

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          {/* Brand */}
          <div className="footer-brand">
            <span className="footer-logo">🪵 Vedayu</span>
            <p className="footer-tagline">Ancient Ayurvedic wisdom in every sip. Crafted from genuine Vijaysar wood.</p>
            <p className="footer-contact-line">
              <a href="mailto:hi@vedayulife.com">hi@vedayulife.com</a>
              &nbsp;·&nbsp;
              <a href="tel:+917070701956">+91 70707 01956</a>
            </p>
          </div>

          {/* Policy Links */}
          <div className="footer-links">
            <h4 className="footer-links-heading">Customer Support</h4>
            <ul>
              <li><Link href="/contact">Contact Us</Link></li>
              <li><Link href="/shipping-policy">Shipping Policy</Link></li>
              <li><Link href="/refund-policy">Refund &amp; Return Policy</Link></li>
              <li><Link href="/terms">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {YEAR} Hashcart eCommerce Pvt. Ltd. All rights reserved. &nbsp;·&nbsp; <a href="https://vedayulife.com">vedayulife.com</a></p>
          <p className="footer-disclaimer">This product is not a medicine and is not intended to diagnose, treat, cure, or prevent any disease. Results may vary.</p>
        </div>
      </div>
    </footer>
  );
}
