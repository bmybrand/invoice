'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

type Option = {
  value: string
  label: string
}

const websitePlatforms: Option[] = [
  { value: 'wordpress', label: 'WordPress' },
  { value: 'shopify', label: 'Shopify' },
  { value: 'wix', label: 'Wix' },
  { value: 'custom-cms', label: 'Custom CMS' },
  { value: 'other', label: 'Other' },
]

const accessOptions: Option[] = [
  { value: 'admin', label: 'Website Admin Panel' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'domain', label: 'Domain Registrar' },
  { value: 'ga', label: 'Google Analytics' },
  { value: 'gsc', label: 'Google Search Console' },
  { value: 'gbp', label: 'Google Business Profile' },
]

const seoGoals: Option[] = [
  { value: 'traffic', label: 'More traffic' },
  { value: 'leads', label: 'More leads' },
  { value: 'sales', label: 'More sales' },
  { value: 'appearance', label: 'Search appearance' },
]

const marketingChannels: Option[] = [
  { value: 'google-ads', label: 'Google Ads' },
  { value: 'facebook-ads', label: 'Facebook Ads' },
  { value: 'instagram-ads', label: 'Instagram Ads' },
  { value: 'linkedin-ads', label: 'LinkedIn Ads' },
  { value: 'email-marketing', label: 'Email Marketing' },
  { value: 'content-marketing', label: 'Content Marketing' },
]

const seoServices: Option[] = [
  { value: 'blog-writing', label: 'Blog Writing' },
  { value: 'on-page', label: 'On-Page SEO' },
  { value: 'technical', label: 'Technical SEO' },
  { value: 'local', label: 'Local SEO' },
  { value: 'link-building', label: 'Link Building' },
  { value: 'guest-posting', label: 'Guest Posting' },
  { value: 'content-optimization', label: 'Content Optimization' },
]

const timeZoneOptions = [
  'Pacific Time (PT) - GMT-8',
  'Mountain Time (MT) - GMT-7',
  'Central Time (CT) - GMT-6',
  'Eastern Time (ET) - GMT-5',
  'Atlantic Time (AT) - GMT-4',
  'Greenwich Mean Time (GMT) - GMT+0',
  'British Summer Time (BST) - GMT+1',
  'Central European Time (CET) - GMT+1',
  'Gulf Standard Time (GST) - GMT+4',
  'Pakistan Standard Time (PKT) - GMT+5',
  'India Standard Time (IST) - GMT+5:30',
  'Bangladesh Standard Time - GMT+6',
  'Singapore Time (SGT) - GMT+8',
  'Philippine Time (PHT) - GMT+8',
  'Japan Standard Time (JST) - GMT+9',
  'Australian Eastern Time (AET) - GMT+10',
  'New Zealand Time (NZT) - GMT+12',
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
}: {
  label: string
  placeholder?: string
  type?: string
  required?: boolean
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
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
  )
}

function TextAreaField({
  label,
  placeholder,
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

function SelectField({
  label,
  options,
  placeholder = 'Select an option',
  required = false,
}: {
  label: string
  options: string[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {required ? <span className="mr-1 text-slate-400">*</span> : null}
        {label}
      </span>
      <select
        defaultValue=""
        required={required}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
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

export default function SeoQuestionnaireForm({
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
      const publicUrl = new URL('/brief-forms/seo-questionnaire', window.location.origin).toString()
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
              SEO Questionnaire
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${publicView ? 'text-slate-600' : 'text-slate-400'}`}>
              Complete this questionnaire so we can understand your business, website, audience, and SEO goals
              before planning strategy, technical work, and reporting.
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
        <SectionCard title="Business Information">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="1. Full Name:" placeholder="Full Name" required />
            <TextField label="2. Company Name:" placeholder="Company Name" required />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="3. Website URL:" placeholder="https://yourwebsite.com" type="url" required />
            <TextField label="4. Business Email:" placeholder="Business Email" type="email" required />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="5. Phone Number:" placeholder="Phone Number" type="tel" required />
            <TextField label="7. Primary Contact Person:" placeholder="Primary Contact Person" required />
          </div>
          <TextField label="6. Business Address:" placeholder="Business Address" required />
          <SelectField label="8. Time Zone:" options={timeZoneOptions} placeholder="Time Zone" required />
        </SectionCard>

        <SectionCard title="Business Overview" subtitle="About Your Business">
          <TextAreaField label="1. What does your business do?" placeholder="Describe your business" />
          <TextAreaField label="2. What products or services do you offer?" placeholder="Products or services" />
          <TextAreaField label="3. What makes your business unique from competitors?" placeholder="Unique differentiators" />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="4. How long have you been in business?" placeholder="Years in business" />
            <TextField label="5. Which locations or countries do you target?" placeholder="Target markets" />
          </div>
          <TextField label="6. Do you serve local, national, or international customers?" placeholder="Service area" />
        </SectionCard>

        <SectionCard title="Business Goals">
          <TextAreaField label="1. What are your main business goals?" placeholder="Main business goals" />
          <ChoiceGroup label="2. What are your SEO goals?" name="seoGoals" options={seoGoals} type="checkbox" />
          <TextAreaField label="3. What results are you expecting from SEO?" placeholder="Expected results" />
        </SectionCard>

        <SectionCard title="Website Information" subtitle="Website Details">
          <ChoiceGroup label="1. What platform is your website built on?" name="platform" options={websitePlatforms} />
          <ChoiceGroup label="2. Do you have access to:" name="access" options={accessOptions} type="checkbox" />
          <ChoiceGroup label="3. Has SEO been done before?" name="seoDoneBefore" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="4. Have you worked with another SEO agency before?" name="priorAgency" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <TextAreaField label="5. Are there any previous penalties or issues with the website?" placeholder="Penalties or issues" required={false} />
          <ChoiceGroup label="6. Is the website mobile-friendly?" name="mobileFriendly" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Unsure' }]} />
          <TextAreaField label="7. Are there any technical issues you already know about?" placeholder="Known technical issues" required={false} />
        </SectionCard>

        <SectionCard title="Target Audience" subtitle="Customer Information">
          <TextAreaField label="1. Who are your ideal customers?" placeholder="Ideal customer profile" />
          <TextField label="2. Which locations are most important?" placeholder="Priority locations" />
          <TextAreaField label="3. What problems do your customers face?" placeholder="Customer pain points" />
          <TextAreaField label="4. What solutions do you provide?" placeholder="Your solutions" />
          <TextAreaField label="5. What keywords do you think customers search for?" placeholder="Keyword ideas" />
        </SectionCard>

        <SectionCard title="Competitor Information" subtitle="Competitors">
          <TextAreaField label="1. Who are your top competitors?" placeholder="Top competitors" />
          <TextAreaField label="2. Which competitor websites do you admire?" placeholder="Competitor websites" />
          <ChoiceGroup label="3. Are there competitors outranking you on Google?" name="outrankingCompetitors" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Unsure' }]} />
          <TextAreaField label="4. What services/products do competitors offer that you do not?" placeholder="Competitive gaps" />
        </SectionCard>

        <SectionCard title="SEO & SMM" subtitle="Current Marketing">
          <ChoiceGroup label="1. Are you currently running:" name="marketingChannels" options={marketingChannels} type="checkbox" />
          <ChoiceGroup label="2. Do you have social media profiles?" name="socialProfiles" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <TextField label="3. Which marketing channels bring the most leads?" placeholder="Best lead channels" />
          <ChoiceGroup label="4. Do you publish blogs or articles regularly?" name="blogs" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        </SectionCard>

        <SectionCard title="Keyword & Content Strategy">
          <ChoiceGroup label="1. Do you have target keywords?" name="targetKeywords" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <TextAreaField label="2. Which services/products are the highest priority?" placeholder="Highest-priority offers" />
          <TextAreaField label="3. Are there pages you want to rank first?" placeholder="Priority pages" />
          <ChoiceGroup label="4. Do you need:" name="seoServices" options={seoServices} type="checkbox" />
        </SectionCard>

        <SectionCard title="Local SEO Information" subtitle="Local Business Details">
          <ChoiceGroup label="1. Do you have a Google Business Profile?" name="gbp" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <TextField label="2. What are your business hours?" placeholder="Business hours" />
          <ChoiceGroup label="3. Do you serve multiple locations?" name="multiLocation" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="4. Are there location-specific pages on your website?" name="locationPages" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="5. Do you want to rank in Google Maps?" name="googleMaps" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        </SectionCard>

        <SectionCard title="Technical SEO Access" subtitle="Required Access">
          <ChoiceGroup
            label="Please provide access to:"
            name="technicalAccess"
            options={[
              { value: 'cms', label: 'Website CMS' },
              { value: 'hosting', label: 'Hosting Panel' },
              { value: 'domain', label: 'Domain Registrar' },
              { value: 'ga', label: 'Google Analytics' },
              { value: 'gsc', label: 'Google Search Console' },
              { value: 'gtm', label: 'Google Tag Manager' },
              { value: 'gbp', label: 'Google Business Profile' },
            ]}
            type="checkbox"
          />
        </SectionCard>

        <SectionCard title="Reporting & Communication" subtitle="Reporting Preferences">
          <ChoiceGroup label="1. Monthly Report" name="monthlyReport" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
        </SectionCard>

        <SectionCard title="Project Timeline & Budget" subtitle="Timeline">
          <TextField label="1. When would you like the project to start?" placeholder="Preferred start date" />
          <TextField label="2. Do you have any deadlines?" placeholder="Deadlines" />
          <TextField label="3. What is your monthly SEO budget?" placeholder="Monthly SEO budget" />
        </SectionCard>

        <SectionCard title="Additional Information">
          <TextAreaField label="1. Is there anything else we should know about your business?" placeholder="Additional details" />
          <TextAreaField label="2. Are there any special requirements or expectations?" placeholder="Requirements or expectations" />
          <TextAreaField label="3. Do you have reference websites or inspirations?" placeholder="Reference websites or inspirations" />
        </SectionCard>

        <SectionCard title="Client Declaration">
          <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4">
            <label className="flex items-start justify-between gap-4 text-sm leading-7 text-slate-600">
              <span>
                I confirm that the information provided above is accurate and complete to the best of my knowledge.
              </span>
              <input
                type="checkbox"
                name="clientDeclaration"
                className="mt-1 h-5 w-5 shrink-0 accent-orange-500"
              />
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <TextField label="Client Name" placeholder="Client Name" />
            <TextField label="Signature" placeholder="Signature" />
            <TextField label="Date" placeholder="Date" type="date" />
          </div>
        </SectionCard>

        {publicView ? (
          <div className="border border-slate-300 bg-white px-5 py-6 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                Submit
              </button>
              {submitNotice ? (
                <p className="text-sm font-medium text-emerald-600 sm:ml-auto">{submitNotice}</p>
              ) : null}
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
