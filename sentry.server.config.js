import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampler: (samplingContext) => {
    const route = samplingContext.transactionContext?.name ?? '';
    // Trace every payment transaction so failures are always visible
    if (route.includes('verify-payment') || route.includes('submit-cod')) return 1.0;
    return 0.1;
  },
  enabled: process.env.NODE_ENV === 'production',
});
