alter table orders
  add column if not exists replacement_for text references orders(order_id) on delete set null,
  add column if not exists created_by text;

comment on column orders.replacement_for is 'order_id of the original order this replaces; null for non-replacements';
comment on column orders.created_by is '"admin" for backend-created orders; null for customer orders';
