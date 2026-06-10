-- supabase/migrations/011_address_changed_archive.sql
alter table orders
  add column if not exists address_changed boolean not null default false,
  add column if not exists archived        boolean not null default false;

create index if not exists orders_archived_idx on orders(archived);
