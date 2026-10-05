'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'
import { pickDefaultBriefFormBrand } from '@/lib/brief-form-brand-url'
import {
  canonicalizeBriefFormBrandSlug,
  filterBriefFormCopyBrands,
} from '@/lib/brief-form-public-brand'
import { supabase } from '@/lib/supabase'

type UseBriefFormBrandsResult = {
  brands: BriefFormBrandOption[]
  selectedBrand: BriefFormBrandOption | null
  setSelectedBrandId: (id: number) => void
  loading: boolean
  error: string | null
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

    const { data, error: queryError } = await supabase
      .from('brands')
      .select('id, brand_name, brand_url, invoice_base_url')
      .neq('isdeleted', true)
      .order('brand_name')

    if (queryError) {
      setBrands([])
      setSelectedBrandIdState(null)
      setError(queryError.message || 'Failed to load brands')
      setLoading(false)
      return
    }

    const rows = filterBriefFormCopyBrands(
      ((data ?? []) as BriefFormBrandOption[]).map((row) => ({
        id: Number(row.id),
        brand_name: row.brand_name || '',
        brand_url: row.brand_url ?? null,
        invoice_base_url: row.invoice_base_url ?? null,
      }))
    )

    const hasBmy = rows.some((row) => canonicalizeBriefFormBrandSlug(row.brand_name) === 'bmybrand')
    const hasTexas = rows.some((row) => canonicalizeBriefFormBrandSlug(row.brand_name) === 'texaswebstudio')
    if (!hasBmy) {
      rows.unshift({
        id: -1,
        brand_name: 'BMYBrand',
        brand_url: 'https://bmybrand.com',
        invoice_base_url: 'https://bmybrand.com',
      })
    }
    if (!hasTexas) {
      rows.push({
        id: -2,
        brand_name: 'Texas Web Studio',
        brand_url: 'https://texaswebstudio.co',
        invoice_base_url: 'https://texaswebstudio.co',
      })
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
