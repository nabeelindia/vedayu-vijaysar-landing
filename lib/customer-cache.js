// lib/customer-cache.js
import { supabase } from './supabase';

export async function saveCustomer() {
  // no-op: orders table is the source of truth
}

export async function lookupCustomer({ mobile, email }) {
  if (!mobile) return null;

  // Pass 1: exact match on mobile + email
  if (email) {
    const { data, error } = await supabase
      .from('orders')
      .select('name, email, address, city, state, pincode')
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

  // Pass 2: mobile-only fallback
  const { data, error } = await supabase
    .from('orders')
    .select('name, email, address, city, state, pincode')
    .eq('mobile', mobile.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('Customer lookup Pass 2 error:', error);
  }
  return data || null;
}
