create table if not exists shipments (
  awb              text primary key,
  status           text,
  rto_status       text,
  rto_awb          text,
  edd              text,
  history          jsonb,
  last_synced_at   timestamptz,
  last_updated_at  timestamptz,
  raw_event        jsonb
);
