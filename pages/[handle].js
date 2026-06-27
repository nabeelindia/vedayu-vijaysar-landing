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

  const { data } = await supabase
    .from('growth_partners')
    .select('handle')
    .ilike('handle', handle)
    .single();

  if (!data) return { notFound: true };

  res.setHeader(
    'Set-Cookie',
    `gp_ref=${data.handle}; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax`,
  );

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
