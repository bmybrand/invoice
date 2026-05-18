'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

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
  required = true,
}: {
  label: string
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
  )
}

function TextAreaField({
  label,
  placeholder = 'Message',
  rows = 4,
  required = true,
}: {
  label: string
  placeholder?: string
  rows?: number
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        rows={rows}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
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

export default function VideoAnimationBriefForm({
  backHref,
  backLabel,
  publicView = false,
}: {
  backHref?: string
  backLabel?: string
  publicView?: boolean
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [submitNotice, setSubmitNotice] = useState('')

  async function handleCopyLink() {
    try {
      const publicUrl = new URL('/brief-forms/video-animation', window.location.origin).toString()
      await navigator.clipboard.writeText(publicUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!publicView) return
    event.preventDefault()
    setSubmitNotice('Successfully submitted.')
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
              Video Animation Client Questionnaire
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${publicView ? 'text-slate-600' : 'text-slate-400'}`}>
              Capture the message, style, audience, voiceover, music, and desired outcome so the animation
              team can plan the right creative direction from the start.
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

      <form onSubmit={handleSubmit} className="relative space-y-6 bg-white px-6 py-6 sm:px-8 sm:py-8">
        <SectionCard title="Client Information">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Company:" placeholder="Your Company" />
            <TextField label="Email:" placeholder="Your Email Address" type="email" />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Phone:" placeholder="Your Phone Number" type="tel" />
            <TextField label="Website Address:" placeholder="Your Website Address" type="url" />
          </div>
          <TextField label="Contact Person:" placeholder="Your Contact Person" />
        </SectionCard>

        <SectionCard title="Video Animation Brief">
          <TextAreaField label="Any specific type of video that you need?" />
          <TextAreaField label="Type of voiceover you need?" />
          <TextAreaField label="Type of music" />
          <TextAreaField label="What is your product or service?" />
          <TextAreaField label="What is the ‘PERFECT’ solution which ONLY YOU provide?" />
          <TextAreaField label="Please provide us with bullet points of all the areas you would like us to cover in the video?" />
          <TextAreaField label="What is the purpose of the video(s)?" />
          <TextAreaField label="Do you have a script?" />
          <TextAreaField label="Who is your intended target?" />
          <TextAreaField label="Do you have certain, logo, or fonts or colors you use." />
          <TextAreaField label="Do you want a video comparable to something you like? If so please describe or send a web link or image. If not, please describe a style you might like." />
          <TextAreaField label="Please outline the features of the product or service: Tell us how it works, let us know the technology behind it, etc." />
          <TextAreaField label="Please outline the potential ways you ‘could’ solve the problem." />
          <TextAreaField label="Please outline the potential ways you ‘could’ solve the problem." />
          <TextAreaField label="After viewing the video what are the three most important things you want a person to believe and/or do?" />
          <TextAreaField label="Do you need any text added?" />
          <TextAreaField label="Any other info?" />
        </SectionCard>

        {publicView ? (
          <div className="border border-slate-300 bg-white px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center self-start rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  Submit
                </button>
                {submitNotice ? (
                  <p className="text-sm font-medium text-emerald-600 sm:ml-auto">{submitNotice}</p>
                ) : null}
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-5 text-sm leading-7 text-slate-600">
                <p>Once this form completed, please send it back to your Project Account manager.</p>
                <p>
                  Thank you for taking time out of your day to fill out this brief for Animation. Please save
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
                  this document as an Animation varies enormously in appearance. Any future alterations to the
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
        ) : (
          <div className="border border-slate-300 bg-white px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-bold text-slate-950">Ready to copy?</p>
                <p className="mt-1 text-sm text-slate-500">
                  Copy this form link and send it to the client so they can fill it out.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy Failed' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}

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
