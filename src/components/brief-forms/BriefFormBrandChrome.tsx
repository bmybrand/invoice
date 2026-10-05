'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { usePublicBriefFormBrand } from '@/context/PublicBriefFormBrandContext'
import { getBriefFormBrandContact } from '@/lib/brief-form-public-brand'

export function BriefFormBrandBadge({ publicView = false }: { publicView?: boolean }) {
  const { label, logoUrl, accent, isTexas, brand } = usePublicBriefFormBrand()
  const brandName = brand?.brand_name?.trim() || (isTexas ? 'Texas Web Studio' : 'BMYBrand')

  return (
    <div className="space-y-3">
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
      {publicView ? (
        <p className="text-sm font-bold tracking-[-0.01em] text-slate-800 sm:text-base">
          Brand:{' '}
          <span style={{ color: accent }}>{brandName}</span>
        </p>
      ) : null}
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
  children: ReactNode
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

export function BriefFormContactPhoneLink({ className = 'font-semibold' }: { className?: string }) {
  const { brand, accent } = usePublicBriefFormBrand()
  const { phoneDisplay, phoneTel } = getBriefFormBrandContact(brand)

  return (
    <a href={`tel:${phoneTel}`} className={className} style={{ color: accent }}>
      {phoneDisplay}
    </a>
  )
}

export function BriefFormContactEmailLink({ className = 'font-semibold' }: { className?: string }) {
  const { brand, accent } = usePublicBriefFormBrand()
  const { email } = getBriefFormBrandContact(brand)

  return (
    <a href={`mailto:${email}`} className={className} style={{ color: accent }}>
      {email}
    </a>
  )
}
