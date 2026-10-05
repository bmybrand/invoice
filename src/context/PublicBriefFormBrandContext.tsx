'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  resolvePublicBriefFormBrandSync,
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

function readClientBrandHints(brandQueryFromParams: string | null) {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const referrer = typeof document !== 'undefined' ? document.referrer : ''
  let brandQuery = brandQueryFromParams

  if (!brandQuery && typeof window !== 'undefined') {
    brandQuery = new URLSearchParams(window.location.search).get('brand')
  }

  return { brandQuery, hostname, referrer }
}

function buildContextValue(brand: PublicBriefFormBrand | null, loading: boolean): PublicBriefFormBrandContextValue {
  return {
    brand,
    loading,
    label: publicBriefFormBrandLabel(brand),
    accent: publicBriefFormBrandAccent(brand),
    copyright: publicBriefFormBrandCopyright(brand),
    logoUrl: brand?.logo_url?.trim() || null,
    isTexas: (brand?.brand_name || '').toLowerCase().includes('texas'),
  }
}

const PublicBriefFormBrandContext = createContext<PublicBriefFormBrandContextValue>(
  buildContextValue(BRIEF_FORM_BRAND_PRESETS.bmybrand, true)
)

export function PublicBriefFormBrandProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const brandQuery = searchParams.get('brand')

  const [brand, setBrand] = useState<PublicBriefFormBrand>(() =>
    resolvePublicBriefFormBrandSync(readClientBrandHints(brandQuery))
  )

  // Resolve from URL/referrer before paint so Texas never flashes as BMYBrand.
  useLayoutEffect(() => {
    setBrand(resolvePublicBriefFormBrandSync(readClientBrandHints(brandQuery)))
  }, [brandQuery])

  const loadBrand = useCallback(async () => {
    const hints = readClientBrandHints(brandQuery)
    const { data } = await supabase
      .from('brands')
      .select(
        'id, brand_name, brand_url, invoice_base_url, invoice_primary_color, invoice_secondary_color, logo_url, favicon_url'
      )
      .neq('isdeleted', true)
      .order('brand_name')

    const rows = normalizePublicBrandRows((data as unknown[] | null) ?? null)
    const matched = matchPublicBriefFormBrand(rows, hints)
    if (matched) {
      setBrand(matched)
    }
  }, [brandQuery])

  useEffect(() => {
    void loadBrand()
  }, [loadBrand])

  const value = buildContextValue(brand, false)

  const style = {
    ['--brief-accent' as string]: value.accent,
    ['--brief-accent-soft' as string]: `${value.accent}1a`,
  } as CSSProperties

  return (
    <PublicBriefFormBrandContext.Provider value={value}>
      <div
        style={style}
        className="brief-form-brand-scope min-h-inherit"
        data-brief-brand={value.isTexas ? 'texaswebstudio' : 'bmybrand'}
      >
        {children}
      </div>
    </PublicBriefFormBrandContext.Provider>
  )
}

export function usePublicBriefFormBrand(): PublicBriefFormBrandContextValue {
  return useContext(PublicBriefFormBrandContext)
}
