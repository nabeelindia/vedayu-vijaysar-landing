-- Stores human-sent outbound WhatsApp messages
create table if not exists wa_outbound (
  id          bigserial primary key,
  to_phone    text not null,
  message     text not null,
  sent_at     timestamptz default now()
);

create index if not exists wa_outbound_to_phone_idx on wa_outbound(to_phone);
