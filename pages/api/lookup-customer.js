import { lookupCustomer } from '../../lib/customer-cache';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { mobile, email } = req.body;
  if (!mobile || !email) return res.status(400).json({ found: false });

  try {
    const customer = await lookupCustomer({ mobile, email });
    if (!customer) return res.status(200).json({ found: false });
    return res.status(200).json({ found: true, customer });
  } catch (err) {
    console.error('Customer lookup failed:', err);
    return res.status(200).json({ found: false });
  }
}
