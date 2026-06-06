import Script from 'next/script';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { appWithTranslation } from 'next-i18next';
import '../styles/globals.css';
import LanguageWelcomeModal from '../components/LanguageWelcomeModal';

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

  // Register service worker + request push permission for admin notifications
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!VAPID_PUBLIC) return;

    navigator.serviceWorker.register('/sw.js').then(async reg => {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const existing = await reg.pushManager.getSubscription();
      const sub = existing || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      await fetch('/api/subscribe-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
    }).catch(console.error);

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const raw = window.atob(base64);
      return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    }
  }, []);

  return (
    <>
      {/* Meta Pixel — deferred so it doesn't block FCP */}
      <Script
        id="fb-pixel"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{ __html: `
          (function(b,e,v,n,t,s){
            t=b.createElement(e);t.async=!0;t.src=v;
            s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
          })(document,'script','https://connect.facebook.net/en_US/fbevents.js');
          if(window.fbq) { fbq('track','PageView'); }
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

      <LanguageWelcomeModal />
      <Component {...pageProps} />
    </>
  );
}

export default appWithTranslation(App);
