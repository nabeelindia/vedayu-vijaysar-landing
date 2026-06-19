// lib/customer-cache.js
import { supabase } from './supabase';

export async function saveCustomer() {
  // no-op: orders table is the source of truth
}

export async function lookupCustomer({ mobile, email }) {
  if (!mobile) return null;

  const SELECT = 'name, email, address, area, landmark, city, state, pincode';

  // Pass 1: exact match on mobile + email (preferred — more specific)
  if (email) {
    const { data, error } = await supabase
      .from('orders')
      .select(SELECT)
      .eq('mobile', mobile.trim())
      .eq('email', email.trim().toLowerCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('Customer lookup Pass 1 error:', error);
    } else if (data) {
      return data;
    }
  }

  // Pass 2: mobile-only (works even when email is not provided)
  const { data, error } = await supabase
    .from('orders')
    .select(SELECT)
    .eq('mobile', mobile.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('Customer lookup Pass 2 error:', error);
  }
  return data || null;
}
