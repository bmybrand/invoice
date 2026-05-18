'use client'

import Image from 'next/image'
import Link from 'next/link'

type Option = {
  value: string
  label: string
}

const entityTypes: Option[] = [
  { value: 'sole', label: 'Sole Proprietor' },
  { value: 'llc', label: 'LLC' },
  { value: 'partnership', label: 'Partnership' },
  { value: 's-corp', label: 'S-Corp' },
  { value: 'c-corp', label: 'C-Corp' },
  { value: 'nonprofit', label: 'Nonprofit' },
]

const years: Option[] = [
  { value: '2022', label: '2022' },
  { value: '2023', label: '2023' },
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: 'ongoing', label: 'Ongoing monthly bookkeeping' },
]

const accountingSoftware: Option[] = [
  { value: 'qbo', label: 'QuickBooks Online' },
  { value: 'qbd', label: 'QuickBooks Desktop' },
  { value: 'xero', label: 'Xero' },
  { value: 'wave', label: 'Wave' },
  { value: 'freshbooks', label: 'FreshBooks' },
  { value: 'excel', label: 'Excel' },
  { value: 'none', label: 'None' },
]

const revenuePlatforms: Option[] = [
  { value: 'shopify', label: 'Shopify' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'square', label: 'Square' },
  { value: 'etsy', label: 'Etsy' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'other', label: 'Other' },
]

const expenseApps: Option[] = [
  { value: 'qb-receipts', label: 'QuickBooks Receipts' },
  { value: 'dext', label: 'Dext' },
  { value: 'expensify', label: 'Expensify' },
  { value: 'other', label: 'Other' },
]

const payrollProviders: Option[] = [
  { value: 'gusto', label: 'Gusto' },
  { value: 'adp', label: 'ADP' },
  { value: 'paychex', label: 'Paychex' },
  { value: 'qb-payroll', label: 'QuickBooks Payroll' },
  { value: 'other', label: 'Other' },
]

const serviceNeeds: Option[] = [
  { value: 'cleanup', label: 'Bookkeeping cleanup (2022-present)' },
  { value: 'monthly', label: 'Monthly bookkeeping' },
  { value: 'business-tax', label: 'Business tax preparation' },
  { value: 'personal-tax', label: 'Personal tax preparation (if passthrough)' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'sales-tax', label: 'Sales tax filings' },
  { value: 'tax-planning', label: 'Tax planning' },
]

const communicationMethods: Option[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'text', label: 'Text' },
  { value: 'portal', label: 'Client Portal' },
]

const timelineOptions: Option[] = [
  { value: 'asap', label: 'ASAP (urgent compliance)' },
  { value: '30-days', label: 'Within 30 days' },
  { value: 'standard', label: 'Standard timeline' },
]

const specialCases: Option[] = [
  { value: 'crypto', label: 'Crypto transactions' },
  { value: 'foreign-accounts', label: 'Foreign bank accounts' },
  { value: 'international', label: 'International business activity' },
  { value: 'none', label: 'None' },
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
}: {
  label: string
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-200">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
  )
}

function TextAreaField({
  label,
  placeholder,
  rows = 4,
}: {
  label: string
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-200">{label}</span>
      <textarea
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10"
      />
    </label>
  )
}

function ChoiceGroup({
  label,
  name,
  options,
  type = 'radio',
}: {
  label: string
  name: string
  options: Option[]
  type?: 'radio' | 'checkbox'
}) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-slate-200">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300 transition hover:border-slate-700"
          >
            <input
              type={type}
              name={name}
              value={option.value}
              className="h-4 w-4 accent-orange-500"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function FileField({ label, helper }: { label: string; helper?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-200">{label}</span>
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/55 p-4">
        <input
          type="file"
          className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-orange-600"
        />
        {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
      </div>
    </label>
  )
}

function SectionCard({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-800 bg-[#111827] p-5 sm:p-6">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-sm font-black text-orange-300">
          {number}
        </div>
        <div className="pb-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Section</p>
          <h2 className="mt-1.5 text-xl font-extrabold tracking-[-0.02em] text-white">{title}</h2>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

export default function BookkeepingTaxFilingPage() {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#0f172a]/95">
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-orange-500/40 to-transparent" />

      <div className="relative border-b border-slate-800/90 px-6 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">
              <Image src="/bmybrand-B.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
              BMYBrand Intake
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              Client Onboarding Questionnaire
            </h1>
            <p className="mt-2 text-lg font-semibold text-orange-300">
              Bookkeeping &amp; Tax Filing (2022-Present)
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
              Please complete this questionnaire so we can accurately assess your bookkeeping and tax filing
              needs from 2022 onward. Upload all supporting documents where applicable.
            </p>
          </div>

          <Link
            href="/dashboard/brief-forms"
            className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <BackIcon />
            Back to Brief Forms
          </Link>
        </div>
      </div>

      <form className="relative space-y-6 px-6 py-6 sm:px-8 sm:py-8">
        <SectionCard number="01" title="Basic Information">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Legal Business Name" placeholder="Legal Business Name" />
            <TextField label="DBA (if any)" placeholder="Doing Business As" />
          </div>
          <ChoiceGroup label="Entity Type" name="entityType" options={entityTypes} />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="EIN" placeholder="EIN" />
            <TextField label="Business Industry" placeholder="Industry" />
          </div>
          <TextField label="Business Address" placeholder="Street, City, State, Zip" />
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="Phone Number" placeholder="Phone Number" type="tel" />
            <TextField label="Email" placeholder="Email" type="email" />
          </div>
          <TextAreaField
            label="Owner / Shareholder Names & Ownership Percentages"
            placeholder="List owners/shareholders and ownership percentages"
          />
        </SectionCard>

        <SectionCard number="02" title="Engagement Scope">
          <ChoiceGroup label="What years do you need bookkeeping & tax filing for?" name="years" options={years} type="checkbox" />
          <ChoiceGroup
            label="Have any tax returns been filed for these years?"
            name="taxReturnsFiled"
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
          <FileField label="Upload any previously filed tax returns" />
          <ChoiceGroup
            label="Has any bookkeeping been done for these years?"
            name="bookkeepingDone"
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
        </SectionCard>

        <SectionCard number="03" title="Financial Accounts">
          <TextAreaField
            label="List all business bank accounts used since 2022"
            placeholder="Include bank name + last 4 digits"
          />
          <ChoiceGroup
            label="Do you use personal accounts for business transactions?"
            name="personalAccounts"
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
          <TextAreaField
            label="List all business credit cards used since 2022"
            placeholder="Card issuer + last 4 digits"
          />
          <ChoiceGroup
            label="Do you have business loans or financing?"
            name="loans"
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
          <FileField label="Upload loan agreements or financing documents" />
        </SectionCard>

        <SectionCard number="04" title="Accounting System">
          <ChoiceGroup label="Which accounting software do you use?" name="software" options={accountingSoftware} />
          <ChoiceGroup label="Do you track accounts receivable?" name="ar" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you track accounts payable?" name="ap" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you have inventory?" name="inventory" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you have fixed assets?" name="fixedAssets" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <FileField label="Upload purchase receipts or depreciation schedules" />
        </SectionCard>

        <SectionCard number="05" title="Income Details">
          <TextAreaField label="Describe how the business earns revenue" placeholder="Revenue sources and models" />
          <ChoiceGroup label="Which revenue platforms do you use?" name="platforms" options={revenuePlatforms} type="checkbox" />
          <TextField label="Other platform" placeholder="Other platform" />
          <TextField label="Do you issue invoices? If yes, through which system?" placeholder="Invoice system (if applicable)" />
        </SectionCard>

        <SectionCard number="06" title="Expense Details">
          <ChoiceGroup label="Do you use any expense-tracking apps?" name="expenseApps" options={expenseApps} type="checkbox" />
          <TextField label="Other app" placeholder="Other app" />
          <ChoiceGroup label="Do you pay contractors?" name="contractors" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you have W-9s for contractors?" name="w9" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you have employees?" name="employees" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Payroll Provider" name="payrollProvider" options={payrollProviders} />
        </SectionCard>

        <SectionCard number="07" title="Sales Tax & Compliance">
          <ChoiceGroup label="Are you required to collect or remit sales tax?" name="salesTaxRequired" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup
            label="Are sales tax returns filed for 2022-present?"
            name="salesTaxFiled"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'unsure', label: 'Unsure' },
            ]}
          />
        </SectionCard>

        <SectionCard number="08" title="IRS & State Notices">
          <ChoiceGroup label="Have you received IRS or state notices?" name="notices" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <FileField label="Upload copies of notices" />
        </SectionCard>

        <SectionCard number="09" title="Previous Accountant">
          <ChoiceGroup label="Did you have a prior CPA / bookkeeper?" name="priorAccountant" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup
            label="Do you have prior-year tax returns?"
            name="priorReturns"
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'help', label: 'Need help locating' },
            ]}
          />
          <FileField label="Upload prior-year returns (if available)" />
        </SectionCard>

        <SectionCard number="10" title="Business Operations">
          <ChoiceGroup label="Do you have company vehicles?" name="vehicles" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you track mileage?" name="mileage" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <ChoiceGroup label="Do you own business property or real estate?" name="realEstate" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          <TextAreaField
            label="List major purchases / sales since 2022"
            placeholder="Equipment, property, or other major transactions"
          />
          <ChoiceGroup label="Any of the following?" name="specialCases" options={specialCases} type="checkbox" />
        </SectionCard>

        <SectionCard number="11" title="Expectations & Preferences">
          <ChoiceGroup label="Which services do you need?" name="servicesNeeded" options={serviceNeeds} type="checkbox" />
          <ChoiceGroup label="Preferred communication method" name="communicationMethod" options={communicationMethods} />
          <ChoiceGroup label="How quickly do you need the work completed?" name="timeline" options={timelineOptions} />
        </SectionCard>

        <SectionCard number="12" title="Document Uploads">
          <FileField
            label="Upload any supporting documents"
            helper="Bank statements, credit card statements, loan documents, payroll reports, sales tax filings, IRS/state notices, or bookkeeping files."
          />
        </SectionCard>

        <div className="rounded-[1.75rem] border border-slate-800 bg-[#111827] px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-bold text-white">Ready to submit?</p>
              <p className="mt-1 text-sm text-slate-400">
                Review your answers and upload supporting files before sending this intake form.
              </p>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
            >
              Submit
            </button>
          </div>
        </div>

        <footer className="pb-2 text-center text-xs text-slate-500">
          © Copyright 2026 BMYBrand. All Rights Reserved
          <span className="mx-2 text-slate-700">|</span>
          Privacy Policy
          <span className="mx-2 text-slate-700">|</span>
          Terms &amp; Conditions
        </footer>
      </form>
    </section>
  )
}
