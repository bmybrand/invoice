create table if not exists public.job_openings (
  slug text primary key,
  title text not null,
  summary text not null,
  department text not null check (department in ('Design', 'Technology', 'Growth', 'Operations')),
  location text not null,
  workplace text not null check (workplace in ('Remote', 'Hybrid', 'On-site')),
  employment_type text not null check (employment_type in ('Full-time', 'Part-time', 'Contract', 'Internship')),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_openings_published_order_idx
  on public.job_openings (is_published, sort_order, created_at desc);

alter table public.job_openings enable row level security;

drop policy if exists "Published jobs are publicly readable" on public.job_openings;
create policy "Published jobs are publicly readable"
  on public.job_openings
  for select
  to anon, authenticated
  using (is_published = true);

grant select on public.job_openings to anon, authenticated;
