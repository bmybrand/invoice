'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'
import { pickDefaultBriefFormBrand } from '@/lib/brief-form-brand-url'
import { supabase } from '@/lib/supabase'

type UseBriefFormBrandsResult = {
  brands: BriefFormBrandOption[]
  selectedBrand: BriefFormBrandOption | null
  setSelectedBrandId: (id: number) => void
  loading: boolean
}

export function useBriefFormBrands(): UseBriefFormBrandsResult {
  const [brands, setBrands] = useState<BriefFormBrandOption[]>([])
  const [selectedBrandId, setSelectedBrandIdState] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const loadBrands = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('brands')
      .select('id, brand_name, brand_url, brief_forms_base_url, invoice_base_url')
      .neq('isdeleted', true)
      .order('brand_name')

    if (error) {
      setBrands([])
      setSelectedBrandIdState(null)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as BriefFormBrandOption[]
    setBrands(rows)
    setSelectedBrandIdState((prev) => {
      if (prev != null && rows.some((row) => row.id === prev)) {
        return prev
      }
      return pickDefaultBriefFormBrand(rows)?.id ?? null
    })
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadBrands()
  }, [loadBrands])

  const selectedBrand =
    brands.find((brand) => brand.id === selectedBrandId) ?? pickDefaultBriefFormBrand(brands)

  const setSelectedBrandId = useCallback((id: number) => {
    setSelectedBrandIdState(id)
  }, [])

  return { brands, selectedBrand, setSelectedBrandId, loading }
}
