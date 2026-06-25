begin;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('email', '{"enabled": true}'::jsonb)
on conflict (key) do nothing;

comment on table public.app_settings is
  'Application-wide settings toggles and configuration values.';

commit;
