create table if not exists orders (
  id                  bigserial primary key,
  order_id            text not null unique,
  method              text not null,
  status              text not null default 'pending',
  name                text not null,
  mobile              text not null,
  email               text,
  address             text not null,
  city                text not null,
  state               text not null,
  pincode             text not null,
  pack                text not null,
  qty                 int  not null default 1,
  price               int  not null,
  utm                 jsonb,
  referrer_id         text,
  awb                 text,
  courier             text,
  nimbuspost_order_id text,
  label_url           text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  returned_at         timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index if not exists orders_mobile_idx  on orders(mobile);
create index if not exists orders_status_idx  on orders(status);
create index if not exists orders_method_idx  on orders(method);
create index if not exists orders_created_idx on orders(created_at desc);
create index if not exists orders_awb_idx     on orders(awb);
