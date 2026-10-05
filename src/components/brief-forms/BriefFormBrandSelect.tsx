'use client'

import type { BriefFormBrandOption } from '@/lib/brief-form-brand-url'
import { resolveBriefFormsOriginForBrand } from '@/lib/brief-form-brand-url'
import {
  canonicalizeBriefFormBrandSlug,
  filterBriefFormCopyBrands,
} from '@/lib/brief-form-public-brand'

function BrandMark({ slug }: { slug: 'bmybrand' | 'texaswebstudio' | null }) {
  if (slug === 'texaswebstudio') {
    return (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-sm font-black text-blue-300">
        T
      </span>
    )
  }

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-sm font-black text-orange-300">
      B
    </span>
  )
}

export function BriefFormBrandSelect({
  brands,
  selectedBrandId,
  onChange,
  disabled = false,
  loading = false,
  error = null,
  tone = 'dark',
  className = '',
}: {
  brands: BriefFormBrandOption[]
  selectedBrandId: number | null
  onChange: (brandId: number) => void
  disabled?: boolean
  loading?: boolean
  error?: string | null
  compact?: boolean
  tone?: 'dark' | 'light'
  className?: string
}) {
  const selectable = filterBriefFormCopyBrands(brands)
  const isLight = tone === 'light'

  if (loading) {
    return (
      <div className={className}>
        <p className={`mb-2 text-[11px] font-black uppercase tracking-[0.18em] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
          Send from brand
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className={`h-[4.5rem] animate-pulse rounded-2xl border ${isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-900/80'}`} />
          <div className={`h-[4.5rem] animate-pulse rounded-2xl border ${isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-900/80'}`} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`rounded-2xl border px-3 py-2 ${isLight ? 'border-amber-300 bg-amber-50' : 'border-amber-500/30 bg-amber-500/10'} ${className}`}>
        <p className={`text-xs font-semibold ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>Could not load brands</p>
        <p className={`mt-1 text-[11px] ${isLight ? 'text-amber-700' : 'text-amber-100/80'}`}>{error}</p>
      </div>
    )
  }

  if (selectable.length === 0) {
    return (
      <div className={`rounded-2xl border px-3 py-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-700 bg-slate-900/70'} ${className}`}>
        <p className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>No copy brands found</p>
        <p className={`mt-1 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
          Add BMYBrand and Texas Web Studio under Brands.
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        Send from brand
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {selectable.map((brand) => {
          const selected = brand.id === selectedBrandId
          const slug = canonicalizeBriefFormBrandSlug(brand.brand_name)
          const domain = resolveBriefFormsOriginForBrand(brand).replace(/^https?:\/\//, '')

          return (
            <button
              key={brand.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(brand.id)}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                selected
                  ? slug === 'texaswebstudio'
                    ? isLight
                      ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
                      : 'border-blue-400/50 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]'
                    : isLight
                      ? 'border-orange-400 bg-orange-50 shadow-[0_0_0_1px_rgba(249,115,22,0.2)]'
                      : 'border-orange-400/50 bg-orange-500/10 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
                  : isLight
                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    : 'border-slate-700 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900'
              } disabled:opacity-60`}
            >
              <BrandMark slug={slug} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {slug === 'texaswebstudio' ? 'Texas Web Studio' : slug === 'bmybrand' ? 'BMYBrand' : brand.brand_name}
                </span>
                <span className={`mt-0.5 block truncate text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{domain}</span>
              </span>
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  selected
                    ? slug === 'texaswebstudio'
                      ? 'bg-blue-400'
                      : 'bg-orange-400'
                    : isLight
                      ? 'bg-slate-300'
                      : 'bg-slate-600'
                }`}
              />
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
        Copied client links use the selected brand domain.
      </p>
    </div>
  )
}
