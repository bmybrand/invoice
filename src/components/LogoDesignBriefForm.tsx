'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BriefFormPrefill } from '@/lib/brief-form-prefill'
import { canSubmitBriefForm } from '@/lib/brief-form-access'
import { BriefFormCopySection } from '@/components/brief-forms/BriefFormActions'
import { useBriefFormSubmit } from '@/lib/use-brief-form-submit'

const MAX_REFERENCE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

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
      <span className="mt-2 block text-xs text-slate-500">Accepted image files up to 5 MB.</span>
      {error ? <span className="mt-2 block text-sm font-medium text-rose-600">{error}</span> : null}
    </label>
  )
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-slate-300 bg-white p-5 sm:p-6">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-slate-700">{title}</h2>
        {subtitle ? <p className="mt-1.5 text-sm font-medium text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

const logoExamples = [
  {
    title: 'Corporate/Professional',
    description:
      'Corporate logos are simple, bold and communicate strength. They do not necessarily illustrate what a company does. They are basic trademarks that come to symbolize a company even if they start as a somewhat arbitrary choice.',
    imageSrc: '/logo-1.jpg',
  },
  {
    title: 'Text Only',
    description:
      'Text-only logos are a challenge to keep unique because most fonts are so widely used. However, it can provide a nice literary or legal look. Alternatively, if you want something artier, a handwritten or arty font can look unique.',
    imageSrc: '/logo-2.jpg',
  },
  {
    title: 'Historical/Seals',
    description: 'These are having classic rich feel and have real longevity.',
    imageSrc: '/logo-3.jpg',
  },
  {
    title: 'Old World',
    description: 'Fun and beautiful. We are huge fans of old world style.',
    imageSrc: '/logo-4.jpg',
  },
  {
    title: 'Whimsical',
    description:
      'Whimsical logos, they are based on illustrations take more time and more budget and are more unique than any other type of logo.',
    imageSrc: '/logo-5.jpg',
  },
] as const

function ExampleBlock({
  title,
  description,
  imageSrc,
  checked,
  onToggle,
}: {
  title: string
  description: string
  imageSrc?: string
  checked: boolean
  onToggle: (checked: boolean) => void
}) {
  return (
    <div className="border border-slate-300 bg-white">
      <div className={`border-b border-slate-300 px-4 py-3 ${checked ? 'bg-slate-100' : 'bg-white'}`}>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onToggle(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded-[2px] border border-slate-400 accent-orange-500"
          />
          <div>
            <h3 className="text-sm font-bold text-slate-800">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="overflow-hidden border border-slate-200 bg-slate-50">
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={`${title} logo examples`}
              width={1200}
              height={800}
              className="h-auto w-full"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : null}

          {!imageSrc ? (
            <div className="flex min-h-[168px] items-center justify-center text-center text-sm font-medium text-slate-400">
              Add one collage image for {title}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function LogoDesignBriefForm({
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
  const { submitting, submitNotice, submitError, handleSubmit } = useBriefFormSubmit('logo-design')
  const [selectedLogoExamples, setSelectedLogoExamples] = useState<string[]>([])
  const [logoExampleError, setLogoExampleError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (selectedLogoExamples.length === 0) {
      event.preventDefault()
      setLogoExampleError('Select at least one logo example style before submitting.')
      return
    }

    setLogoExampleError('')
    await handleSubmit(event, {
      showCopyAction: false,
      canSubmit: submitAllowed,
      extra: { logo_example_styles: selectedLogoExamples },
    })
  }

  function handleLogoExampleToggle(title: string, checked: boolean) {
    setLogoExampleError('')
    setSelectedLogoExamples((current) =>
      checked ? [...current, title] : current.filter((item) => item !== title)
    )
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
              Logo Design Client Questionnaire
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${publicView ? 'text-slate-600' : 'text-slate-400'}`}>
              Share the company background, visual direction, color preferences, and stylistic references so
              the logo exploration starts with a clear strategic brief.
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
        <SectionCard title="Client Information">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Company:" placeholder="Your Company" required />
            <TextField label="Email:" placeholder="Your Email Address" type="email" required defaultValue={prefill.email} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Phone:" placeholder="Your Phone Number" type="tel" required defaultValue={prefill.phone} />
            <TextField label="Website Address:" placeholder="Your Website Address" type="url" required />
          </div>
          <TextField label="Contact Person:" placeholder="Your Contact Person" required defaultValue={prefill.contactPerson} />
        </SectionCard>

        <SectionCard title="Logo Design Brief">
          <TextAreaField label="What is the Name of the company that will appear on the Logo?" />
          <TextAreaField label="What do you want in your logo?" />
          <TextAreaField label="Are there any tagline/slogan associated with the logo?" />
          <TextAreaField label="Please give us a brief overview of your company. What are your services? What you do or produce?" />
          <TextAreaField label="Who are your target audience/typical customer?" />
        </SectionCard>

        <SectionCard title="Theme, Look, Style and Feel">
          <TextAreaField label="What sort of style do you envision? (E.g. professional, modern and clean, old world, cutting edge, vintage, sporty, futuristic, High etc.)" />
          <TextAreaField label="Please provide some adjectives that describe what you hope to communicate with your logo (e.g. strong, exciting, warm, welcoming, inventive, humorous, feminine, serene, athletic, etc.). Be sure to look at the logo examples we provide at the end of this questionnaire." />
          <TextAreaField label="Are there any ideas that you like to use for the logo (or) you are open to ideas?" />
          <FileField
            label="Upload any reference image(s) you want us to review"
            maxSizeBytes={MAX_REFERENCE_IMAGE_SIZE_BYTES}
          />
        </SectionCard>

        <SectionCard title="Ideas, icons, images or symbols">
          <TextAreaField label="Do you have any particular images or symbols you associate with your product or company? (E.g. favorite animal or object, like a lion, ship, mountain or tree.)" />
        </SectionCard>

        <SectionCard title="Colors">
          <TextAreaField label="What are your color preferences?" />
        </SectionCard>

        <SectionCard title="Logo Examples">
          <p className="text-base font-semibold text-slate-700">Corporate/Professional</p>
          <p className="text-sm leading-7 text-slate-600">
            These examples are a starting point to help illustrate what we mean when we use terms such as
            corporate, old world, illustrative, etc. There are not clean divisions between these categories.
            Most of the logos could fall into several categories.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {logoExamples.map((example) => (
              <ExampleBlock
                key={example.title}
                title={example.title}
                description={example.description}
                imageSrc={example.imageSrc}
                checked={selectedLogoExamples.includes(example.title)}
                onToggle={(checked) => handleLogoExampleToggle(example.title, checked)}
              />
            ))}
          </div>
          {logoExampleError ? (
            <p className="text-sm font-medium text-rose-600">{logoExampleError}</p>
          ) : null}
        </SectionCard>

        <SectionCard title="Other Information">
          <TextAreaField label="Please provide any information, which you think we might need to know, which hasn't been covered in your answers?" />
        </SectionCard>

        {true ? (
          <div className="border border-slate-300 bg-white px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-5">
              {submitAllowed ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center self-start rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                  {submitError ? (
                    <p className="text-sm font-medium text-rose-600 sm:ml-auto">{submitError}</p>
                  ) : submitNotice ? (
                    <p className="text-sm font-medium text-emerald-600 sm:ml-auto">{submitNotice}</p>
                  ) : null}
                </div>
              ) : null}

              <div className={`space-y-4 pt-5 text-sm leading-7 text-slate-600 ${submitAllowed ? 'border-t border-slate-200' : ''}`}>
                <p>Once this form completed, please send it back to your Project Account manager.</p>
                <p>
                  Thank you for taking time out of your day to fill out this design brief for logo. Please save
                  this file for your reference and email it to us at{' '}
                  <a href="mailto:info@bmybrand.com" className="font-semibold text-orange-500 hover:text-orange-600">
                    info@bmybrand.com
                  </a>
                  .
                </p>
                <p>
                  One of our team member will contact you shortly. Please feel free to contact us. We are
                  committed to working with you to provide a complete professional image that increases your
                  brand equity and enhances the value proposition of your products/services.
                </p>
                <p>
                  The following information will strictly be used for order fulfillment, and to have a clear
                  understanding of your business; it will not at all be distributed to any third party/service
                  vendor by us.
                </p>
                <p>
                  Your input is valuable to us, and we strongly encourage you to brief as much as you can.
                  However, we will be corresponding with you at every step of the process even after receiving
                  this document as a logo varies enormously in appearance. Any future alterations to the
                  following specifications will subject to additional charges or mutual understandings.
                  Carefully submit your details as it would be the building block for our design work. Feel
                  free to leave fields blank if not applicable.
                </p>
                <p>
                  In case of any concerns that you would like to discuss over the phone related to this form,
                  call us at{' '}
                  <a href="tel:+14695011401" className="font-semibold text-orange-500 hover:text-orange-600">
                    +1 469 501 1401
                  </a>
                  . Note: After design approval and during development phase you cannot ask to stop your
                  project, and no refunds will be applicable.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showCopyAction ? <BriefFormCopySection formType="logo-design" /> : null}

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
