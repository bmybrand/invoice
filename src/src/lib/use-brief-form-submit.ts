'use client'

import { useState } from 'react'
import type { BriefFormType } from '@/lib/brief-form-types'
import { submitBriefForm } from '@/lib/submit-brief-form'

export function useBriefFormSubmit(formType: BriefFormType) {
  const [submitting, setSubmitting] = useState(false)
  const [submitNotice, setSubmitNotice] = useState('')
  const [submitError, setSubmitError] = useState('')

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
    options: {
      showCopyAction: boolean
      canSubmit?: boolean
      extra?: Record<string, unknown>
      validate?: () => string | null
    }
  ) {
    if (options.showCopyAction) {
      return
    }

    event.preventDefault()

    if (options.canSubmit === false) {
      setSubmitError('Only clients can submit this form.')
      return
    }
    setSubmitNotice('')
    setSubmitError('')

    const validationError = options.validate?.()
    if (validationError) {
      setSubmitError(validationError)
      return
    }

    const form = event.currentTarget
    setSubmitting(true)
    try {
      const result = await submitBriefForm(formType, form, options.extra)
      if (!result.ok) {
        setSubmitError(result.error)
        return
      }

      setSubmitNotice('Successfully submitted.')
      try {
        form.reset()
      } catch {
        // currentTarget can be cleared after await; save already succeeded
      }
    } catch (error) {
      console.error('[brief-form] submit failed:', error)
      setSubmitError('Could not submit the form. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    submitting,
    submitNotice,
    submitError,
    handleSubmit,
    setSubmitNotice,
    setSubmitError,
  }
}
