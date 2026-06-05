// lib/customer-cache.js
import { supabase } from './supabase';

export async function saveCustomer() {
  // no-op: orders table is the source of truth
}

export async function lookupCustomer({ mobile, email }) {
  if (!mobile || !email) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('name, email, address, city, state, pincode')
    .eq('mobile', mobile.trim())
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data || null;
}
