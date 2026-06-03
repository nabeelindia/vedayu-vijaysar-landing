import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <meta name="theme-color" content="#5C3D1E" />
        {/* Facebook domain verification — required for Aggregated Event Measurement */}
        <meta name="facebook-domain-verification" content="d4j20c7xs59qf1fu90vtsvkc1bsv0h" />
        {/* Meta Pixel stub — fires synchronously so fbq() calls never drop */}
        <script dangerouslySetInnerHTML={{ __html: `
          !function(f){if(f.fbq)return;var n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];}(window);
          fbq('init','4274415046037928');
        `}} />
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Vedayu" />
        <meta property="og:image" content="/images/og-image.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
