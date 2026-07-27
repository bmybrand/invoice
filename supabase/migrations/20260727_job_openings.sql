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

insert into public.job_openings (
  slug,
  title,
  summary,
  department,
  location,
  workplace,
  employment_type,
  sort_order,
  is_published
)
values
  (
    'senior-product-designer',
    'Senior Product Designer',
    'Lead thoughtful web and product experiences from early discovery through polished delivery, working closely with strategy, content, and engineering.',
    'Design',
    'Toronto, Canada',
    'Hybrid',
    'Full-time',
    10,
    true
  ),
  (
    'full-stack-developer',
    'Full-Stack Developer',
    'Build responsive digital platforms, reliable integrations, and scalable product features using modern frontend and backend technologies.',
    'Technology',
    'Remote',
    'Remote',
    'Full-time',
    20,
    true
  ),
  (
    'growth-marketing-strategist',
    'Growth Marketing Strategist',
    'Turn customer insight into measurable campaigns across content, paid media, conversion optimization, and lifecycle marketing.',
    'Growth',
    'Remote',
    'Remote',
    'Full-time',
    30,
    true
  ),
  (
    'project-coordinator',
    'Project Coordinator',
    'Keep multidisciplinary client work moving with clear priorities, organized communication, dependable follow-through, and strong attention to detail.',
    'Operations',
    'Allen, Texas',
    'Hybrid',
    'Full-time',
    40,
    true
  ),
  (
    'motion-ui-designer',
    'Motion & UI Designer',
    'Create expressive interface systems, motion concepts, and visual stories that make digital brands feel distinctive and intuitive.',
    'Design',
    'Remote',
    'Remote',
    'Contract',
    50,
    true
  ),
  (
    'quality-assurance-engineer',
    'Quality Assurance Engineer',
    'Protect product quality by designing practical test plans, investigating edge cases, and partnering with developers throughout delivery.',
    'Technology',
    'Toronto, Canada',
    'Hybrid',
    'Full-time',
    60,
    true
  )
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  department = excluded.department,
  location = excluded.location,
  workplace = excluded.workplace,
  employment_type = excluded.employment_type,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published,
  updated_at = now();
