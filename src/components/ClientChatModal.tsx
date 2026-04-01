'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import type { RealtimeChannel } from '@supabase/supabase-js'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })
const CHAT_REFRESH_MS = 3000
const TYPING_STOP_DELAY_MS = 1800

type ChatMessage = {
  id: number
  clientId: number
  senderAuthId: string
  senderName: string
  message: string
  attachmentName: string
  attachmentUrl: string | null
  createdAt: string | null
  updatedAt: string | null
  isOwnMessage: boolean
}

type ChatResponse = {
  client: {
    id: number
    name: string
    email: string
    handlerName: string
  }
  messages: ChatMessage[]
}

type ChatInvoice = {
  id: number
  invoiceDate: string | null
  amount: string
  payableAmount: number | null
  status: string
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function AttachmentIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18.375 12.739l-6.315 6.315a4.5 4.5 0 11-6.364-6.364l7.425-7.425a3 3 0 114.243 4.243l-7.425 7.425a1.5 1.5 0 11-2.121-2.121l6.364-6.364"
      />
    </svg>
  )
}

function SendIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0121.485 12 59.77 59.77 0 013.27 20.875L6 12zm0 0h7.5" />
    </svg>
  )
}

function initials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  return (tokens[0]?.[0] || '') + (tokens[1]?.[0] || tokens[0]?.[1] || '')
}

function formatStamp(value: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function matchesOptimisticMessage(serverMessage: ChatMessage, optimisticMessage: ChatMessage) {
  return (
    serverMessage.senderAuthId === optimisticMessage.senderAuthId &&
    serverMessage.message === optimisticMessage.message &&
    serverMessage.attachmentName === optimisticMessage.attachmentName
  )
}

function formatInvoiceAmount(invoice: ChatInvoice) {
  const amountSource = invoice.payableAmount != null ? invoice.payableAmount : Number(invoice.amount || 0)
  const amount = Number.isFinite(amountSource) ? amountSource : 0
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatInvoiceDate(value: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function invoiceStatusClass(status: string) {
  const value = (status || '').trim().toLowerCase()
  if (value.includes('paid') || value.includes('completed')) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
  if (value.includes('processing')) return 'border-sky-500/20 bg-sky-500/10 text-sky-300'
  if (value.includes('overdue') || value.includes('cancel')) return 'border-rose-500/20 bg-rose-500/10 text-rose-300'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-300'
}

export function ClientChatModal({
  open,
  clientId,
  title,
  subtitle,
  onClose,
}: {
  open: boolean
  clientId: number | null
  title: string
  subtitle?: string
  onClose: () => void
}) {
  const router = useRouter()
  const { accountType, currentUserAuthId, displayName } = useDashboardProfile()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [headerTitle, setHeaderTitle] = useState(title)
  const [headerSubtitle, setHeaderSubtitle] = useState(subtitle || '')
  const [typingLabel, setTypingLabel] = useState('')
  const [invoices, setInvoices] = useState<ChatInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const fetchVersionRef = useRef(0)
  const mutationVersionRef = useRef(0)
  const suppressRefreshRef = useRef(false)
  const suppressRefreshTimeoutRef = useRef<number | null>(null)
  const optimisticMessagesRef = useRef<ChatMessage[]>([])
  const pendingDeletedIdsRef = useRef<Set<number>>(new Set())
  const typingTimeoutRef = useRef<number | null>(null)
  const remoteTypingTimeoutRef = useRef<number | null>(null)
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const invoiceFetchVersionRef = useRef(0)

  const getCurrentAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token?.trim()) return session.access_token.trim()
    const { data, error } = await supabase.auth.refreshSession()
    if (error) return ''
    return data.session?.access_token?.trim() || ''
  }, [])

  const loadMessages = useCallback(
    async (options?: { background?: boolean }) => {
      if (!open || !clientId) return
      const isBackground = options?.background ?? false
      const fetchVersion = ++fetchVersionRef.current
      const mutationVersionAtStart = mutationVersionRef.current
      if (!isBackground) {
        setLoading(true)
      }
      setError(null)

      const token = await getCurrentAuthToken()
      if (!token) {
        setLoading(false)
        setError('Authentication expired. Sign in again and try again.')
        return
      }

      const response = await fetch(`/api/client-chat/${clientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const result = (await response.json().catch(() => null)) as ChatResponse & { error?: string }

      if (fetchVersion !== fetchVersionRef.current || mutationVersionAtStart !== mutationVersionRef.current) {
        return
      }

      if (!response.ok) {
        setLoading(false)
        setError(result?.error || 'Failed to load chat')
        return
      }

      const serverMessages = (result.messages || []).filter((message) => !pendingDeletedIdsRef.current.has(message.id))
      const remainingOptimisticMessages = optimisticMessagesRef.current.filter(
        (optimisticMessage) =>
          !serverMessages.some((serverMessage) => matchesOptimisticMessage(serverMessage, optimisticMessage))
      )
      optimisticMessagesRef.current = remainingOptimisticMessages

      setMessages(
        [...serverMessages, ...remainingOptimisticMessages].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return aTime - bTime
        })
      )
      if (result.client?.name) {
        if (accountType === 'client') {
          setHeaderTitle(result.client.handlerName ? `Chat with ${result.client.handlerName}` : 'Chat')
          setHeaderSubtitle(result.client.email || '')
        } else {
          setHeaderTitle(result.client.name)
          setHeaderSubtitle(result.client.email || '')
        }
      }
      setLoading(false)
    },
    [accountType, clientId, getCurrentAuthToken, open]
  )

  const suppressPolling = useCallback((delayMs = CHAT_REFRESH_MS) => {
    suppressRefreshRef.current = true
    if (suppressRefreshTimeoutRef.current !== null) {
      window.clearTimeout(suppressRefreshTimeoutRef.current)
    }
    suppressRefreshTimeoutRef.current = window.setTimeout(() => {
      suppressRefreshRef.current = false
      suppressRefreshTimeoutRef.current = null
    }, delayMs)
  }, [])

  const typingChannelName = useMemo(
    () => (clientId ? `client-chat-typing-${clientId}` : null),
    [clientId]
  )

  const broadcastTyping = useCallback(
    async (isTyping: boolean) => {
      if (!currentUserAuthId || !typingChannelRef.current) return

      await typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          clientId,
          authId: currentUserAuthId,
          name: displayName || (accountType === 'client' ? 'Client' : 'User'),
          isTyping,
        },
      })
    },
    [accountType, clientId, currentUserAuthId, displayName]
  )

  useEffect(() => {
    if (!open || !clientId) return

    const timeoutId = window.setTimeout(() => {
      void loadMessages()
    }, 0)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !suppressRefreshRef.current) {
        void loadMessages({ background: true })
      }
    }, CHAT_REFRESH_MS)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      if (suppressRefreshTimeoutRef.current !== null) {
        window.clearTimeout(suppressRefreshTimeoutRef.current)
      }
    }
  }, [clientId, loadMessages, open])

  useEffect(() => {
    if (!open || !typingChannelName) return

    const channel = supabase
      .channel(typingChannelName)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const nextAuthId = String(payload?.authId ?? '')
        if (!nextAuthId || nextAuthId === currentUserAuthId) return

        if (remoteTypingTimeoutRef.current !== null) {
          window.clearTimeout(remoteTypingTimeoutRef.current)
        }

        if (!payload?.isTyping) {
          setTypingLabel('')
          return
        }

        const nextName = String(payload?.name ?? '').trim() || 'Someone'
        setTypingLabel(`${nextName} is typing...`)
        remoteTypingTimeoutRef.current = window.setTimeout(() => {
          setTypingLabel('')
          remoteTypingTimeoutRef.current = null
        }, TYPING_STOP_DELAY_MS + 800)
      })
      .subscribe()
    typingChannelRef.current = channel

    return () => {
      if (remoteTypingTimeoutRef.current !== null) {
        window.clearTimeout(remoteTypingTimeoutRef.current)
        remoteTypingTimeoutRef.current = null
      }
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      void broadcastTyping(false)
      setTypingLabel('')
      typingChannelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [broadcastTyping, currentUserAuthId, open, typingChannelName])

  useEffect(() => {
    if (!open) return

    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    if (!draft.trim()) {
      void broadcastTyping(false)
      return
    }

    void broadcastTyping(true)
    typingTimeoutRef.current = window.setTimeout(() => {
      void broadcastTyping(false)
      typingTimeoutRef.current = null
    }, TYPING_STOP_DELAY_MS)

    return () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
    }
  }, [broadcastTyping, draft, open])

  useEffect(() => {
    if (!open) return
    const node = messagesRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (!open || !clientId) return

    let cancelled = false
    const fetchVersion = ++invoiceFetchVersionRef.current

    async function loadInvoices() {
      setInvoicesLoading(true)
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_date, amount, payable_amount, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(8)

      if (cancelled || fetchVersion !== invoiceFetchVersionRef.current) return

      if (error) {
        console.error('Failed to load client invoices', error)
        setInvoices([])
        setInvoicesLoading(false)
        return
      }

      setInvoices(
        ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
          id: Number(row.id ?? 0),
          invoiceDate: (row.invoice_date as string | null) ?? null,
          amount: String(row.amount ?? ''),
          payableAmount: row.payable_amount == null ? null : Number(row.payable_amount),
          status: String(row.status ?? 'Pending'),
        }))
      )
      setInvoicesLoading(false)
    }

    void loadInvoices()

    return () => {
      cancelled = true
    }
  }, [clientId, open])

  const canSend = useMemo(() => draft.trim().length > 0 && !sending && !uploading, [draft, sending, uploading])

  async function handleSendMessage() {
    if (!clientId || !canSend) return
    mutationVersionRef.current += 1
    const draftMessage = draft.trim()
    const token = await getCurrentAuthToken()
    if (!token) {
      setError('Authentication expired. Sign in again and try again.')
      return
    }

    setSending(true)
    setError(null)
    const optimisticMessage: ChatMessage = {
      id: -(Date.now()),
      clientId,
      senderAuthId: currentUserAuthId || 'local-user',
      senderName: displayName || 'You',
      message: draftMessage,
      attachmentName: '',
      attachmentUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isOwnMessage: true,
    }
    optimisticMessagesRef.current = [...optimisticMessagesRef.current, optimisticMessage]
    setMessages((prev) => [...prev, optimisticMessage])
    setDraft('')

    const response = await fetch(`/api/client-chat/${clientId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: draftMessage }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string }
    setSending(false)

    if (!response.ok) {
      optimisticMessagesRef.current = optimisticMessagesRef.current.filter((message) => message.id !== optimisticMessage.id)
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      setDraft(draftMessage)
      setError(result?.error || 'Failed to send message')
      return
    }
    void broadcastTyping(false)
    suppressPolling()
  }

  async function handleSaveEdit(messageId: number) {
    if (!clientId || !editingDraft.trim()) return
    mutationVersionRef.current += 1
    const token = await getCurrentAuthToken()
    if (!token) {
      setError('Authentication expired. Sign in again and try again.')
      return
    }

    const response = await fetch(`/api/client-chat/${clientId}/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: editingDraft }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string }
    if (!response.ok) {
      setError(result?.error || 'Failed to update message')
      return
    }

    setEditingId(null)
    setEditingDraft('')
    suppressPolling()
  }

  async function handleDelete(messageId: number) {
    if (messageId < 1) {
      optimisticMessagesRef.current = optimisticMessagesRef.current.filter((message) => message.id !== messageId)
      setMessages((prev) => prev.filter((message) => message.id !== messageId))
      return
    }

    if (!clientId) return
    mutationVersionRef.current += 1
    pendingDeletedIdsRef.current = new Set([...pendingDeletedIdsRef.current, messageId])
    const previousMessages = messages
    setMessages((prev) => prev.filter((message) => message.id !== messageId))
    const token = await getCurrentAuthToken()
    if (!token) {
      pendingDeletedIdsRef.current.delete(messageId)
      setMessages(previousMessages)
      setError('Authentication expired. Sign in again and try again.')
      return
    }

    const response = await fetch(`/api/client-chat/${clientId}/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = (await response.json().catch(() => null)) as { error?: string }
    if (!response.ok) {
      pendingDeletedIdsRef.current.delete(messageId)
      setMessages(previousMessages)
      setError(result?.error || 'Failed to delete message')
      return
    }

    suppressPolling()
  }

  async function handleUploadFile(file: File | null) {
    if (!clientId || !file) return
    mutationVersionRef.current += 1
    const token = await getCurrentAuthToken()
    if (!token) {
      setError('Authentication expired. Sign in again and try again.')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)
    if (draft.trim()) {
      formData.append('message', draft.trim())
    }

    const response = await fetch(`/api/client-chat/${clientId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const result = (await response.json().catch(() => null)) as { error?: string }
    setUploading(false)

    if (!response.ok) {
      setError(result?.error || 'Failed to share file')
      return
    }

    setDraft('')
    void broadcastTyping(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    suppressPolling()
  }

  if (!open || !clientId) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${plusJakarta.className}`}>
        <div className="flex h-[min(82vh,720px)] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between border-b border-slate-700 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">{headerTitle || title}</h2>
                <p className="text-sm text-slate-400">{headerSubtitle || subtitle || ''}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close chat"
              >
                <CloseIcon />
              </button>
            </div>

            <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-5">
              {loading ? (
                <div className="py-12 text-center text-sm text-slate-400">Loading chat...</div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">No messages yet.</div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-900/70 text-sm font-bold text-white">
                        {initials(message.senderName).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold text-white">{message.senderName}</span>
                          <span className="text-xs text-sky-300">{formatStamp(message.createdAt)}</span>
                        </div>
                        <div className="mt-2 rounded-2xl bg-slate-800/80 px-4 py-3.5">
                          {editingId === message.id ? (
                            <textarea
                              value={editingDraft}
                              onChange={(e) => setEditingDraft(e.target.value)}
                              rows={3}
                              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                          ) : message.message ? (
                            <p className="whitespace-pre-wrap break-words text-sm text-white">{message.message}</p>
                          ) : (
                            <p className="text-xs italic text-slate-400">Shared an attachment</p>
                          )}

                          {message.attachmentUrl ? (
                            <a
                              href={message.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-sky-300 transition hover:border-sky-500/40 hover:text-sky-200"
                            >
                              <AttachmentIcon className="h-4 w-4" />
                              {message.attachmentName || 'Attachment'}
                            </a>
                          ) : null}
                        </div>
                        {message.isOwnMessage ? (
                          <div className="mt-2 flex items-center gap-3 text-xs text-sky-300">
                            {editingId === message.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEdit(message.id)}
                                  className="transition hover:text-white"
                                >
                                  Save
                                </button>
                                <span className="text-slate-600">.</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(null)
                                    setEditingDraft('')
                                  }}
                                  className="transition hover:text-white"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(message.id)
                                    setEditingDraft(message.message)
                                  }}
                                  className="transition hover:text-white"
                                >
                                  Edit
                                </button>
                                <span className="text-slate-600">.</span>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(message.id)}
                                  className="transition hover:text-white"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 px-5 py-4">
              <div className="mb-2 flex min-h-[17px] items-center justify-end">
                {typingLabel ? <span className="text-[11px] text-sky-300">{typingLabel}</span> : null}
              </div>
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:opacity-50"
                  aria-label="Share file"
                >
                  <AttachmentIcon className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => void handleUploadFile(e.target.files?.[0] ?? null)}
                />
                <div className="min-w-0 flex-1">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a message..."
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!canSend}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange-500 px-4 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                >
                  <SendIcon className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
          <aside className="hidden w-64 border-l border-slate-800 bg-slate-950/50 p-5 lg:flex lg:flex-col">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Client</p>
              <p className="mt-2 text-sm font-semibold text-white">{headerTitle || title}</p>
              <p className="mt-1 text-xs text-slate-400">{headerSubtitle || subtitle || '--'}</p>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Invoices</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Compact recent invoices for this client.
              </p>
              <div className="mt-4 space-y-2">
                {invoicesLoading ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-400">
                    Loading invoices...
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs text-slate-400">
                    No invoices yet.
                  </div>
                ) : (
                  invoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => {
                        onClose()
                        router.push(
                          accountType === 'client'
                            ? '/dashboard/invoices'
                            : `/dashboard/invoices?clientId=${clientId}`
                        )
                      }}
                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-left transition hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white">INV-{invoice.id}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{formatInvoiceDate(invoice.invoiceDate)}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${invoiceStatusClass(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-orange-300">{formatInvoiceAmount(invoice)}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
