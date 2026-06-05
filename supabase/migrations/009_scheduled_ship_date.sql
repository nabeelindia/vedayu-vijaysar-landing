-- supabase/migrations/009_scheduled_ship_date.sql
alter table orders add column if not exists scheduled_ship_date date;
create index if not exists orders_scheduled_idx on orders(scheduled_ship_date)
  where scheduled_ship_date is not null;
