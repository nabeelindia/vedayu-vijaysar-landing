import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Disable in development
  enabled: process.env.NODE_ENV === 'production',
  ignoreErrors: [
    // Microsoft Clarity's native WebView bridge calls (smart events / keyboard
    // logging) fail when the site is opened inside an in-app browser
    // (WhatsApp/Instagram/Facebook) whose bridge is partial or torn down
    // mid-session. This is a bug in Clarity's script, not ours.
    /window\.webkit\.messageHandlers/,
    /Java object is gone/,
    /enableDidUserTypeOnKeyboardLogging/,
    /enableButtonsClickedMetaDataLogging/,
  ],
});
