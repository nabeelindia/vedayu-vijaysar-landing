alter table orders
  add column if not exists area     text,
  add column if not exists landmark text;
