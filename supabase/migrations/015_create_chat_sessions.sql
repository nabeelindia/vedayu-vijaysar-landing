create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  session_id    text unique not null,
  locale        text not null default 'en',
  messages      jsonb not null default '[]',
  contact_name  text,
  contact_phone text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists chat_sessions_created_at_idx on chat_sessions (created_at desc);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger chat_sessions_updated_at
  before update on chat_sessions
  for each row execute function update_updated_at_column();
