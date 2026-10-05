'use client'

import { Suspense, type ReactNode } from 'react'
import { PublicBriefFormBrandProvider } from '@/context/PublicBriefFormBrandContext'

export default function PublicBriefFormsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-6 text-sm text-slate-400">
          Loading form...
        </div>
      }
    >
      <PublicBriefFormBrandProvider>{children}</PublicBriefFormBrandProvider>
    </Suspense>
  )
}
