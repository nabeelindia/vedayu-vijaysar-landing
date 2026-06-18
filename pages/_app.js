import Script from 'next/script';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { appWithTranslation } from 'next-i18next';
import '../styles/globals.css';

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;
const GA_ID = 'G-HRCBLBTPM0';
const SUPPORTED_LOCALES = ['en', 'hi', 'ta', 'te'];

function App({ Component, pageProps }) {
  const router = useRouter();

  // Fire GA4 page_view on every client-side route change
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (window.gtag) {
        window.gtag('config', GA_ID, { page_path: url });
      }
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  // Language detection: on first visit, check localStorage then browser language
  useEffect(() => {
    try {
      // 1. Check stored preference
      const stored = localStorage.getItem('vedayu_lang');
      if (stored && SUPPORTED_LOCALES.includes(stored) && stored !== router.locale) {
        document.cookie = `NEXT_LOCALE=${stored};path=/;max-age=31536000;SameSite=Lax`;
        router.replace(router.asPath, router.asPath, { locale: stored, scroll: false });
        return;
      }
      // 2. Auto-detect from browser on very first visit (no stored pref, currently on default 'en')
      if (!stored && router.locale === 'en') {
        const browserLang = navigator.language?.split('-')[0];
        if (browserLang && SUPPORTED_LOCALES.includes(browserLang) && browserLang !== 'en') {
          localStorage.setItem('vedayu_lang', browserLang);
          document.cookie = `NEXT_LOCALE=${browserLang};path=/;max-age=31536000;SameSite=Lax`;
          router.replace(router.asPath, router.asPath, { locale: browserLang, scroll: false });
        }
      }
    } catch (_) {}
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track language usage — fires once per locale per session (sessionStorage dedup)
  useEffect(() => {
    try {
      const locale = router.locale || 'en';
      const key = `lang_tracked_${locale}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        fetch('/api/track-lang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        }).catch(() => {});
      }
    } catch (_) {}
  }, [router.locale]);


  return (
    <>
      {/* Meta Pixel — afterInteractive so stub is ready before events fire */}
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: `
          !function(f,b,e,v,n,t,s){
            if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)
          }(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','4274415046037928');
          fbq('track','PageView');
        ` }}
      />

      {/* Google Analytics 4 */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="lazyOnload"
      />
      <Script
        id="ga4-init"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />

      {/* Microsoft Clarity — heatmaps & session recordings */}
      {CLARITY_ID && (
        <Script
          id="ms-clarity"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window,document,"clarity","script","${CLARITY_ID}");
            `,
          }}
        />
      )}

      <Component {...pageProps} />
    </>
  );
}

export default appWithTranslation(App);
