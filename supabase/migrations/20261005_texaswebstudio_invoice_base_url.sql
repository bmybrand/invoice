-- Ensure Texas Web Studio uses its Vercel public domain for invoice + brief form copy links.
update public.brands
set invoice_base_url = 'https://texaswebstudio.co'
where regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in (
  'texaswebstudio',
  'texaxwebstudio',
  'texaswebstudios',
  'texaxwebstudios'
)
  and (
    invoice_base_url is null
    or trim(invoice_base_url) = ''
    or invoice_base_url ilike '%texaswebstudio.com%'
  );
