'use client'

import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'
import { resolveBriefFormsOriginForBrand } from '@/lib/brief-form-brand-url'

export function BriefFormBrandSelect({
  brands,
  selectedBrandId,
  onChange,
  disabled = false,
  loading = false,
  error = null,
  compact = false,
  className = '',
}: {
  brands: BriefFormBrandOption[]
  selectedBrandId: number | null
  onChange: (brandId: number) => void
  disabled?: boolean
  loading?: boolean
  error?: string | null
  compact?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <div className={className}>
        <p className={`mb-1.5 font-semibold uppercase tracking-wide text-slate-500 ${compact ? 'text-[10px]' : 'text-xs'}`}>
          Send from brand
        </p>
        <div className={`animate-pulse rounded-xl border border-slate-700 bg-slate-900/80 ${compact ? 'h-9' : 'h-11'}`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 ${className}`}>
        <p className="text-xs font-semibold text-amber-200">Could not load brands</p>
        <p className="mt-1 text-[11px] text-amber-100/80">{error}</p>
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 ${className}`}>
        <p className="text-xs font-semibold text-slate-300">No brands found</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Add Texas Web Studio under Brands and set its Invoice URL to https://texaswebstudio.co
        </p>
      </div>
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
        disabled={disabled || brands.length === 1}
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 text-white outline-none focus:border-orange-500/60 disabled:opacity-80 ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'
        }`}
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.brand_name} — {resolveBriefFormsOriginForBrand(brand)}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Uses the brand&apos;s Invoice URL (Vercel domain). Texas Web Studio → texaswebstudio.co
      </p>
    </label>
  )
}
