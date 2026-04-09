'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { logFetchError } from '@/lib/fetch-error'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { ClientChatModal } from '@/components/ClientChatModal'
import type { RealtimeChannel } from '@supabase/supabase-js'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })
const CHAT_LIST_REFRESH_MS = 5000

type ClientRow = {
  id: number
  name: string
  email: string
  handler_id?: string | null
  created_date?: string | null
}

type ChatMessageRow = {
  id: number
  client_id: number
  sender_auth_id: string
  message: string | null
  attachment_name: string | null
  created_at: string | null
  read_by_employee?: boolean | null
}

type ConversationItem = {
  clientId: number
  name: string
  email: string
  preview: string
  updatedAt: string | null
  unreadCount: number
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function formatConversationTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const sameDay = now.toDateString() === date.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function getPreviewText(message: ChatMessageRow | undefined) {
  if (!message) return 'No messages yet.'
  const text = (message.message || '').trim()
  if (text) return text
  if (message.attachment_name?.trim()) return `Shared ${message.attachment_name.trim()}`
  return 'New message'
}

function initials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  return ((tokens[0]?.[0] || '') + (tokens[1]?.[0] || tokens[0]?.[1] || '')).toUpperCase() || 'C'
}

function avatarColorsFromName(name: string) {
  const normalized = name.trim().toLowerCase() || 'client'
  let hash = 0

  for (let index = 0; index < normalized.length; index += 1) {
    hash = normalized.charCodeAt(index) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash) % 360
  return {
    background: `hsl(${hue} 56% 34%)`,
    border: `hsl(${hue} 62% 46%)`,
  }
}

function ConversationAvatar({ name }: { name: string }) {
  const colors = useMemo(() => avatarColorsFromName(name), [name])

  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold text-white"
      style={{ backgroundColor: colors.background, borderColor: colors.border }}
    >
      {initials(name)}
    </div>
  )
}

export function EmployeeChatsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUserAuthId, displayRole } = useDashboardProfile()
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<ClientRow[]>([])
  const [latestByClient, setLatestByClient] = useState<Record<number, ChatMessageRow>>({})
  const [unreadByClient, setUnreadByClient] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const isAdmin = normalizedRole === 'admin'
  const isSuperAdmin = normalizedRole === 'superadmin'

  const selectedClientId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get('clientId') || '', 10)
    return Number.isFinite(raw) && raw > 0 ? raw : null
  }, [searchParams])

  const loadConversations = useCallback(async () => {
    if (!currentUserAuthId) return

    setError(null)
    setLoading((prev) => prev && clients.length === 0)

    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, handler_id, status, created_date')
      .neq('isdeleted', true)
      .order('created_date', { ascending: false })

    if (clientsError) {
      logFetchError('Failed to load chat clients', clientsError)
      setError(clientsError.message || 'Failed to load chats')
      setLoading(false)
      return
    }

    const visibleClients = (((clientsData as Array<ClientRow & { status?: string | null }> | null) ?? []))
      .filter((row) => (row.status || '').trim().toLowerCase() === 'approved')
      .filter((row) => isAdmin || isSuperAdmin || row.handler_id === currentUserAuthId)
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        handler_id: row.handler_id ?? null,
        created_date: row.created_date ?? null,
      }))

    setClients(visibleClients)

    if (visibleClients.length === 0) {
      setLatestByClient({})
      setUnreadByClient({})
      setLoading(false)
      return
    }

    const clientIds = visibleClients.map((row) => row.id)

    const { data: messageData, error: messageError } = await supabase
      .from('client_chat_messages')
      .select('id, client_id, sender_auth_id, message, attachment_name, created_at')
      .in('client_id', clientIds)
      .eq('isdeleted', false)
      .order('created_at', { ascending: false })
      .limit(Math.max(200, clientIds.length * 8))

    if (messageError) {
      logFetchError('Failed to load latest chat previews', messageError)
      setError(messageError.message || 'Failed to load chats')
      setLoading(false)
      return
    }

    const nextLatest: Record<number, ChatMessageRow> = {}
    ;(((messageData as ChatMessageRow[] | null) ?? [])).forEach((row) => {
      if (!nextLatest[row.client_id]) {
        nextLatest[row.client_id] = row
      }
    })
    setLatestByClient(nextLatest)

    const { data: unreadRows, error: unreadError } = await supabase
      .from('client_chat_messages')
      .select('client_id, sender_auth_id, read_by_employee')
      .in('client_id', clientIds)
      .eq('isdeleted', false)
      .neq('sender_auth_id', currentUserAuthId)
      .or('read_by_employee.is.null,read_by_employee.eq.false')

    if (unreadError) {
      logFetchError('Failed to load unread chat counts', unreadError)
      setUnreadByClient({})
      setLoading(false)
      return
    }

    const nextUnread = (((unreadRows as ChatMessageRow[] | null) ?? [])).reduce<Record<number, number>>((acc, row) => {
      acc[row.client_id] = (acc[row.client_id] || 0) + 1
      return acc
    }, {})

    setUnreadByClient(nextUnread)
    setLoading(false)
  }, [clients.length, currentUserAuthId, isAdmin, isSuperAdmin])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConversations()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadConversations])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadConversations()
      }
    }, CHAT_LIST_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [loadConversations])

  useEffect(() => {
    if (!currentUserAuthId) return

    channelRef.current?.unsubscribe()
    channelRef.current = supabase
      .channel(`employee-chat-page-${currentUserAuthId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_chat_messages' },
        () => {
          void loadConversations()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => {
          void loadConversations()
        }
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
      channelRef.current = null
    }
  }, [currentUserAuthId, loadConversations])

  const conversations = useMemo<ConversationItem[]>(() => {
    return clients
      .map((client) => {
        const latest = latestByClient[client.id]
        return {
          clientId: client.id,
          name: client.name || 'Client',
          email: client.email || '',
          preview: getPreviewText(latest),
          updatedAt: latest?.created_at || client.created_date || null,
          unreadCount: unreadByClient[client.id] || 0,
        }
      })
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
        return bTime - aTime
      })
  }, [clients, latestByClient, unreadByClient])

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query)
      )
    })
  }, [conversations, searchQuery])

  const selectedConversation =
    filteredConversations.find((item) => item.clientId === selectedClientId) ||
    conversations.find((item) => item.clientId === selectedClientId) ||
    filteredConversations[0] ||
    conversations[0] ||
    null

  useEffect(() => {
    if (loading) return

    if (!selectedConversation) {
      if (selectedClientId !== null) {
        router.replace('/dashboard/chat')
      }
      return
    }

    if (selectedClientId === selectedConversation.clientId) return
    router.replace(`/dashboard/chat?clientId=${selectedConversation.clientId}`)
  }, [loading, router, selectedClientId, selectedConversation])

  return (
    <div className={`${plusJakarta.className} flex w-full flex-col gap-4 text-white sm:gap-6`}>
      <div className="min-w-0">
        <h1 className="text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl lg:text-4xl">
          Chats
        </h1>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500 sm:text-sm md:text-base md:leading-6">
          All client conversations in one dedicated workspace.
        </p>
      </div>

      <div className="flex h-[calc(100dvh-18rem)] min-h-[420px] w-full overflow-hidden rounded-[28px] border border-slate-700 bg-[#0f172a] shadow-2xl shadow-black/20 lg:h-[calc(100dvh-15rem)]">
        <aside className="flex w-full max-w-full flex-col border-b border-slate-700 bg-[#101b24] md:w-[34%] md:min-w-[250px] md:max-w-[320px] md:border-b-0 md:border-r md:border-r-slate-700 lg:w-[32%] lg:max-w-[340px]">
          <div className="border-b border-slate-700 px-5 py-4">
            <h2 className="text-2xl font-black text-white">Chats</h2>
            <p className="mt-1 text-sm text-sky-100/75">All conversations in one place.</p>
          </div>

          <div className="border-b border-slate-700 px-4 py-3">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 px-3 py-3 text-slate-400 focus-within:border-sky-500/40 focus-within:text-slate-300">
              <SearchIcon />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search or start a new chat"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-5 py-8 text-sm text-slate-400">Loading chats...</div>
            ) : error ? (
              <div className="px-5 py-8 text-sm text-rose-300">{error}</div>
            ) : filteredConversations.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-400">
                {conversations.length === 0 ? 'No client chats available yet.' : 'No chats match your search.'}
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const active = selectedConversation?.clientId === conversation.clientId
                return (
                  <button
                    key={conversation.clientId}
                    type="button"
                    onClick={() => router.replace(`/dashboard/chat?clientId=${conversation.clientId}`)}
                    className={`flex w-full items-start gap-3 border-b border-slate-700/50 px-4 py-4 text-left transition ${active ? 'bg-slate-700/35' : 'hover:bg-slate-800/50'}`}
                  >
                    <ConversationAvatar name={conversation.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-bold text-white">{conversation.name}</p>
                          <p className="truncate text-sm text-slate-300">{conversation.preview}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span className="text-xs text-slate-400">{formatConversationTime(conversation.updatedAt)}</span>
                          {conversation.unreadCount > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="mt-1 truncate text-xs text-sky-200/80">{conversation.email}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="hidden min-w-0 flex-1 md:flex">
          {selectedConversation ? (
            <ClientChatModal
              open
              clientId={selectedConversation.clientId}
              title={selectedConversation.name}
              subtitle={selectedConversation.email}
              onClose={() => router.replace('/dashboard/chat')}
              variant="page"
              pageHeightClass="h-full"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
              Select a client conversation to open the chat workspace.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
