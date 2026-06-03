-- WhatsApp inbox: stores all incoming customer messages
create table if not exists wa_messages (
  id           bigserial primary key,
  wa_id        text not null,           -- WhatsApp message ID (dedup)
  from_phone   text not null,           -- sender e.164 number
  from_name    text,                    -- contact name if provided
  message      text not null,           -- raw message text
  bot_replied  text,                    -- bot reply sent (null = escalated to human)
  read_at      timestamptz,             -- null = unread
  created_at   timestamptz default now()
);

-- unique on wa_id to prevent duplicate webhook deliveries
create unique index if not exists wa_messages_wa_id_idx on wa_messages(wa_id);

-- push notification subscriptions for admin browser notifications
create table if not exists push_subscriptions (
  id         bigserial primary key,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);
