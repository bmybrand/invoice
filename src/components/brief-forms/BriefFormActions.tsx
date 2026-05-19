'use client'

type CopyState = 'idle' | 'copied' | 'error'

export function BriefFormCopySection({
  copyState,
  onCopyLink,
}: {
  copyState: CopyState
  onCopyLink: () => void
}) {
  return (
    <div className="border border-slate-300 bg-white px-5 py-6 sm:px-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold text-slate-950">Send to client</p>
          <p className="mt-1 text-sm text-slate-500">
            Copy the public link and send it to your client so they can complete and submit the form.
          </p>
        </div>
        <button
          type="button"
          onClick={onCopyLink}
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
