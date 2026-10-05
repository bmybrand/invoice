'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BRIEF_FORM_BRAND_PRESETS,
  matchPublicBriefFormBrand,
  normalizePublicBrandRows,
  publicBriefFormBrandAccent,
  publicBriefFormBrandCopyright,
  publicBriefFormBrandLabel,
  type PublicBriefFormBrand,
} from '@/lib/brief-form-public-brand'
import { supabase } from '@/lib/supabase'

type PublicBriefFormBrandContextValue = {
  brand: PublicBriefFormBrand | null
  loading: boolean
  label: string
  accent: string
  copyright: string
  logoUrl: string | null
  isTexas: boolean
}

const PublicBriefFormBrandContext = createContext<PublicBriefFormBrandContextValue>({
  brand: BRIEF_FORM_BRAND_PRESETS.bmybrand,
  loading: true,
  label: 'BMYBrand Intake',
  accent: '#ea580c',
  copyright: publicBriefFormBrandCopyright(BRIEF_FORM_BRAND_PRESETS.bmybrand),
  logoUrl: null,
  isTexas: false,
})

export function PublicBriefFormBrandProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const brandQuery = searchParams.get('brand')
  const [brand, setBrand] = useState<PublicBriefFormBrand | null>(BRIEF_FORM_BRAND_PRESETS.bmybrand)
  const [loading, setLoading] = useState(true)

  const loadBrand = useCallback(async () => {
    setLoading(true)
    const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
    const referrer = typeof document !== 'undefined' ? document.referrer : ''

    const { data } = await supabase
      .from('brands')
      .select(
        'id, brand_name, brand_url, invoice_base_url, invoice_primary_color, invoice_secondary_color, logo_url, favicon_url'
      )
      .neq('isdeleted', true)
      .order('brand_name')

    const rows = normalizePublicBrandRows((data as unknown[] | null) ?? null)
    const matched = matchPublicBriefFormBrand(rows, { brandQuery, hostname, referrer })
    setBrand(matched ?? BRIEF_FORM_BRAND_PRESETS.bmybrand)
    setLoading(false)
  }, [brandQuery])

  useEffect(() => {
    void loadBrand()
  }, [loadBrand])

  const accent = publicBriefFormBrandAccent(brand)
  const value: PublicBriefFormBrandContextValue = {
    brand,
    loading,
    label: publicBriefFormBrandLabel(brand),
    accent,
    copyright: publicBriefFormBrandCopyright(brand),
    logoUrl: brand?.logo_url?.trim() || null,
    isTexas: (brand?.brand_name || '').toLowerCase().includes('texas'),
  }

  const style = {
    ['--brief-accent' as string]: accent,
    ['--brief-accent-soft' as string]: `${accent}1a`,
  } as CSSProperties

  return (
    <PublicBriefFormBrandContext.Provider value={value}>
      <div style={style} className="min-h-inherit">
        {children}
      </div>
    </PublicBriefFormBrandContext.Provider>
  )
}

export function usePublicBriefFormBrand(): PublicBriefFormBrandContextValue {
  return useContext(PublicBriefFormBrandContext)
}
