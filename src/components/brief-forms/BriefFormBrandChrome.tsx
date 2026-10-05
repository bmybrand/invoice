'use client'

import Image from 'next/image'
import { usePublicBriefFormBrand } from '@/context/PublicBriefFormBrandContext'

export function BriefFormBrandBadge({ publicView = false }: { publicView?: boolean }) {
  const { label, logoUrl, accent, isTexas } = usePublicBriefFormBrand()

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${
        publicView ? 'border' : 'border border-orange-500/20 bg-orange-500/10 text-orange-300'
      }`}
      style={
        publicView
          ? {
              borderColor: `${accent}55`,
              backgroundColor: `${accent}14`,
              color: accent,
            }
          : undefined
      }
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-[18px] w-[18px] object-contain" />
      ) : isTexas ? (
        <span
          className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-black text-white"
          style={{ backgroundColor: accent }}
          aria-hidden
        >
          T
        </span>
      ) : (
        <Image src="/bmybrand-B.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
      )}
      {label}
    </div>
  )
}

export function BriefFormBrandFooter() {
  const { copyright } = usePublicBriefFormBrand()
  return <p className="text-center text-xs text-slate-400">{copyright}</p>
}

export function BriefFormAccentSubmitButton({
  submitting,
  children,
  className = '',
}: {
  submitting: boolean
  children: React.ReactNode
  className?: string
}) {
  const { accent } = usePublicBriefFormBrand()

  return (
    <button
      type="submit"
      disabled={submitting}
      className={`inline-flex items-center justify-center self-start rounded-2xl px-6 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      style={{ backgroundColor: accent }}
    >
      {children}
    </button>
  )
}
