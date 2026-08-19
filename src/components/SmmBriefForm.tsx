'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { BriefFormPrefill } from '@/lib/brief-form-prefill'
import { canSubmitBriefForm } from '@/lib/brief-form-access'
import { useBriefFormSubmit } from '@/lib/use-brief-form-submit'
import { BriefFormCopyButton, BriefFormCopySection, BriefFormSubmitBar } from '@/components/brief-forms/BriefFormActions'

type Option = {
  value: string
  label: string
}

const yesNoOptions: Option[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const decisionMakerOptions: Option[] = [
  { value: 'dentist-practice-owner', label: 'Dentist / Dental Practice Owner' },
  { value: 'physician-practice-owner', label: 'Physician / Medical Practice Owner' },
  { value: 'practice-administrator', label: 'Practice Administrator' },
  { value: 'practice-manager', label: 'Practice Manager' },
  { value: 'healthcare-executive', label: 'Healthcare Executive' },
  { value: 'multi-location-practice', label: 'Multi-location Practice' },
  { value: 'dso-medical-group', label: 'DSO / Medical Group' },
]

const specialtyOptions: Option[] = [
  { value: 'dental', label: 'Dental' },
  { value: 'orthodontics', label: 'Orthodontics' },
  { value: 'oral-surgery', label: 'Oral Surgery' },
  { value: 'primary-care', label: 'Primary Care' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'behavioral-health', label: 'Behavioral Health' },
  { value: 'dermatology', label: 'Dermatology' },
]

const practiceFocusOptions: Option[] = [
  { value: 'individual-practices', label: 'Individual practices' },
  { value: 'multi-location-practices', label: 'Multi-location practices' },
  { value: 'larger-healthcare-organizations', label: 'Larger healthcare organizations' },
  { value: 'combination', label: 'A combination of the above' },
]

const caseStudyResultOptions: Option[] = [
  { value: 'revenue-recovered', label: 'Revenue recovered' },
  { value: 'ar-reduced', label: 'A/R reduced' },
  { value: 'collection-rate-improved', label: 'Collection rate improved' },
  { value: 'denials-reduced', label: 'Denials reduced' },
  { value: 'revenue-increased', label: 'Revenue increased' },
  { value: 'operational-efficiency-improved', label: 'Operational efficiency improved' },
]

const namingOptions: Option[] = [
  { value: 'named-publicly', label: 'Clients/results can be named publicly' },
  { value: 'anonymize', label: 'Anonymize them' },
]

const marketingAssetOptions: Option[] = [
  { value: 'team-photos', label: 'Team photos' },
  { value: 'professional-headshots', label: 'Professional headshots' },
  { value: 'office-photos', label: 'Office photos' },
  { value: 'videos', label: 'Videos' },
  { value: 'client-testimonials', label: 'Client testimonials' },
  { value: 'case-studies', label: 'Case studies' },
  { value: 'presentations', label: 'Presentations' },
  { value: 'brochures', label: 'Brochures' },
  { value: 'existing-graphics', label: 'Existing graphics' },
  { value: 'educational-material', label: 'Educational material' },
]

const founderVideoOptions: Option[] = [
  { value: 'yes-both', label: 'Yes, both Sabrina and Christal' },
  { value: 'sabrina-only', label: 'Sabrina only' },
  { value: 'christal-only', label: 'Christal only' },
  { value: 'no', label: 'No' },
]

const brandPerceptionOptions: Option[] = [
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'strategic', label: 'Strategic' },
  { value: 'premium', label: 'Premium' },
  { value: 'trustworthy', label: 'Trustworthy' },
  { value: 'direct', label: 'Direct' },
  { value: 'data-driven', label: 'Data-driven' },
  { value: 'educational', label: 'Educational' },
  { value: 'sophisticated', label: 'Sophisticated' },
  { value: 'approachable', label: 'Approachable' },
  { value: 'results-focused', label: 'Results-focused' },
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
  hint,
}: {
  label: string
  placeholder?: string
  rows?: number
  required?: boolean
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {required ? <span className="mr-1 text-slate-400">*</span> : null}
        {label}
      </span>
      {hint ? <span className="mb-2 block text-sm font-medium text-slate-500">{hint}</span> : null}
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
  hint,
}: {
  label: string
  name: string
  options: Option[]
  type?: 'radio' | 'checkbox'
  required?: boolean
  hint?: string
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-slate-700">
        {required ? <span className="mr-1 text-slate-400">*</span> : null}
        {label}
      </legend>
      {hint ? <p className="-mt-1 mb-3 text-sm font-medium text-slate-500">{hint}</p> : null}
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

export default function SmmBriefForm({
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
  const { submitting, submitNotice, submitError, handleSubmit } = useBriefFormSubmit('smm')

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
              SMM Brief Questionnaire
            </h1>
            <p className={`mt-4 max-w-3xl text-sm leading-7 sm:text-base ${publicView ? 'text-slate-600' : 'text-slate-400'}`}>
              Capture business priorities, target audience, competitors, brand perception, and content
              assets before social media marketing begins.
            </p>
          </div>

          {backHref && backLabel ? (
            <div className="flex flex-wrap items-center gap-2 self-start">
              <BriefFormCopyButton formType="smm" publicView={publicView} />
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
        <SectionCard title="Basic Information">
          <TextField label="Company / Brand Name:" placeholder="Your Company or Brand Name" required defaultValue={prefill.clientName} />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Your Full Name:" placeholder="Your Full Name" required defaultValue={prefill.contactPerson} />
            <TextField label="Email Address:" placeholder="Your Email Address" type="email" required defaultValue={prefill.email} />
          </div>
          <TextField label="Phone Number:" placeholder="Phone Number" type="tel" required defaultValue={prefill.phone} />
        </SectionCard>

        <SectionCard title="1. Business Priorities">
          <TextAreaField
            label="Q1. Which 3–5 services would you like Iron Claw to prioritize for marketing over the next 6–12 months?"
            placeholder="List 3–5 priority services"
          />
          <TextAreaField
            label="Q2. Which services currently generate the most revenue for the company?"
            placeholder="Highest-revenue services"
          />
          <TextAreaField
            label="Q3. Which services have the highest profit margin?"
            placeholder="Highest-margin services"
          />
          <TextAreaField
            label="Q4. Are there any services you specifically want to grow, even if they currently generate fewer clients?"
            placeholder="Growth-priority services"
          />
          <TextAreaField
            label="Q5. Are there any services you do NOT want us to actively promote right now?"
            placeholder="Services to deprioritize"
          />
          <TextAreaField
            label="Q6. Describe your ideal Iron Claw client."
            placeholder="Ideal client profile"
          />
          <ChoiceGroup
            label="Then rank your top 3 target decision-makers."
            name="targetDecisionMakers"
            options={decisionMakerOptions}
            type="checkbox"
            hint="Select the roles that matter most, then rank your top 3 below."
          />
          <TextField
            label="Rank your top 3 target decision-makers in order"
            placeholder="1. Practice Owner, 2. Practice Administrator, 3. Healthcare Executive"
          />
          <ChoiceGroup
            label="Q7. Rank the top 3–5 healthcare or dental specialties that should receive the majority of our marketing effort."
            name="prioritySpecialties"
            options={specialtyOptions}
            type="checkbox"
            hint="Select the specialties that should receive the majority of marketing effort."
          />
          <TextField label="Other specialties (if any)" placeholder="e.g. Pediatrics, ENT" />
          <TextField
            label="Rank your top 3–5 specialties in order"
            placeholder="1. Dental, 2. Orthodontics, 3. Primary Care"
          />
          <ChoiceGroup
            label="Q8. Do you want us to focus on individual practices, multi-location practices, or larger healthcare organizations?"
            name="practiceFocus"
            options={practiceFocusOptions}
          />
          <TextAreaField
            label="Q9. Are you targeting clients nationwide, or are there specific states/cities you want us to prioritize?"
            placeholder="Nationwide, or list priority states and cities"
          />
          <TextAreaField
            label="Q10. Which states currently have the strongest client base or business opportunities for Iron Claw?"
            placeholder="Strongest current states"
          />
          <TextAreaField
            label="Q11. Are there specific states where you want to expand over the next 6–12 months?"
            placeholder="Expansion states"
          />
        </SectionCard>

        <SectionCard title="2. Competitors & Positioning">
          <TextAreaField
            label="Q12. Who do you consider your top 3–5 competitors?"
            placeholder="Top competitors"
          />
          <TextAreaField
            label="Q13. Why should a practice choose Iron Claw instead of another RCM or healthcare consulting company?"
            placeholder="Why Iron Claw"
          />
          <TextAreaField
            label="Q14. What do you believe is Iron Claw's strongest competitive advantage?"
            placeholder="Strongest competitive advantage"
          />
          <ChoiceGroup
            label="Q15. Do you have client case studies or measurable results we can use in social media?"
            name="caseStudiesAvailable"
            options={yesNoOptions}
          />
          <ChoiceGroup
            label="Which results can we use?"
            name="caseStudyResults"
            options={caseStudyResultOptions}
            type="checkbox"
            hint="For example: revenue recovered, A/R reduced, collection rate improved, denials reduced, revenue increased, operational efficiency improved."
          />
          <TextAreaField
            label="Case study or results details"
            placeholder="Share links, numbers, or notes we can use"
          />
          <ChoiceGroup
            label="Q16. Do you have client testimonials that we can publish?"
            name="testimonialsAvailable"
            options={yesNoOptions}
          />
          <TextAreaField
            label="Testimonial details or links"
            placeholder="Paste testimonials or share where we can find them"
          />
          <ChoiceGroup
            label="Q17. Can clients/results be named publicly, or do we need to anonymize them?"
            name="clientNaming"
            options={namingOptions}
          />
        </SectionCard>

        <SectionCard title="3. Content Material">
          <ChoiceGroup
            label="Q18. What existing marketing assets do you have?"
            name="marketingAssets"
            options={marketingAssetOptions}
            type="checkbox"
          />
          <TextAreaField
            label="Asset links or notes"
            placeholder="Drive folders, Dropbox links, or notes about available assets"
          />
          <ChoiceGroup
            label="Q19. Are Sabrina and Christal available to appear in short educational videos/reels?"
            name="founderVideoAvailability"
            options={founderVideoOptions}
          />
          <ChoiceGroup
            label="Q20. Does Iron Claw currently have any social media accounts, including inactive, unpublished, or recently created accounts?"
            name="socialAccountsExist"
            options={yesNoOptions}
          />
          <p className="text-sm font-semibold text-slate-700">Please provide URLs/access for:</p>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="LinkedIn" placeholder="https://linkedin.com/company/..." />
            <TextField label="Facebook" placeholder="https://facebook.com/..." />
            <TextField label="Instagram" placeholder="https://instagram.com/..." />
            <TextField label="YouTube" placeholder="https://youtube.com/..." />
            <TextField label="X" placeholder="https://x.com/..." />
            <TextField label="TikTok" placeholder="https://tiktok.com/@..." />
          </div>
          <TextAreaField
            label="Social account access notes"
            placeholder="Login details, admin emails, or who currently manages each account"
          />
          <TextAreaField
            label="Q21. Are there topics either founder does not want to discuss publicly?"
            placeholder="Off-limits topics"
          />
          <ChoiceGroup
            label="Q22. How should Iron Claw be perceived by its audience? Please select the 3–5 most important characteristics."
            name="brandPerception"
            options={brandPerceptionOptions}
            type="checkbox"
            hint="Select the 3–5 most important characteristics."
          />
          <TextAreaField
            label="Q23. Are there words, phrases, topics, visual styles, or tones that you do NOT want associated with Iron Claw?"
            placeholder="Words, phrases, topics, styles, or tones to avoid"
          />
          <TextAreaField
            label="Q24. Are there companies or brands whose communication or social media style you admire?"
            placeholder="Brands whose social style you admire"
          />
        </SectionCard>

        {showCopyAction ? (
          <BriefFormCopySection formType="smm" />
        ) : null}

        <BriefFormSubmitBar
          canSubmit={submitAllowed}
          submitting={submitting}
          submitNotice={submitNotice}
          submitError={submitError}
          submitLabel="Submit SMM Brief"
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
