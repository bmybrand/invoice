'use client'

import { useState } from 'react'
import type { BriefFormType } from '@/lib/brief-form-types'
import { getBriefFormPublicUrl } from '@/lib/brief-form-public-url'

type CopyState = 'idle' | 'copied' | 'error'

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="8" y="8" width="10" height="11" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1" />
    </svg>
  )
}

export function BriefFormCopyButton({
  formType,
  publicView = false,
}: {
  formType: BriefFormType
  publicView?: boolean
}) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getBriefFormPublicUrl(formType))
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopyLink}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        publicView
          ? 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-950'
          : 'border border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
      }`}
    >
      <CopyIcon />
      {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy Failed' : 'Copy Link'}
    </button>
  )
}

export function BriefFormCopySection({ formType }: { formType: BriefFormType }) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  async function handleCopyLink() {
    try {
      const publicUrl = getBriefFormPublicUrl(formType)
      await navigator.clipboard.writeText(publicUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <div className="border border-slate-300 bg-white px-5 py-6 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold text-slate-950">Send to client</p>
          <p className="mt-1 text-sm text-slate-500">
            Copy the public link on your brand site and send it to your client so they can complete and
            submit the form.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 transition hover:border-slate-400"
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy Failed' : 'Copy Link'}
        </button>
      </div>
    </div>
  )
}

export function BriefFormSubmitBar({
  canSubmit = true,
  submitting,
  submitNotice,
  submitError,
  submitLabel = 'Submit',
  children,
}: {
  canSubmit?: boolean
  submitting: boolean
  submitNotice: string
  submitError: string
  submitLabel?: string
  children?: React.ReactNode
}) {
  if (!canSubmit && !children) {
    return null
  }

  return (
    <div className="space-y-5">
      {children}

      {canSubmit ? (
        <div className="sticky bottom-0 z-10 border border-slate-300 bg-white/95 px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center self-start rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : submitLabel}
            </button>
            {submitError ? (
              <p className="text-sm font-medium text-rose-600 sm:ml-auto">{submitError}</p>
            ) : submitNotice ? (
              <p className="text-sm font-medium text-emerald-600 sm:ml-auto">{submitNotice}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
