'use client'

import Link from 'next/link'

export default function RegisterPendingPage() {
  return (
    <main className="flex h-screen min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-800/80 p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20">
          <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Account Pending Approval</h1>
        <p className="mt-2 text-slate-400">
          Your registration has been submitted. An administrator will review and approve your account shortly.
          You will receive access to the dashboard once approved.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-600 transition"
        >
          Back to Sign In
        </Link>
      </div>
    </main>
  )
}
