alter table if exists public.brands
  add column if not exists invoice_primary_color text not null default '#ea580c',
  add column if not exists invoice_secondary_color text not null default '#0f172a';

comment on column public.brands.invoice_primary_color is 'Primary invoice accent color as a six-digit hex value.';
comment on column public.brands.invoice_secondary_color is 'Secondary invoice header color as a six-digit hex value.';
