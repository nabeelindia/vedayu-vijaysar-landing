alter table orders add column if not exists parent_order_id text references orders(order_id);
create index if not exists orders_parent_order_id_idx on orders(parent_order_id);
