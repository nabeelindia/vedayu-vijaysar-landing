create table if not exists return_requests (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null,
  order_id      text not null,
  customer_name text,
  customer_phone text,
  customer_email text,
  pack          text,
  amount        text,
  issue         text,
  status        text not null default 'pending',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists return_requests_created_at_idx on return_requests (created_at desc);
create index if not exists return_requests_status_idx on return_requests (status);
create index if not exists return_requests_order_id_idx on return_requests (order_id);

create trigger return_requests_updated_at
  before update on return_requests
  for each row execute function update_updated_at_column();
