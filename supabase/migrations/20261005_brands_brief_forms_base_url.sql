alter table if exists public.brands
  add column if not exists brief_forms_base_url text;

comment on column public.brands.brief_forms_base_url is
  'Public origin for client brief form copy links, e.g. https://bmybrand.com or https://texaswebstudio.co';

update public.brands
set brief_forms_base_url = 'https://bmybrand.com'
where brief_forms_base_url is null
  and regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in ('bmybrand', 'bmy');

update public.brands
set brief_forms_base_url = coalesce(nullif(trim(brand_url), ''), 'https://americanwebexperts.com')
where brief_forms_base_url is null
  and regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in (
    'americanwebexperts',
    'americanwebexpert'
  );

update public.brands
set brief_forms_base_url = coalesce(
  nullif(trim(brand_url), ''),
  'https://texaswebstudio.co'
)
where brief_forms_base_url is null
  and regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in (
    'texaswebstudio',
    'texaxwebstudio',
    'texaswebstudios',
    'texaxwebstudios'
  );
