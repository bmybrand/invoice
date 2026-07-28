create table if not exists public.job_openings (
  slug text primary key,
  title text not null,
  summary text not null,
  description text not null default '',
  responsibilities jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  apply_url text not null default '/contact?interest=careers',
  department text not null check (department in ('Design', 'Technology', 'Growth', 'Operations')),
  location text not null,
  workplace text not null check (workplace in ('Remote', 'Hybrid', 'On-site')),
  employment_type text not null check (employment_type in ('Full-time', 'Part-time', 'Contract', 'Internship')),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_openings add column if not exists description text not null default '';
alter table public.job_openings add column if not exists responsibilities jsonb not null default '[]'::jsonb;
alter table public.job_openings add column if not exists requirements jsonb not null default '[]'::jsonb;
alter table public.job_openings add column if not exists benefits jsonb not null default '[]'::jsonb;
alter table public.job_openings add column if not exists apply_url text not null default '/contact?interest=careers';

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

update public.job_openings
set
  description = case
    when description = '' then summary || E'\n\nYou will join a multidisciplinary team that values clear thinking, useful collaboration, and work that creates a visible result for clients.'
    else description
  end,
  responsibilities = case
    when responsibilities = '[]'::jsonb then jsonb_build_array(
      'Own assigned work from early planning through dependable delivery.',
      'Collaborate closely with strategy, design, growth, and technology teammates.',
      'Communicate progress, risks, and decisions clearly with the wider team.',
      'Improve working practices through feedback, documentation, and shared learning.'
    )
    else responsibilities
  end,
  requirements = case
    when requirements = '[]'::jsonb then jsonb_build_array(
      'Relevant professional experience and strong examples of completed work.',
      'Clear written and verbal communication skills.',
      'The ability to work independently while contributing actively to a team.',
      'Good judgment, attention to detail, and a willingness to keep learning.'
    )
    else requirements
  end,
  benefits = case
    when benefits = '[]'::jsonb then jsonb_build_array(
      'Flexible work arrangements based on the role and team.',
      'Learning, mentoring, and professional development support.',
      'Modern tools and clear systems that reduce unnecessary friction.',
      'Meaningful ownership and direct visibility into the impact of your work.'
    )
    else benefits
  end
where slug in (
  'senior-product-designer',
  'full-stack-developer',
  'growth-marketing-strategist',
  'project-coordinator',
  'motion-ui-designer',
  'quality-assurance-engineer'
);
