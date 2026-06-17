alter table chat_sessions
  add column if not exists csat text,
  add column if not exists escalated boolean default false;
