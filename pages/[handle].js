import { supabase } from '../lib/supabase';

const RESERVED = [
  'admin', 'partner', 'track', 'contact', 'order-confirmed',
  'privacy', 'terms', 'shipping-policy', 'refund-policy', 'blog', 'ads', 'insights', 'api',
];

export async function getServerSideProps({ params, res }) {
  const handle = params?.handle;

  if (!handle || RESERVED.includes(handle.toLowerCase())) {
    return { notFound: true };
  }

  if (!handle || !/^[\w-]{1,64}$/.test(handle)) return { notFound: true };

  if (!supabase) return { notFound: true };

  const { data, error } = await supabase
    .from('growth_partners')
    .select('handle')
    .ilike('handle', handle)
    .single();

  if (error) {
    console.error('[handle] supabase lookup error:', error.message);
    return { notFound: true };
  }

  if (!data) return { notFound: true };

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `gp_ref=${data.handle}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );

  // Use 302 (temporary) not 301 — browsers cache 301s and skip re-running this
  // handler, which would prevent the cookie from being refreshed on repeat visits.
  return {
    redirect: {
      destination: `/?gp=${encodeURIComponent(data.handle)}`,
      permanent: false,
    },
  };
}

export default function HandleRedirect() {
  return null;
}
