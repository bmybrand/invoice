'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BriefFormPrefill } from '@/lib/brief-form-prefill'
import { canSubmitBriefForm } from '@/lib/brief-form-access'
import { useBriefFormSubmit } from '@/lib/use-brief-form-submit'
import { BriefFormCopySection, BriefFormSubmitBar } from '@/components/brief-forms/BriefFormActions'

const MAX_REFERENCE_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

type Option = {
  value: string
  label: string
}

const yesNoOptions: Option[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

function BackIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function TextField({
  label,
  placeholder,
  type = 'text',
  required = false,
  defaultValue,
}: {
  label: string
  placeholder?: string
  type?: string
  required?: boolean
  defaultValue?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {required ? <span className="mr-1 text-slate-400">*</span> : null}
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
  )
}

function TextAreaField({
  label,
  placeholder = 'Message',
  rows = 4,
  required = false,
}: {
  label: string
  placeholder?: string
  rows?: number
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {required ? <span className="mr-1 text-slate-400">*</span> : null}
        {label}
      </span>
      <textarea
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
  )
}

function FileField({
  label,
  accept = 'image/*',
  maxSizeBytes,
}: {
  label: string
  accept?: string
  maxSizeBytes?: number
}) {
  const [error, setError] = useState('')

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file || !maxSizeBytes) {
      setError('')
      return
    }

    if (file.size > maxSizeBytes) {
      event.target.value = ''
      setError(`Please upload an image smaller than ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`)
      return
    }

    setError('')
  }

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      />
      <span className="mt-2 block text-xs text-slate-500">Accepted image files up to 10 MB.</span>
      {error ? <span className="mt-2 block text-sm font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}

function ChoiceGroup({
  label,
  name,
  options,
  required = false,
}: {
  label: string
  name: string
  options: Option[]
  required?: boolean
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-slate-700">
        {required ? <span className="mr-1 text-slate-400">*</span> : null}
        {label}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-slate-500"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              required={required && option.value === options[0]?.value}
              className="h-4 w-4 accent-orange-500"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-slate-300 bg-white p-5 sm:p-6">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-slate-700">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

export default function GraphicDesignBriefForm({
  backHref,
  backLabel,
  publicView = false,
  prefill = {},
  showCopyAction = !publicView,
  canSubmit,
}: {
  backHref?: string
  backLabel?: string
  publicView?: boolean
  prefill?: BriefFormPrefill
  showCopyAction?: boolean
  canSubmit?: boolean
}) {
  const submitAllowed = canSubmit ?? canSubmitBriefForm(publicView, showCopyAction)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const { submitting, submitNotice, submitError, handleSubmit } = useBriefFormSubmit('graphic-design')

  async function handleCopyLink() {
    try {
      const publicUrl = new URL('/brief-forms/graphic-design', window.location.origin).toString()
      await navigator.clipboard.writeText(publicUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    await handleSubmit(event, { showCopyAction: false, canSubmit: submitAllowed })
  }

  return (
    <section className={`relative overflow-hidden ${publicView ? 'bg-white' : 'rounded-[2rem] border border-slate-800 bg-[#0f172a]/95'}`}>
      {!publicView ? (
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange-500/40 to-transparent" />
      ) : null}

      <div className={`relative px-6 py-8 sm:px-8 sm:py-10 ${publicView ? 'border-b border-slate-200 bg-white' : 'border-b border-slate-800/90'}`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${
              publicView
                ? 'border border-orange-200 bg-orange-50 text-orange-500'
                : 'border border-orange-500/20 bg-orange-500/10 text-orange-300'
            }`}>
              <Image src="/bmybrand-B.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
              BMYBrand Intake
            </div>
            <h1 className={`mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl ${publicView ? 'text-slate-950' : 'text-white'}`}>
              Graphic Design Brief Questionnaire
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${publicView ? 'text-slate-600' : 'text-slate-400'}`}>
              Capture the project goal, creative direction, audience, assets, and technical output details
              before design production begins.
            </p>
          </div>

          {backHref && backLabel ? (
            <Link
              href={backHref}
              className={`inline-flex items-center gap-2 self-start rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                publicView
                  ? 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-950'
                  : 'border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
            >
              <BackIcon />
              {backLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <form onSubmit={onSubmit} className="relative space-y-6 bg-white px-6 py-6 sm:px-8 sm:py-8">
        <SectionCard title="1. Basic Information">
          <TextField label="Company / Brand Name:" placeholder="Your Company or Brand Name" required defaultValue={prefill.clientName} />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Your Full Name:" placeholder="Your Full Name" required defaultValue={prefill.contactPerson} />
            <TextField label="Email Address:" placeholder="Your Email Address" type="email" required defaultValue={prefill.email} />
          </div>
          <TextField label="Phone Number:" placeholder="Phone Number" type="tel" required defaultValue={prefill.phone} />
        </SectionCard>

        <SectionCard title="2. Project Overview">
          <TextField label="What type of design do you need?" placeholder="Logo, Social Media Post, Website UI, Flyer, Banner, etc." />
          <TextAreaField label="Briefly describe your project" placeholder="Describe your project" />
          <TextField label="What is the main goal of this design?" placeholder="Increase sales, brand awareness, event promotion, etc." />
          <TextField label="Who is your target audience?" placeholder="Young adults, business owners, students, etc." />
          <TextField label="Where will this design be used?" placeholder="Instagram, Website, Print, Ads, Billboard, etc." />
        </SectionCard>

        <SectionCard title="3. Design Preferences">
          <ChoiceGroup label="Do you have an existing brand guideline?" name="brandGuideline" options={yesNoOptions} />
          <TextAreaField label="If yes, share link or notes" />
          <TextField label="What colors would you like to use?" placeholder="Blue and white, #11122F, #231231, etc." />
          <TextField label="Are there any colors you want to avoid?" placeholder="Avoid red and neon colors" />
          <TextField label="What style do you prefer?" placeholder="Minimal, Modern, Corporate, Luxury, Playful, Bold, Futuristic" />
          <TextAreaField label="Share reference designs you like" placeholder="Competitor links, Pinterest, Instagram posts, etc." />
          <FileField
            label="Upload any reference image(s) you want us to review"
            maxSizeBytes={MAX_REFERENCE_IMAGE_SIZE_BYTES}
          />
          <TextField label="What do you like about these references?" placeholder="Clean layout, color combination, typography" />
          <TextField label="Is there anything you do NOT want in the design?" placeholder="No gradients, no cartoon style, avoid cluttered look" />
        </SectionCard>

        <SectionCard title="4. Content & Assets">
          <ChoiceGroup label="Do you already have content ready?" name="contentReady" options={yesNoOptions} />
          <TextAreaField label="Please provide the content (text/images/logo)" placeholder="Tagline, product images, brand logo" />
          <ChoiceGroup label="Do you want us to use stock images if needed?" name="stockImages" options={yesNoOptions} />
          <TextField label="Any specific text that must be included?" placeholder="50% OFF Sale, Launching Soon, etc." />
        </SectionCard>

        <SectionCard title="5. Technical Requirements">
          <TextField label="What size or dimensions do you need?" placeholder="Instagram 1080x1080, Banner 1920x600, etc." />
          <TextField label="What file formats do you require?" placeholder="JPG, PNG, PDF, AI, PSD" />
        </SectionCard>

        <SectionCard title="6. Final Notes">
          <TextAreaField label="Is there anything else you would like us to know?" placeholder="Competitor links, inspiration, special instructions" />
        </SectionCard>

        {showCopyAction ? (
          <BriefFormCopySection copyState={copyState} onCopyLink={handleCopyLink} />
        ) : null}

        <BriefFormSubmitBar
          canSubmit={submitAllowed}
          submitting={submitting}
          submitNotice={submitNotice}
          submitError={submitError}
          submitLabel="Submit Graphic Design Brief"
        />

        <footer className="pb-2 text-center text-xs text-slate-400">
          Copyright 2026 BMYBrand. All Rights Reserved
          <span className="mx-2 text-slate-700">|</span>
          Privacy Policy
          <span className="mx-2 text-slate-700">|</span>
          Terms &amp; Conditions
        </footer>
      </form>
    </section>
  )
}
