import { Html, Head, Main, NextScript } from 'next/document';

export default function Document(props) {
  const locale = props.__NEXT_DATA__?.locale || 'en';

  return (
    <Html lang={locale}>
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="preconnect" href="https://checkout.razorpay.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {locale === 'hi' && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700&display=swap"
            rel="stylesheet"
          />
        )}
        {locale === 'ta' && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700&display=swap"
            rel="stylesheet"
          />
        )}
        {locale === 'te' && (
          <link
            href="https://fonts.googleapis.com/css2?family=Noto+Sans+Telugu:wght@400;600;700&display=swap"
            rel="stylesheet"
          />
        )}
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
        <meta property="og:locale" content="en_IN" />
        <meta property="og:image" content="https://res.cloudinary.com/ddmmfkvwb/image/upload/q_auto,f_auto/og-image_tswkyu" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
