// lib/push.js
import webpush from 'web-push';
import { supabase } from './supabase';

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@vedayulife.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function sendPush({ title, body }) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  if (!supabase) return;

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (!subs?.length) return;

  const payload = JSON.stringify({ title, body: body?.slice(0, 120) });

  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ).catch(async err => {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        console.error('Push error:', err.message);
      })
    )
  );
}
