create table if not exists cart_abandons (
  mobile        text primary key,
  name          text,
  pack          text,
  email         text,
  payment       text,
  abandoned_at  timestamptz,
  wa_sent_at    timestamptz,
  recovered     boolean default false,
  recovered_at  timestamptz
);

create index if not exists cart_abandons_abandoned_at_idx on cart_abandons (abandoned_at desc);
create index if not exists cart_abandons_recovered_idx    on cart_abandons (recovered);
