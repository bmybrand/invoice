'use client'

import Image from 'next/image'
import Link from 'next/link'

const briefFormOptions = [
  {
    title: 'BOOKKEEPING & TAX FILING',
    description: 'Collect bookkeeping scope, filing frequency, business structure, and compliance deadlines.',
    accent: 'from-orange-500/22 via-amber-500/10 to-transparent',
    tag: 'Finance',
    href: '/dashboard/brief-forms/bookkeeping-tax-filing',
    status: 'Ready',
  },
  {
    title: 'WEBSITE',
    description: 'Capture sitemap needs, conversion goals, content status, integrations, and launch timing.',
    accent: 'from-sky-500/18 via-cyan-500/8 to-transparent',
    tag: 'Digital',
    href: '',
    status: 'Soon',
  },
  {
    title: 'LOGO DESIGN',
    description: 'Gather brand personality, visual references, color direction, and logo usage requirements.',
    accent: 'from-fuchsia-500/18 via-pink-500/8 to-transparent',
    tag: 'Identity',
    href: '',
    status: 'Soon',
  },
  {
    title: 'GRAPHIC DESIGN',
    description: 'Define asset formats, campaign goals, dimensions, target audience, and revision expectations.',
    accent: 'from-violet-500/18 via-indigo-500/8 to-transparent',
    tag: 'Creative',
    href: '',
    status: 'Soon',
  },
  {
    title: 'Video Animation',
    description: 'Outline script status, style references, runtime, aspect ratios, and delivery platforms.',
    accent: 'from-emerald-500/18 via-teal-500/8 to-transparent',
    tag: 'Motion',
    href: '',
    status: 'Soon',
  },
]

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  )
}

export default function BriefFormsPage() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#0f172a]/95">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_32%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange-500/40 to-transparent" />

      <div className="relative border-b border-slate-800/90 px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
              <Image src="/bmybrand-B.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
              BMYBrand Intake
            </div>
            <h1 className="mt-5 max-w-2xl text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              Brief Forms
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Start the right intake flow for each service line. The bookkeeping questionnaire is live now,
              and the remaining brief types can be added into the same system next.
            </p>
          </div>

          <div className="w-full max-w-[240px]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Forms</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-black text-white">{briefFormOptions.length}</p>
                <p className="text-sm font-bold text-emerald-300">1 live now</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative px-6 py-6 sm:px-8 sm:py-8">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Service Categories</p>
          <p className="mt-2 text-sm text-slate-400">Choose a brief to begin the matching intake workflow.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {briefFormOptions.map((option, index) => {
            const CardTag = option.href ? Link : 'div'

            return (
              <CardTag
                key={option.title}
                {...(option.href ? { href: option.href } : {})}
                className={`group relative overflow-hidden rounded-[1.6rem] border border-slate-800 bg-[#111827] p-5 text-left transition duration-200 ${
                  option.href
                    ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-700 hover:bg-[#131d33]'
                    : 'cursor-default opacity-85'
                }`}
              >
                <div className={`absolute inset-0 bg-linear-to-br ${option.accent} opacity-90`} />
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/12 to-transparent" />

                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-slate-950/60 text-orange-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <span className="text-sm font-black">{String(index + 1).padStart(2, '0')}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/8 bg-slate-950/55 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                        {option.tag}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                        option.href ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {option.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h2 className="max-w-[18rem] text-lg font-extrabold leading-6 tracking-[-0.02em] text-white">
                      {option.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {option.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/6 bg-slate-950/35 px-4 py-3 text-sm">
                    <span className="font-semibold text-slate-300">
                      {option.href ? 'Open brief form' : 'Coming next'}
                    </span>
                    <span className={`text-orange-300 transition-transform duration-200 ${option.href ? 'group-hover:translate-x-1' : ''}`}>
                      <ArrowIcon />
                    </span>
                  </div>
                </div>
              </CardTag>
            )
          })}
        </div>
      </div>
    </section>
  )
}
