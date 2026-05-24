import { kv } from '@vercel/kv';

export async function saveCustomer({ mobile, email, name, address, city, state, pincode }) {
  if (!mobile) return;
  await kv.set(`customer:${mobile.trim()}`, {
    name, email: email?.trim() || '', address, city, state, pincode,
  });
}

export async function lookupCustomer({ mobile, email }) {
  if (!mobile || !email) return null;
  const record = await kv.get(`customer:${mobile.trim()}`);
  if (!record) return null;
  if (record.email.toLowerCase() !== email.trim().toLowerCase()) return null;
  return record;
}
