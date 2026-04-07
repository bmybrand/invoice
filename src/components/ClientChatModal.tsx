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
const OLDER_LOAD_TRIGGER_PX = 140
const CHAT_BUCKET = 'client-chat-files'

type ChatCacheEntry = {
  messages: ChatMessage[]
  headerTitle: string
  headerSubtitle: string
  hasOlderMessages: boolean
}

const clientChatCache = new Map<string, ChatCacheEntry>()

type ChatMessage = {
  id: number
  clientId: number
  senderAuthId: string
  senderName: string
  senderAvatarUrl?: string | null
  message: string
  attachmentName: string
  attachmentUrl: string | null
  createdAt: string | null
  updatedAt: string | null
  isOwnMessage: boolean
  seenByRecipient?: boolean
  isPending?: boolean
  attachmentMetaLabel?: string | null
}

type ChatResponse = {
  client: {
    id: number
    name: string
    email: string
    handlerName: string
  }
  messages: ChatMessage[]
  hasMore?: boolean
  canMessage?: boolean
}

type ChatInvoice = {
  id: number
  invoiceDate: string | null
  amount: string
  payableAmount: number | null
  status: string
}

type PendingAttachmentPreview = {
  file: File
  previewUrl: string | null
  isImage: boolean
}

type ExpandedAttachment = {
  url: string
  name: string
  isImage: boolean
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

function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function DoubleTickIcon({ seen }: { seen: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${seen ? 'text-sky-300' : 'text-slate-500'}`}
      fill="none"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-label={seen ? 'Seen' : 'Sent'}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M1.75 8.5 4.5 11.25 9.25 5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.25 8.5 9 11.25 13.75 5.5" />
    </svg>
  )
}

function FileIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.25 3.75H7.5A2.25 2.25 0 005.25 6v12A2.25 2.25 0 007.5 20.25h9A2.25 2.25 0 0018.75 18V8.25L14.25 3.75z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 3.75V8.25H18.75" />
    </svg>
  )
}

function formatAttachmentSize(sizeBytes: number | null | undefined) {
  const size = Number(sizeBytes ?? 0)
  if (!Number.isFinite(size) || size <= 0) return '--'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(0)} MB`
  return `${Math.max(1, Math.round(size / 1024))} kB`
}

function getAttachmentExtension(name: string) {
  const ext = name.split('.').pop()?.trim().toUpperCase()
  return ext || 'FILE'
}

function formatAttachmentMeta(name: string, sizeBytes?: number | null) {
  const ext = getAttachmentExtension(name)
  const size = formatAttachmentSize(sizeBytes)
  return size === '--' ? ext : `${size} - ${ext}`
}

function initials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  return (tokens[0]?.[0] || '') + (tokens[1]?.[0] || tokens[0]?.[1] || '')
}

function avatarColorsFromName(name: string) {
  const normalized = name.trim().toLowerCase() || 'user'
  let hash = 0

  for (let index = 0; index < normalized.length; index += 1) {
    hash = normalized.charCodeAt(index) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash) % 360
  const background = `hsl(${hue} 56% 34%)`
  const border = `hsl(${hue} 62% 46%)`

  return { background, border }
}

function MessageAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(imageUrl && !imageFailed)
  const colors = useMemo(() => avatarColorsFromName(name), [name])

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-bold text-white"
      style={
        showImage
          ? undefined
          : {
              backgroundColor: colors.background,
              borderColor: colors.border,
            }
      }
    >
      {showImage ? (
        <img
          src={imageUrl || ''}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initials(name).toUpperCase()}</span>
      )}
    </div>
  )
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

function isPreviewableImage(name: string, url: string | null) {
  const source = `${name} ${url || ''}`.toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'].some((ext) =>
    source.includes(ext)
  )
}

export function ClientChatModal({
  open,
  clientId,
  title,
  subtitle,
  onClose,
  variant = 'modal',
  pageHeightClass = 'h-[calc(100dvh-12rem)]',
}: {
  open: boolean
  clientId: number | null
  title: string
  subtitle?: string
  onClose: () => void
  variant?: 'modal' | 'page'
  pageHeightClass?: string
}) {
  const router = useRouter()
  const { accountType, currentUserAuthId, displayName } = useDashboardProfile()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [headerTitle, setHeaderTitle] = useState(title)
  const [headerSubtitle, setHeaderSubtitle] = useState(subtitle || '')
  const [typingLabel, setTypingLabel] = useState('')
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachmentPreview | null>(null)
  const [invoices, setInvoices] = useState<ChatInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<number | null>(null)
  const [expandedAttachment, setExpandedAttachment] = useState<ExpandedAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const fetchVersionRef = useRef(0)
  const mutationVersionRef = useRef(0)
  const suppressRefreshRef = useRef(false)
  const suppressRefreshTimeoutRef = useRef<number | null>(null)
  const optimisticMessagesRef = useRef<ChatMessage[]>([])
  const loadedMessagesRef = useRef<ChatMessage[]>([])
  const pendingDeletedIdsRef = useRef<Set<number>>(new Set())
  const typingTimeoutRef = useRef<number | null>(null)
  const remoteTypingTimeoutRef = useRef<number | null>(null)
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const invoiceFetchVersionRef = useRef(0)
  const localMessageIdRef = useRef(-1)
  const shouldStickToBottomRef = useRef(true)
  const loadingOlderMessagesRef = useRef(false)
  const topAutoLoadArmedRef = useRef(true)
  const olderLoadAnchorRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null)
  const loadInFlightRef = useRef(false)
  const queuedOlderLoadRef = useRef(false)
  const hasOlderMessagesRef = useRef(false)

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-chat-menu-root="true"]')) return
      setActiveMenuMessageId(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenuMessageId(null)
        setExpandedAttachment(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleDocumentClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const mergeChatMessages = useCallback((existing: ChatMessage[], incoming: ChatMessage[]) => {
    const byId = new Map<number, ChatMessage>()
    existing.forEach((message) => byId.set(message.id, message))
    incoming.forEach((message) => byId.set(message.id, message))
    return Array.from(byId.values()).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return aTime - bTime
    })
  }, [])

  const cacheKey = useMemo(
    () => (currentUserAuthId && clientId ? `${currentUserAuthId}:${clientId}` : ''),
    [clientId, currentUserAuthId]
  )

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
    async (options?: { background?: boolean; older?: boolean }) => {
      if (!open || !clientId) return
      const isBackground = options?.background ?? false
      const isOlder = options?.older ?? false
      const stopOlderLoading = () => {
        loadingOlderMessagesRef.current = false
        setLoadingOlderMessages(false)
      }
      if (isOlder && !hasOlderMessagesRef.current) return
      if (loadInFlightRef.current) {
        if (isOlder) {
          queuedOlderLoadRef.current = true
        }
        return
      }
      loadInFlightRef.current = true
      const fetchVersion = ++fetchVersionRef.current
      const mutationVersionAtStart = mutationVersionRef.current
      if (isOlder) {
        loadingOlderMessagesRef.current = true
        setLoadingOlderMessages(true)
        const node = messagesRef.current
        olderLoadAnchorRef.current = node
          ? { scrollTop: node.scrollTop, scrollHeight: node.scrollHeight }
          : null
      } else if (!isBackground) {
        if (!loadedMessagesRef.current.length) {
          setLoading(true)
        }
      }
      setError(null)

      try {
        const token = await getCurrentAuthToken()
        if (!token) {
          setLoading(false)
          stopOlderLoading()
          setError('Authentication expired. Sign in again and try again.')
          return
        }

        const params = new URLSearchParams({ limit: '4' })
        if (isOlder) {
          const oldestMessage = loadedMessagesRef.current.find((message) => message.id > 0)
          if (!oldestMessage?.id) {
            hasOlderMessagesRef.current = false
            setHasOlderMessages(false)
            topAutoLoadArmedRef.current = false
            stopOlderLoading()
            return
          }
          params.set('beforeId', String(oldestMessage.id))
        }

        const response = await fetch(`/api/client-chat/${clientId}?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const result = (await response.json().catch(() => null)) as ChatResponse & { error?: string }

        if (fetchVersion !== fetchVersionRef.current || mutationVersionAtStart !== mutationVersionRef.current) {
          stopOlderLoading()
          return
        }

        if (!response.ok) {
          setLoading(false)
          stopOlderLoading()
          setError(result?.error || 'Failed to load chat')
          return
        }

        const canMessage = result.canMessage !== false
        setPermissionError(canMessage ? null : 'Only the assigned handler can message this client')

        const serverMessages = (result.messages || []).filter((message) => !pendingDeletedIdsRef.current.has(message.id))
        if (isOlder && serverMessages.length === 0) {
          hasOlderMessagesRef.current = false
          setHasOlderMessages(false)
          topAutoLoadArmedRef.current = false
          stopOlderLoading()
          return
        }
        const remainingOptimisticMessages = optimisticMessagesRef.current.filter(
          (optimisticMessage) =>
            !serverMessages.some((serverMessage) => matchesOptimisticMessage(serverMessage, optimisticMessage))
        )
        optimisticMessagesRef.current = remainingOptimisticMessages

        setMessages((prev) => {
          if (isOlder) {
            const next = mergeChatMessages(prev, serverMessages)
            loadedMessagesRef.current = next
            return next
          }
          const persistedMessages = prev.filter(
            (message) => message.id > 0 && !pendingDeletedIdsRef.current.has(message.id)
          )

          // Replace the latest server window instead of union-merging it, so deletes
          // made on another tab/user are reflected locally.
          let nextBase: ChatMessage[]
          if (serverMessages.length === 0) {
            nextBase = []
          } else {
            const oldestServerId = Math.min(...serverMessages.map((message) => message.id))
            const olderPersisted = persistedMessages.filter((message) => message.id < oldestServerId)
            nextBase = mergeChatMessages(olderPersisted, serverMessages)
          }

          const next = mergeChatMessages(nextBase, remainingOptimisticMessages)
          loadedMessagesRef.current = next
          return next
        })
        setHasOlderMessages(Boolean(result.hasMore))
        hasOlderMessagesRef.current = Boolean(result.hasMore)
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
        stopOlderLoading()
        if (!result.hasMore) {
          topAutoLoadArmedRef.current = false
        }
        if (!isOlder && !isBackground) {
          shouldStickToBottomRef.current = true
          window.requestAnimationFrame(() => {
            const node = messagesRef.current
            if (!node) return
            node.scrollTop = node.scrollHeight
            topAutoLoadArmedRef.current = false
          })
        }
        if (isOlder && olderLoadAnchorRef.current) {
          const anchor = olderLoadAnchorRef.current
          olderLoadAnchorRef.current = null
          window.requestAnimationFrame(() => {
            const node = messagesRef.current
            if (!node) return
            const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
            if (distanceFromBottom < 80 || node.scrollTop > 80) {
              return
            }
            node.scrollTop = node.scrollHeight - anchor.scrollHeight + anchor.scrollTop
          })
        }
      } catch {
        setLoading(false)
        stopOlderLoading()
        setError('Failed to load chat')
      } finally {
        stopOlderLoading()
        loadInFlightRef.current = false
        if (queuedOlderLoadRef.current && open && clientId) {
          queuedOlderLoadRef.current = false
          if (!loadingOlderMessagesRef.current && hasOlderMessagesRef.current) {
            void loadMessages({ older: true })
          }
        }
      }
    },
    [accountType, clientId, getCurrentAuthToken, mergeChatMessages, open]
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

    shouldStickToBottomRef.current = true
    topAutoLoadArmedRef.current = false
    olderLoadAnchorRef.current = null
    loadingOlderMessagesRef.current = false

    const cached = cacheKey ? clientChatCache.get(cacheKey) : null
    let cacheRestoreTimeoutId: number | null = null
    if (cached) {
      cacheRestoreTimeoutId = window.setTimeout(() => {
        loadedMessagesRef.current = cached.messages
        shouldStickToBottomRef.current = true
        topAutoLoadArmedRef.current = false
        setMessages(cached.messages)
        setHeaderTitle(cached.headerTitle)
        setHeaderSubtitle(cached.headerSubtitle)
        setHasOlderMessages(cached.hasOlderMessages)
        hasOlderMessagesRef.current = cached.hasOlderMessages
        setLoading(false)
      }, 0)
    }

    const timeoutId = window.setTimeout(() => {
      void loadMessages()
    }, 0)

    const intervalId = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !suppressRefreshRef.current &&
        !loadingOlderMessagesRef.current
      ) {
        void loadMessages({ background: true })
      }
    }, CHAT_REFRESH_MS)

    return () => {
      if (cacheRestoreTimeoutId !== null) {
        window.clearTimeout(cacheRestoreTimeoutId)
      }
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      if (suppressRefreshTimeoutRef.current !== null) {
        window.clearTimeout(suppressRefreshTimeoutRef.current)
      }
    }
  }, [cacheKey, clientId, loadMessages, open])

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

    const handleScroll = () => {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
      shouldStickToBottomRef.current = distanceFromBottom < 80
      if (
        loadingOlderMessagesRef.current &&
        olderLoadAnchorRef.current &&
        node.scrollTop > olderLoadAnchorRef.current.scrollTop + 80
      ) {
        olderLoadAnchorRef.current = null
      }
      if (node.scrollTop > OLDER_LOAD_TRIGGER_PX * 2) {
        topAutoLoadArmedRef.current = true
      }
      if (
        node.scrollTop < OLDER_LOAD_TRIGGER_PX &&
        hasOlderMessages &&
        !loadingOlderMessagesRef.current &&
        topAutoLoadArmedRef.current
      ) {
        topAutoLoadArmedRef.current = false
        void loadMessages({ older: true })
      }
    }

    node.addEventListener('scroll', handleScroll)
    return () => {
      node.removeEventListener('scroll', handleScroll)
    }
  }, [hasOlderMessages, loadMessages, open])

  useEffect(() => {
    if (!open) return
    const node = messagesRef.current
    if (!node || !shouldStickToBottomRef.current) return
    node.scrollTop = node.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (!cacheKey) return
    clientChatCache.set(cacheKey, {
      messages,
      headerTitle,
      headerSubtitle,
      hasOlderMessages,
    })
  }, [cacheKey, hasOlderMessages, headerSubtitle, headerTitle, messages])

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

    const timeoutId = window.setTimeout(() => {
      void loadInvoices()
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [clientId, open])

  const canSend = useMemo(
    () =>
      (draft.trim().length > 0 || pendingAttachment !== null) &&
      !sending &&
      !uploading &&
      !permissionError,
    [draft, pendingAttachment, sending, uploading, permissionError]
  )

  async function handleSendMessage() {
    if (!clientId || !canSend) return
    if (pendingAttachment) {
      await handleUploadFile(pendingAttachment.file)
      return
    }
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
      id: localMessageIdRef.current--,
      clientId,
      senderAuthId: currentUserAuthId || 'local-user',
      senderName: displayName || 'You',
      message: draftMessage,
      attachmentName: '',
      attachmentUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isOwnMessage: true,
      seenByRecipient: false,
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

  async function handleCopyMessage(message: ChatMessage) {
    const text = (message.message || '').trim() || message.attachmentUrl || message.attachmentName || ''
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setActiveMenuMessageId(null)
    } catch {
      setError('Failed to copy message')
    }
  }

  async function handleDownloadAttachment(message: ChatMessage) {
    if (!message.attachmentUrl) return

    try {
      const response = await fetch(message.attachmentUrl)
      if (!response.ok) {
        throw new Error('download failed')
      }

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = message.attachmentName || 'attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
      setActiveMenuMessageId(null)
    } catch {
      window.open(message.attachmentUrl, '_blank', 'noopener,noreferrer')
      setActiveMenuMessageId(null)
    }
  }

  function handleViewAttachment(message: ChatMessage) {
    if (!message.attachmentUrl) return

    setExpandedAttachment({
      url: message.attachmentUrl,
      name: message.attachmentName || 'Attachment',
      isImage: isPreviewableImage(message.attachmentName, message.attachmentUrl),
    })
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
    const attachmentMessage = draft.trim()
    const optimisticMessage: ChatMessage = {
      id: localMessageIdRef.current--,
      clientId,
      senderAuthId: currentUserAuthId || 'local-user',
      senderName: displayName || 'You',
      message: attachmentMessage,
      attachmentName: file.name,
      attachmentUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      isOwnMessage: true,
      seenByRecipient: false,
      isPending: true,
      attachmentMetaLabel: formatAttachmentMeta(file.name, file.size),
    }
    optimisticMessagesRef.current = [...optimisticMessagesRef.current, optimisticMessage]
    setMessages((prev) => [...prev, optimisticMessage])
    setDraft('')
    setPendingAttachment(null)

    const prepareResponse = await fetch(`/api/client-chat/${clientId}/attachments-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        operation: 'prepare',
        fileName: file.name,
      }),
    })

    const prepareResult = (await prepareResponse.json().catch(() => null)) as {
      error?: string
      filePath?: string
      token?: string
    } | null

    if (!prepareResponse.ok || !prepareResult?.filePath || !prepareResult.token) {
      optimisticMessagesRef.current = optimisticMessagesRef.current.filter((message) => message.id !== optimisticMessage.id)
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      setDraft(attachmentMessage)
      setPendingAttachment({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        isImage: file.type.startsWith('image/'),
      })
      setUploading(false)
      setError(prepareResult?.error || 'Failed to prepare file upload')
      return
    }

    const uploadResult = await supabase.storage
      .from(CHAT_BUCKET)
      .uploadToSignedUrl(prepareResult.filePath, prepareResult.token, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadResult.error) {
      optimisticMessagesRef.current = optimisticMessagesRef.current.filter((message) => message.id !== optimisticMessage.id)
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      setDraft(attachmentMessage)
      setPendingAttachment({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        isImage: file.type.startsWith('image/'),
      })
      setUploading(false)
      setError(uploadResult.error.message || 'Failed to upload file')
      return
    }

    const completeResponse = await fetch(`/api/client-chat/${clientId}/attachments-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        operation: 'complete',
        filePath: prepareResult.filePath,
        attachmentName: file.name,
        message: attachmentMessage,
      }),
    })

    const completeResult = (await completeResponse.json().catch(() => null)) as { error?: string } | null
    setUploading(false)

    if (!completeResponse.ok) {
      optimisticMessagesRef.current = optimisticMessagesRef.current.filter((message) => message.id !== optimisticMessage.id)
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id))
      setDraft(attachmentMessage)
      setPendingAttachment({
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        isImage: file.type.startsWith('image/'),
      })
      setError(completeResult?.error || 'Failed to share file')
      return
    }

    void broadcastTyping(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    suppressPolling()
  }

  function handleSelectAttachment(file: File | null) {
    if (!file) return
    setError(null)
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl)
      }
      const isImage = file.type.startsWith('image/')
      return {
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        isImage,
      }
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl)
      }
    }
  }, [pendingAttachment])

  if (!open || !clientId) return null

  const isPageVariant = variant === 'page'
  const shell = (
    <div className={`flex ${isPageVariant ? pageHeightClass : 'h-[min(82vh,720px)]'} w-full ${isPageVariant ? '' : 'max-w-5xl'} overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">{headerTitle || title}</h2>
            <p className="text-sm text-slate-400">{headerSubtitle || subtitle || ''}</p>
          </div>
          {!isPageVariant ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <div ref={messagesRef} className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading chat...</div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No messages yet.</div>
          ) : (
            <div className="space-y-6">
              {loadingOlderMessages ? (
                <div className="text-center text-xs font-medium text-slate-400">Loading older messages...</div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-4 ${message.isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <MessageAvatar name={message.senderName} imageUrl={message.senderAvatarUrl} />
                  <div className={`min-w-0 flex-1 ${message.isOwnMessage ? 'flex justify-end' : ''}`}>
                    <div className={`min-w-0 w-fit max-w-[min(92vw,44rem)] ${message.isOwnMessage ? 'flex flex-col items-end' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-white">{message.senderName}</span>
                      <span className="text-xs text-sky-300">{formatStamp(message.createdAt)}</span>
                      {message.isOwnMessage ? (
                        <DoubleTickIcon seen={Boolean(message.seenByRecipient)} />
                      ) : null}
                    </div>
                    <div className="group relative mt-2 inline-block max-w-full rounded-2xl bg-slate-800/80 px-4 py-3.5">
                        <div
                          data-chat-menu-root="true"
                          className={`absolute top-2 z-10 ${message.isOwnMessage ? 'left-2' : 'right-2'}`}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setActiveMenuMessageId((prev) => (prev === message.id ? null : message.id))
                            }}
                            className={`rounded-full bg-slate-900/70 p-1 text-slate-300 transition hover:bg-slate-800 hover:text-white ${activeMenuMessageId === message.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100'}`}
                            aria-label="Message options"
                          >
                            <ChevronDownIcon className="h-3.5 w-3.5" />
                          </button>

                          {activeMenuMessageId === message.id ? (
                            <div className={`absolute top-8 z-10 w-40 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl ${message.isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'}`}>
                              {message.senderAuthId === currentUserAuthId && editingId !== message.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(message.id)
                                    setEditingDraft(message.message)
                                    setActiveMenuMessageId(null)
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800"
                                >
                                  Edit
                                </button>
                              ) : null}
                              {message.senderAuthId === currentUserAuthId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuMessageId(null)
                                    void handleDelete(message.id)
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-slate-800"
                                >
                                  Delete
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void handleCopyMessage(message)}
                                className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800"
                              >
                                Copy
                              </button>
                              {message.attachmentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuMessageId(null)
                                    handleViewAttachment(message)
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800"
                                >
                                  View
                                </button>
                              ) : null}
                              {message.attachmentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuMessageId(null)
                                    void handleDownloadAttachment(message)
                                  }}
                                  className="block w-full px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800"
                                >
                                  Download
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {editingId === message.id ? (
                          <textarea
                            value={editingDraft}
                            onChange={(e) => setEditingDraft(e.target.value)}
                            rows={3}
                            className="mt-6 w-full resize-none rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        ) : (
                          <>
                            {message.attachmentName ? (
                              message.attachmentUrl ? (
                              isPreviewableImage(message.attachmentName, message.attachmentUrl) ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewAttachment(message)}
                                  className="inline-flex w-fit max-w-full flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70 transition hover:border-sky-500/40"
                                >
                                  <img
                                    src={message.attachmentUrl}
                                    alt={message.attachmentName || 'Attachment preview'}
                                    className="block h-80 w-full object-cover object-center"
                                  />
                                  <div className="flex w-full min-w-0 items-center gap-2 border-t border-slate-700 px-3 py-2 text-xs text-sky-300">
                                    <AttachmentIcon className="h-4 w-4" />
                                    <span
                                      className="min-w-0 max-w-40 flex-1 truncate"
                                      title={message.attachmentName || 'Attachment'}
                                    >
                                      {message.attachmentName || 'Attachment'}
                                    </span>
                                  </div>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleViewAttachment(message)}
                                  className="block overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70 transition hover:border-sky-500/40"
                                >
                                  <div className="flex h-56 flex-col items-center justify-center px-6 text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-400">
                                      <FileIcon className="h-9 w-9" />
                                    </div>
                                    <p className="mt-5 break-all text-2xl font-medium leading-tight text-slate-200">
                                      {message.attachmentName || 'Attachment'}
                                    </p>
                                    <p className="mt-2 text-base text-slate-400">
                                      No preview available
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                      {message.attachmentMetaLabel || getAttachmentExtension(message.attachmentName || 'Attachment')}
                                    </p>
                                  </div>
                                </button>
                              )
                              ) : (
                                <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70">
                                  <div className="flex h-56 flex-col items-center justify-center px-6 text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/90">
                                      <img
                                        src="/bmybrand-B.svg"
                                        alt=""
                                        className="h-10 w-10 animate-spin object-contain opacity-80"
                                      />
                                    </div>
                                    <p className="mt-5 break-all text-2xl font-medium leading-tight text-slate-200">
                                      {message.attachmentName || 'Attachment'}
                                    </p>
                                    <p className="mt-2 text-base text-slate-400">
                                      Uploading attachment...
                                    </p>
                                    <p className="mt-1 text-sm text-slate-500">
                                      {message.attachmentMetaLabel || 'Preparing preview'}
                                    </p>
                                  </div>
                                </div>
                              )
                            ) : null}

                            {message.message ? (
                              <p className={`${message.attachmentUrl ? 'mt-3' : 'mt-0'} whitespace-pre-wrap wrap-break-word text-sm text-white`}>
                                {message.message}
                              </p>
                            ) : !message.attachmentUrl ? (
                              <p className="mt-0 text-xs italic text-slate-400">Shared an attachment</p>
                            ) : null}
                          </>
                        )}
                      </div>
                    {message.senderAuthId === currentUserAuthId && editingId === message.id ? (
                      <div className={`mt-2 flex items-center gap-3 text-xs text-sky-300 ${message.isOwnMessage ? 'justify-end' : ''}`}>
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
                      </div>
                    ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!permissionError ? (
          <div className="border-t border-slate-800 px-5 py-4">
            {typingLabel ? (
              <div className="mb-2 flex items-center justify-end">
                <span className="text-[11px] text-sky-300">{typingLabel}</span>
              </div>
            ) : null}
              {pendingAttachment ? (
                <div className="mb-3 rounded-2xl border border-slate-700 bg-slate-800/80 p-3">
                  <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70">
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachment((prev) => {
                          if (prev?.previewUrl) {
                            URL.revokeObjectURL(prev.previewUrl)
                          }
                          return null
                        })
                      }
                      className="absolute right-3 top-3 z-10 rounded-full bg-slate-950/80 p-1.5 text-slate-300 transition hover:bg-slate-900 hover:text-white"
                      aria-label="Remove attachment"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>

                    {pendingAttachment.isImage && pendingAttachment.previewUrl ? (
                      <img
                        src={pendingAttachment.previewUrl}
                        alt={pendingAttachment.file.name}
                        className="block h-80 w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-56 flex-col items-center justify-center px-6 text-center">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-400">
                          <FileIcon className="h-9 w-9" />
                        </div>
                        <p className="mt-5 break-all text-2xl font-medium leading-tight text-slate-200">
                          {pendingAttachment.file.name}
                        </p>
                        <p className="mt-2 text-base text-slate-400">
                          No preview available
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatAttachmentSize(pendingAttachment.file.size)} - {getAttachmentExtension(pendingAttachment.file.name)}
                        </p>
                      </div>
                    )}
                  </div>
                  {pendingAttachment.isImage ? (
                    <div className="mt-3 px-1">
                      <p className="truncate text-xs font-semibold text-white">{pendingAttachment.file.name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatAttachmentSize(pendingAttachment.file.size)} - {getAttachmentExtension(pendingAttachment.file.name)}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || sending || Boolean(permissionError)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 disabled:opacity-50"
                  aria-label="Share file"
                >
                  <AttachmentIcon className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleSelectAttachment(e.target.files?.[0] ?? null)}
                />
                <div className="min-w-0 w-full flex">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={permissionError ? 'Only assigned handler can message' : 'Write a message...'}
                    rows={2}
                    disabled={Boolean(permissionError)}
                    className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-[13px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!canSend}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-orange-500 px-4 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                >
                  <SendIcon className="h-4 w-4" />
                  {sending || uploading ? 'Sending...' : 'Send'}
                </button>
              </div>
              {error ? (
                <p className="mt-2 text-xs text-rose-300">{error}</p>
              ) : null}
          </div>
        ) : null}
      </div>
      <aside className="hidden w-64 border-l border-slate-800 bg-slate-950/50 p-5 lg:flex lg:flex-col">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
            {accountType === 'client' ? 'Agent' : 'Client'}
          </p>
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
  )

  const attachmentLightbox = expandedAttachment ? (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/85 p-4"
      onClick={() => setExpandedAttachment(null)}
    >
      <button
        type="button"
        onClick={() => setExpandedAttachment(null)}
        className="absolute right-5 top-5 rounded-full bg-slate-900/80 p-2 text-white transition hover:bg-slate-800"
        aria-label="Close attachment preview"
      >
        <CloseIcon />
      </button>
      <div
        className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-white">{expandedAttachment.name}</h3>
            <p className="text-xs text-slate-400">
              {expandedAttachment.isImage ? 'Image preview' : 'Attachment preview'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={expandedAttachment.url}
              download={expandedAttachment.name}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Download
            </a>
          </div>
        </div>
        <div className="flex max-h-[calc(88vh-4.5rem)] items-center justify-center bg-slate-950 p-5">
          {expandedAttachment.isImage ? (
            <img
              src={expandedAttachment.url}
              alt={expandedAttachment.name}
              className="max-h-[calc(88vh-7rem)] max-w-full rounded-2xl border border-slate-700 object-contain"
            />
          ) : (
            <div className="flex w-full max-w-2xl flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 px-8 py-16 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-700 bg-slate-950 text-slate-400">
                <FileIcon className="h-11 w-11" />
              </div>
              <p className="mt-6 break-all text-2xl font-medium leading-tight text-slate-200">
                {expandedAttachment.name}
              </p>
              <p className="mt-3 text-base text-slate-400">No preview available</p>
              <div className="mt-6 flex items-center gap-3">
                <a
                  href={expandedAttachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  Open
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null

  if (isPageVariant) {
    return (
      <div className={plusJakarta.className}>
        {shell}
        {attachmentLightbox}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${plusJakarta.className}`}>
        {shell}
      </div>
      {attachmentLightbox}
    </>
  )
}
