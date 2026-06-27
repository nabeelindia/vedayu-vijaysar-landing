-- growth_partners: partner accounts
create table if not exists growth_partners (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  mobile        text        not null unique,
  handle        text        not null unique,  -- URL-safe slug e.g. "DrSalman"
  email         text        not null,         -- used for OTP delivery
  profession    text        not null,         -- 'Doctor' | 'Nutritionist' | 'Yoga Instructor' | 'Influencer' | 'Other'
  city          text        not null,
  bank_name     text        not null,
  bank_account  text        not null,
  bank_ifsc     text        not null,
  kyc_verified  boolean     not null default false,
  kyc_verified_at timestamptz,
  created_at    timestamptz not null default now()
);

-- gp_earnings: ₹100 per referred delivered order
create table if not exists gp_earnings (
  id           uuid        primary key default gen_random_uuid(),
  partner_id   uuid        not null references growth_partners(id),
  order_id     text        not null,
  amount       integer     not null default 100,
  status       text        not null default 'pending',
  -- pending:    order placed, not shipped
  -- in_transit: shipped, locked (visible but not withdrawable)
  -- earned:     delivery confirmed + 7-day window passed, withdrawable
  -- cancelled:  RTO or returned
  created_at   timestamptz not null default now(),
  unlocked_at  timestamptz,  -- when status became 'earned'
  delivered_at timestamptz   -- set by courier webhook on delivery
);

-- gp_withdrawals: partner payout requests
create table if not exists gp_withdrawals (
  id           uuid        primary key default gen_random_uuid(),
  partner_id   uuid        not null references growth_partners(id),
  amount       integer     not null,
  status       text        not null default 'pending',
  -- pending:   requested, admin not yet acted
  -- completed: admin marked transferred
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  admin_note   text
);

-- gp_otp: phone OTP for login/register
create table if not exists gp_otp (
  mobile     text        primary key,
  otp        text        not null,
  expires_at timestamptz not null
);

-- Indexes
create index if not exists growth_partners_mobile_idx  on growth_partners(mobile);
create index if not exists growth_partners_handle_idx  on growth_partners(handle);
create index if not exists gp_earnings_partner_status  on gp_earnings(partner_id, status);
create index if not exists gp_withdrawals_status_idx   on gp_withdrawals(status);
