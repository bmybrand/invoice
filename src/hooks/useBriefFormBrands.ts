'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'
import {
  isMissingBriefFormsBaseUrlColumnError,
  pickDefaultBriefFormBrand,
} from '@/lib/brief-form-brand-url'
import { supabase } from '@/lib/supabase'

type UseBriefFormBrandsResult = {
  brands: BriefFormBrandOption[]
  selectedBrand: BriefFormBrandOption | null
  setSelectedBrandId: (id: number) => void
  loading: boolean
  error: string | null
}

function mapBrandRows(data: unknown[] | null): BriefFormBrandOption[] {
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    brand_name: String(row.brand_name ?? ''),
    brand_url: (row.brand_url as string | null) ?? null,
    brief_forms_base_url: (row.brief_forms_base_url as string | null) ?? null,
    invoice_base_url: (row.invoice_base_url as string | null) ?? null,
  }))
}

export function useBriefFormBrands(options?: { enabled?: boolean }): UseBriefFormBrandsResult {
  const enabled = options?.enabled ?? true
  const [brands, setBrands] = useState<BriefFormBrandOption[]>([])
  const [selectedBrandId, setSelectedBrandIdState] = useState<number | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const loadBrands = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const primary = await supabase
      .from('brands')
      .select('id, brand_name, brand_url, brief_forms_base_url, invoice_base_url')
      .neq('isdeleted', true)
      .order('brand_name')

    let rows: BriefFormBrandOption[] = []

    if (primary.error && isMissingBriefFormsBaseUrlColumnError(primary.error.message)) {
      const fallback = await supabase
        .from('brands')
        .select('id, brand_name, brand_url, invoice_base_url')
        .neq('isdeleted', true)
        .order('brand_name')

      if (fallback.error) {
        setBrands([])
        setSelectedBrandIdState(null)
        setError(fallback.error.message || 'Failed to load brands')
        setLoading(false)
        return
      }

      rows = mapBrandRows(fallback.data as unknown[] | null)
    } else if (primary.error) {
      setBrands([])
      setSelectedBrandIdState(null)
      setError(primary.error.message || 'Failed to load brands')
      setLoading(false)
      return
    } else {
      rows = mapBrandRows(primary.data as unknown[] | null)
    }

    setBrands(rows)
    setSelectedBrandIdState((prev) => {
      if (prev != null && rows.some((row) => row.id === prev)) {
        return prev
      }
      return pickDefaultBriefFormBrand(rows)?.id ?? null
    })
    setLoading(false)
  }, [enabled])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  const selectedBrand =
    brands.find((brand) => brand.id === selectedBrandId) ?? pickDefaultBriefFormBrand(brands)

  const setSelectedBrandId = useCallback((id: number) => {
    setSelectedBrandIdState(id)
  }, [])

  return { brands, selectedBrand, setSelectedBrandId, loading, error }
}
