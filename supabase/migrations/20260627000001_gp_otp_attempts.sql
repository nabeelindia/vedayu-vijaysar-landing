alter table gp_otp add column if not exists attempts int not null default 0;
