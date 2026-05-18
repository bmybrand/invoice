'use client'

export default function BriefFormsPage() {
  return (
    <section className="flex min-h-[420px] flex-col rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-400/80">
          BMYBrand
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white">
          Brief Forms
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
          This section is ready for your BMYBrand brief form workflow. Add intake forms,
          submissions, or internal review tools here.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-[#111a2d] p-5">
          <h2 className="text-lg font-semibold text-white">Client Intake</h2>
          <p className="mt-2 text-sm text-slate-400">
            Use this page to collect branding goals, references, deliverables, and deadlines.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#111a2d] p-5">
          <h2 className="text-lg font-semibold text-white">Next Step</h2>
          <p className="mt-2 text-sm text-slate-400">
            If you want, I can build the actual form, submissions table, and database flow next.
          </p>
        </div>
      </div>
    </section>
  )
}
