-- Add razorpay_payment_id for deduplication in webhook handler
alter table orders add column if not exists razorpay_payment_id text;
create unique index if not exists orders_razorpay_payment_id_idx on orders(razorpay_payment_id) where razorpay_payment_id is not null;

-- Insert the missed prepaid order from 2026-06-17 (pay_T2hD9qLRJpimNZ)
-- Razorpay shows: Captured ₹449, customer Sanjeev Kumar, Motihari Bihar 845401
insert into orders (
  order_id, method, status, name, mobile, email,
  address, city, state, pincode, pack, qty, price,
  razorpay_payment_id, created_at
) values (
  'VED-P260617R1',
  'prepaid',
  'confirmed',
  'Sanjeev Kumar',
  '8789378889',
  'tejuskrishna113@gmail.com',
  'Henery bazar Motihari namak dukan Near shyam baba mandir',
  'Motihari',
  'Bihar',
  '845401',
  'Pack of 1',
  1,
  449,
  'pay_T2hD9qLRJpimNZ',
  '2026-06-17 12:19:00+00'  -- 05:49pm IST = 12:19 UTC
) on conflict (order_id) do nothing;
