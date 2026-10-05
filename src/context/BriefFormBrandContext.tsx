'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useBriefFormBrands } from '@/hooks/useBriefFormBrands'
import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'

type BriefFormBrandContextValue = {
  brands: BriefFormBrandOption[]
  selectedBrand: BriefFormBrandOption | null
  setSelectedBrandId: (id: number) => void
  loading: boolean
}

const BriefFormBrandContext = createContext<BriefFormBrandContextValue | null>(null)

export function BriefFormBrandProvider({ children }: { children: ReactNode }) {
  const value = useBriefFormBrands()
  return <BriefFormBrandContext.Provider value={value}>{children}</BriefFormBrandContext.Provider>
}

export function useBriefFormBrandContext(): BriefFormBrandContextValue {
  const ctx = useContext(BriefFormBrandContext)
  const fallback = useBriefFormBrands()
  return ctx ?? fallback
}
