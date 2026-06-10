alter table shipments
  add column if not exists history        jsonb,
  add column if not exists edd            text,
  add column if not exists rto_status     text,
  add column if not exists rto_awb        text,
  add column if not exists last_synced_at timestamptz;
