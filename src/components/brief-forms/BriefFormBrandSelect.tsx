'use client'

import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'
import { resolveBriefFormsOriginForBrand } from '@/lib/brief-form-brand-url'

export function BriefFormBrandSelect({
  brands,
  selectedBrandId,
  onChange,
  disabled = false,
  compact = false,
  className = '',
}: {
  brands: BriefFormBrandOption[]
  selectedBrandId: number | null
  onChange: (brandId: number) => void
  disabled?: boolean
  compact?: boolean
  className?: string
}) {
  if (brands.length <= 1) {
    const only = brands[0]
    if (!only) {
      return null
    }

    return (
      <p className={`text-xs text-slate-500 ${className}`}>
        Public link domain:{' '}
        <span className="font-semibold text-slate-300">{resolveBriefFormsOriginForBrand(only)}</span>
      </p>
    )
  }

  return (
    <label className={`block ${className}`}>
      <span className={`mb-1.5 block font-semibold uppercase tracking-wide text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        Send from brand
      </span>
      <select
        value={selectedBrandId ?? brands[0]?.id ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 text-white outline-none focus:border-orange-500/60 disabled:opacity-60 ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'
        }`}
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.brand_name} — {resolveBriefFormsOriginForBrand(brand)}
          </option>
        ))}
      </select>
    </label>
  )
}
