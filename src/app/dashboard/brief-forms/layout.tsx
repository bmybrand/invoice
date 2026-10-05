'use client'

import type { ReactNode } from 'react'
import { BriefFormBrandProvider } from '@/context/BriefFormBrandContext'

export default function DashboardBriefFormsLayout({ children }: { children: ReactNode }) {
  return <BriefFormBrandProvider>{children}</BriefFormBrandProvider>
}
