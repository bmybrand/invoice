alter table if exists public.brands
  add column if not exists invoice_base_url text;

comment on column public.brands.invoice_base_url is
  'Optional public origin used for invoice share links, for example https://invoice.example.com.';

update public.brands
set invoice_base_url = 'https://dashboard.bmybrand.com'
where invoice_base_url is null
  and regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in ('bmybrand', 'bmy');

update public.brands
set invoice_base_url = 'https://invoice.americanwebexperts.com'
where invoice_base_url is null
  and regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in ('americanwebexperts', 'americanwebexpert');
