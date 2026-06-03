import { kv } from '@vercel/kv';

const ACTIVE_SET = 'followup:active';

export default async function handler(req, res) {
  const { orderId } = req.query;

  if (!orderId) {
    return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has already been used.'));
  }

  try {
    await kv.srem(ACTIVE_SET, orderId);
    await kv.del(`followup:${orderId}`);
  } catch (err) {
    console.error('Unsubscribe KV error:', err);
    return res.status(500).send(page('Something went wrong', 'Please try again or contact us on WhatsApp.'));
  }

  return res.status(200).send(page(
    "You've been unsubscribed",
    "You won't receive any more follow-up emails from Vedayu for this order. If you have questions, you can always reach us on WhatsApp.",
  ));
}

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title} — Vedayu</title>
  <style>
    body { font-family: sans-serif; background: #FBF7F2; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border: 1px solid #D4B896; border-radius: 12px; padding: 40px 32px; max-width: 420px; text-align: center; }
    h1 { color: #3D2610; font-size: 1.3rem; margin: 0 0 12px; }
    p { color: #5C3D1E; line-height: 1.7; font-size: .92rem; margin: 0 0 24px; }
    a { display: inline-block; background: #5C3D1E; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: .88rem; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:2rem;margin-bottom:16px;">✅</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://vedayulife.com">Back to Vedayu</a>
  </div>
</body>
</html>`;
}
