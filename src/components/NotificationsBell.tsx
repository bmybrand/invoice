'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type PendingRequest = {
  id: number
  name: string
  email: string
  brand_id: number
  created_at: string
}

function BellIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hasLoadedRequestsRef = useRef(false)
  const isFetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token?.trim() || ''
  }, [])

  const fetchRequests = useCallback(async (options?: { showLoading?: boolean }) => {
    if (isFetchingRef.current) {
      queuedRefreshRef.current = true
      return
    }

    const token = await getAccessToken()

    if (!token) {
      setRequests([])
      hasLoadedRequestsRef.current = false
      setLoading(false)
      return
    }

    const showLoading = options?.showLoading ?? !hasLoadedRequestsRef.current
    isFetchingRef.current = true

    if (showLoading) {
      setLoading(true)
    }

    try {
      const res = await fetch('/api/clients/registration-requests', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const json = await res.json()
        setRequests(json.requests ?? [])
        hasLoadedRequestsRef.current = true
      }
    } catch {
      // Keep the last successful list visible during transient refresh failures.
    } finally {
      isFetchingRef.current = false

      if (showLoading) {
        setLoading(false)
      }

      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false
        void fetchRequests()
      }
    }
  }, [getAccessToken])

  useEffect(() => {
    void fetchRequests({ showLoading: true })

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchRequests()
      }
    }, 5000)

    const channel = supabase
      .channel('admin-registration-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_registration_requests',
        },
        () => {
          void fetchRequests()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void fetchRequests()
        }
      })

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [fetchRequests])

  useEffect(() => {
    if (!open) return
    void fetchRequests({ showLoading: !hasLoadedRequestsRef.current })
  }, [open, fetchRequests])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', onOutside)
    return () => document.removeEventListener('click', onOutside)
  }, [open])

  async function handleApprove(id: number) {
    const token = await getAccessToken()
    if (!token) return

    setProcessingId(id)
    try {
      const res = await fetch(`/api/clients/registration-requests/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id))
        void fetchRequests()
      }
    } finally {
      setProcessingId(null)
    }
  }

  async function handleReject(id: number) {
    const token = await getAccessToken()
    if (!token) return

    setProcessingId(id)
    try {
      const res = await fetch(`/api/clients/registration-requests/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id))
        void fetchRequests()
      }
    } finally {
      setProcessingId(null)
    }
  }

  const count = requests.length

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800/80 hover:text-white"
        aria-label={count > 0 ? `${count} pending client request${count > 1 ? 's' : ''}` : 'Notifications'}
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-800 shadow-xl overflow-hidden">
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-bold text-white">Client Registration Requests</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {count === 0 ? 'No pending requests' : `${count} pending`}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">All caught up</div>
            ) : (
              requests.map((r) => (
                <div
                  key={r.id}
                  className="border-b border-slate-700/80 px-4 py-3 last:border-b-0 hover:bg-slate-700/30"
                >
                  <p className="text-sm font-medium text-white truncate">{r.name}</p>
                  <p className="text-xs text-slate-400 truncate">{r.email}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(r.id)}
                      disabled={processingId === r.id}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(r.id)}
                      disabled={processingId === r.id}
                      className="flex items-center gap-1 rounded-lg bg-red-500/20 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
