'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type NotificationsBellProps = {
  accountType: 'employee' | 'client' | null
  displayRole: string
}

type PendingRequest = {
  id: number
  name: string
  email: string
  created_at: string
}

type MessageNotification = {
  clientId: number
  clientName: string
  clientEmail: string
  latestMessage: string
  latestMessageId?: number
  count: number
  createdAt: string
  handlerId?: string
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return ''

  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000))

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(timestamp).toLocaleDateString()
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

function ChatBubbleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.5h8m-8 3h5.5M6.75 18l-2.5 1.75V6.75A2.25 2.25 0 016.5 4.5h11A2.25 2.25 0 0119.75 6.75v7.5A2.25 2.25 0 0117.5 16.5H9.75L6.75 18z" />
    </svg>
  )
}

export function NotificationsBell({ accountType, displayRole }: NotificationsBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [messages, setMessages] = useState<MessageNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const hasLoadedRef = useRef(false)
  const isFetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const notifiedMessageIdsRef = useRef<Set<number>>(new Set())
  const pushSetupStartedRef = useRef(false)

  const normalizedRole = useMemo(() => normalizeRole(displayRole || ''), [displayRole])
  const isAdminBell = accountType === 'employee' && (normalizedRole === 'admin' || normalizedRole === 'superadmin')
  const isUserBell = accountType === 'employee' && normalizedRole === 'user'
  const shouldShowBell = isAdminBell || isUserBell

  const maybeNotifyDesktop = useCallback((nextMessages: MessageNotification[]) => {
    if (!isUserBell || typeof window === 'undefined' || !('Notification' in window)) {
      return
    }

    if (Notification.permission !== 'granted') {
      return
    }

    const shouldSurfaceDesktopNotification =
      document.visibilityState !== 'visible' || !document.hasFocus()

    if (!shouldSurfaceDesktopNotification) {
      return
    }

    for (const item of nextMessages) {
      const latestMessageId = Number(item.latestMessageId ?? 0)
      if (!Number.isFinite(latestMessageId) || latestMessageId <= 0) continue
      if (notifiedMessageIdsRef.current.has(latestMessageId)) continue

      const notification = new Notification(`New message from ${item.clientName}`, {
        body: item.latestMessage || item.clientEmail || 'Open chat to reply.',
        tag: `client-chat-${item.clientId}-${latestMessageId}`,
      })

      notification.onclick = () => {
        window.focus()
        router.push('/dashboard/clients')
        notification.close()
      }

      notifiedMessageIdsRef.current.add(latestMessageId)
    }
  }, [isUserBell, router])

  const getAccessToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return session?.access_token?.trim() || ''
  }, [])

  const fetchNotifications = useCallback(async (options?: { showLoading?: boolean; forceDesktopNotify?: boolean }) => {
    if (!shouldShowBell) return

    if (isFetchingRef.current) {
      queuedRefreshRef.current = true
      return
    }

    const token = await getAccessToken()

    if (!token) {
      setRequests([])
      setMessages([])
      hasLoadedRef.current = false
      setLoading(false)
      return
    }

    const showLoading = options?.showLoading ?? !hasLoadedRef.current
    isFetchingRef.current = true

    if (showLoading) {
      setLoading(true)
    }

    try {
      if (isAdminBell) {
        const requestsRes = await fetch('/api/clients/registration-requests', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!requestsRes.ok) return

        const requestsJson = await requestsRes.json()
        setRequests(requestsJson?.requests ?? [])
        setMessages([])
      } else {
        const res = await fetch('/api/client-chat/notifications', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) return

        const json = await res.json()
        const nextMessages = json.items ?? []
        setMessages(nextMessages)
        maybeNotifyDesktop(nextMessages)
        setRequests([])
      }
      hasLoadedRef.current = true
    } catch {
      // Keep last good notifications visible during refresh failures.
    } finally {
      isFetchingRef.current = false

      if (showLoading) {
        setLoading(false)
      }

      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false
        void fetchNotifications()
      }
    }
  }, [getAccessToken, isAdminBell, maybeNotifyDesktop, shouldShowBell])

  useEffect(() => {
    if (!isUserBell || typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'default') return

    const requestPermission = async () => {
      try {
        await Notification.requestPermission()
      } catch {
        // Ignore permission prompt failures.
      }
    }

    const timeoutId = window.setTimeout(() => {
      void requestPermission()
    }, 1200)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isUserBell])

  useEffect(() => {
    if (!isUserBell || typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!VAPID_PUBLIC_KEY || pushSetupStartedRef.current) return

    pushSetupStartedRef.current = true
    let cancelled = false

    const setupPush = async () => {
      const token = await getAccessToken()
      if (!token || Notification.permission !== 'granted') return

      await navigator.serviceWorker.register('/sw.js')
      const readyRegistration = await navigator.serviceWorker.ready
      if (cancelled) return

      let subscription = await readyRegistration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
        }),
      })

    }

    void setupPush().finally(() => {
      if (!cancelled) {
        pushSetupStartedRef.current = false
      }
    })

    return () => {
      cancelled = true
    }
  }, [getAccessToken, isUserBell])

  useEffect(() => {
    if (!shouldShowBell) return

    void fetchNotifications({ showLoading: true })

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications()
      }
    }, 5000)

    const channels = []

    if (isUserBell) {
      channels.push(
        supabase
          .channel('handler-chat-notifications')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'client_chat_messages',
            },
            (payload) => {
              void fetchNotifications({
                forceDesktopNotify: payload.eventType === 'INSERT',
              })
            }
          )
      )
    }

    if (isAdminBell) {
      channels.push(
        supabase
          .channel('admin-registration-requests-clients')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'clients',
            },
            () => {
              void fetchNotifications()
            }
          )
      )
    }

    channels.forEach((channel) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void fetchNotifications()
        }
      })
    })

    return () => {
      window.clearInterval(intervalId)
      channels.forEach((channel) => {
        void supabase.removeChannel(channel)
      })
    }
  }, [fetchNotifications, isAdminBell, isUserBell, shouldShowBell])

  useEffect(() => {
    if (!open || !shouldShowBell) return
    void fetchNotifications({ showLoading: !hasLoadedRef.current })
  }, [fetchNotifications, open, shouldShowBell])

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
        void fetchNotifications()
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
        void fetchNotifications()
      }
    } finally {
      setProcessingId(null)
    }
  }

  const messageCount = messages.reduce((total, item) => total + item.count, 0)
  const count = isAdminBell ? requests.length : messageCount

  if (!shouldShowBell) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400 transition hover:border-slate-700 hover:bg-slate-800/80 hover:text-white"
        aria-label={
          isAdminBell
            ? count > 0
              ? `${count} pending client request${count > 1 ? 's' : ''}`
              : 'Notifications'
            : count > 0
              ? `${count} unread client message${count > 1 ? 's' : ''}`
              : 'Notifications'
        }
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl">
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-bold text-white">{isAdminBell ? 'Client Registration Requests' : 'Client Messages'}</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {count === 0 ? (isAdminBell ? 'No pending requests' : 'All caught up') : isAdminBell ? `${count} pending` : `${count} unread`}
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Loading...</div>
            ) : isAdminBell ? (
              requests.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">All caught up</div>
              ) : (
                <>
                  {requests.map((r) => (
                    <div
                      key={`request-${r.id}`}
                      className="border-b border-slate-700/80 px-4 py-3 last:border-b-0 hover:bg-slate-700/30"
                    >
                      <p className="truncate text-sm font-medium text-white">{r.name}</p>
                      <p className="truncate text-xs text-slate-400">{r.email}</p>
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
                  ))}
                </>
              )
            ) : messages.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">All caught up</div>
            ) : (
              messages.map((item) => (
                <button
                  key={item.clientId}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    router.push('/dashboard/clients')
                  }}
                  className="flex w-full items-start gap-3 border-b border-slate-700/80 px-4 py-3 text-left transition hover:bg-slate-700/30 last:border-b-0"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
                    <ChatBubbleIcon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium text-white">{item.clientName}</p>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-400">{item.clientEmail}</p>
                    <p className="mt-1 truncate text-xs text-slate-300">{item.latestMessage}</p>
                  </div>
                  <span className="mt-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-bold text-white">
                    {item.count > 99 ? '99+' : item.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
