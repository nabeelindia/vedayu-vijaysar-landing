create table if not exists cod_verifications (
  id            bigserial primary key,
  order_id      text not null unique,
  mobile        text not null,
  name          text not null,
  status        text not null default 'pending',
  nudged_at     timestamptz,
  verified_at   timestamptz,
  cancelled_at  timestamptz,
  created_at    timestamptz default now()
);
create index if not exists cod_verif_mobile_idx  on cod_verifications(mobile);
create index if not exists cod_verif_status_idx  on cod_verifications(status);
create index if not exists cod_verif_created_idx on cod_verifications(created_at);
