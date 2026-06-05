'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { BriefFormPrefill } from '@/lib/brief-form-prefill'
import { canSubmitBriefForm } from '@/lib/brief-form-access'
import { BriefFormCopyButton, BriefFormCopySection } from '@/components/brief-forms/BriefFormActions'
import { useBriefFormSubmit } from '@/lib/use-brief-form-submit'

type Option = {
  value: string
  label: string
}

const yesNoOptions: Option[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const paymentMethods: Option[] = [
  { value: 'credit-card', label: 'Pay by credit card' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'mastercard', label: 'MasterCard' },
  { value: 'paypal', label: 'Paypal' },
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

function ChoiceGroup({
  label,
  name,
  options,
  type = 'radio',
  required = false,
}: {
  label: string
  name: string
  options: Option[]
  type?: 'radio' | 'checkbox'
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
              type={type}
              name={name}
              value={option.value}
              required={required && type === 'radio' ? option.value === options[0]?.value : false}
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

export default function WebsiteBriefForm({
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
  const { submitting, submitNotice, submitError, handleSubmit } = useBriefFormSubmit('website')

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
              Website Brief Questionnaire
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${publicView ? 'text-slate-600' : 'text-slate-400'}`}>
              Share your business direction, website goals, audience, content structure, platform preferences,
              and any delivery expectations so the website scope is clear from the start.
            </p>
          </div>

          {backHref && backLabel ? (
            <div className="flex flex-wrap items-center gap-2 self-start">
              <BriefFormCopyButton formType="website" publicView={publicView} />
              <Link
                href={backHref}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  publicView
                    ? 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-950'
                    : 'border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <BackIcon />
                {backLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={onSubmit} className="relative space-y-6 bg-white px-6 py-6 sm:px-8 sm:py-8">
        <SectionCard title="Client Information">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Client Name:" placeholder="Enter Your Name" required defaultValue={prefill.clientName} />
            <TextField label="Contact Person:" placeholder="Contact Person" required defaultValue={prefill.contactPerson} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Designation:" placeholder="Designation" required />
            <TextField label="Email Address:" placeholder="Your Email Address" type="email" required defaultValue={prefill.email} />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Phone Number:" placeholder="Phone Number" type="tel" required defaultValue={prefill.phone} />
            <TextField label="Skype:" placeholder="Skype" required />
          </div>
          <TextField label="Industry:" placeholder="Industry" required />
        </SectionCard>

        <SectionCard title="Website Concept" subtitle="Business Specifics">
          <TextAreaField label="What is the Name of the Business?" />
          <ChoiceGroup label="Do you have a Logo for the Business?" name="businessLogo" options={yesNoOptions} />
          <ChoiceGroup label="Do you have a Slogan for the Business? If yes, what is it?" name="businessSlogan" options={yesNoOptions} />
        </SectionCard>

        <SectionCard title="Website Specifics">
          <TextAreaField label="What is the Principal Purpose of the Website?" />
          <TextAreaField label="Who is the Target Audience?" />
          <TextField label="Is there an existing website? If yes, please provide the URL" placeholder="please provide the URL" type="url" />
          <ChoiceGroup label="Are there any website color preferences? If yes, mention the details." name="colorPreferences" options={yesNoOptions} />
          <TextAreaField label="Please mention 3 top competitors" />
          <ChoiceGroup
            label="What payment methods would you like to use? Check all that applies"
            name="paymentMethods"
            options={paymentMethods}
            type="checkbox"
          />
          <TextAreaField label="Do you have any preferences for the platform / technology to be used for the website? Or, open to best option which suites my business" />
          <TextAreaField label="Are there any specific requirements or preferences not mentioned above?" />
          <TextAreaField label="Please list down content pages you will have on your website? (Example: About Us, Privacy Policy, FAQs etc.)" />
          <TextAreaField label="Is there a specific deadline you have for the completion of the website? (Kindly note that website completion depends on the scope of work & is subject to extension if required)" />
          <TextAreaField label="Do you have any other suggestion, idea or requirements for the website?" />
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

              <div className={`pt-5 ${submitAllowed ? 'border-t border-slate-200' : ''}`}>
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">Disclaimer:</p>
                <div className="mt-3 space-y-4 text-sm leading-7 text-slate-600">
                  <p>
                    The following information will strictly be used for order fulfillment, and to have a clear
                    understanding of your business; it will not at all be distributed to any third party/service
                    vendor by us.
                  </p>
                  <p>
                    Your input is valuable to us, and we strongly encourage you to brief as much as you can.
                    However, we will be corresponding with you at every step of the process even after receiving
                    this document as a website varies enormously in content &amp; functionality. Any future
                    alterations to the following specifications will subject to additional charges or mutual
                    understandings. Carefully submit your details as it would be the building blocks for our
                    design work. Feel free to leave fields blank if not applicable.
                  </p>
                  <p>
                    In case of any concerns that you would like to discuss over the phone related to this form,
                    call us at <a href="tel:+4695011401" className="font-semibold text-orange-500 hover:text-orange-600">+46 950 114 01</a>.
                    Note: After design approval and during development phase you cannot ask to stop your project,
                    and no refunds will be applicable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {showCopyAction ? <BriefFormCopySection formType="website" /> : null}

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
