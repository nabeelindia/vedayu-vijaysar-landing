-- Missing columns on cod_verifications
alter table cod_verifications
  add column if not exists hold_reminded_at  timestamptz,
  add column if not exists address_updated_at timestamptz;

create index if not exists cod_verif_hold_reminded_idx on cod_verifications(hold_reminded_at)
  where hold_reminded_at is null;
