-- Correct Texas Web Studio brief form origin if an earlier seed used .com
update public.brands
set brief_forms_base_url = 'https://texaswebstudio.co'
where regexp_replace(lower(trim(coalesce(brand_name, ''))), '[^a-z0-9]+', '', 'g') in (
  'texaswebstudio',
  'texaxwebstudio',
  'texaswebstudios',
  'texaxwebstudios'
)
  and (
    brief_forms_base_url is null
    or brief_forms_base_url ilike '%texaswebstudio.com%'
    or brief_forms_base_url = ''
  );
