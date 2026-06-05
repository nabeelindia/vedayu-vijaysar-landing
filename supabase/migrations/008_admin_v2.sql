-- supabase/migrations/008_admin_v2.sql

-- Notes on orders (internal, admin-only)
create table if not exists order_notes (
  id         bigserial primary key,
  order_id   text not null,
  note       text not null,
  created_at timestamptz default now()
);
create index if not exists order_notes_order_id_idx on order_notes(order_id);

-- Refund log
create table if not exists refunds (
  id         bigserial primary key,
  order_id   text not null,
  amount     int  not null,
  method     text not null,
  note       text,
  created_at timestamptz default now()
);
create index if not exists refunds_order_id_idx on refunds(order_id);

-- Extra columns on orders
alter table orders
  add column if not exists return_reason  text,
  add column if not exists confirmed_at   timestamptz;
