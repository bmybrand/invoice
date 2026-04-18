import { NextResponse } from 'next/server'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'
import { sendHandlerChatPush } from '@/lib/server-push-notifications'

type RouteParams = { clientId: string }

type ClientChatRow = {
  id: number
  client_id: number
  sender_auth_id: string
  message: string | null
  read_by_client: boolean | null
  read_by_employee: boolean | null
  created_at: string | null
  updated_at: string | null
  isdeleted: boolean | null
}

type ClientChatAttachmentRow = {
  message_id: number
  attachment_name: string | null
  attachment_path: string | null
  sort_order: number | null
}

const CHAT_BUCKET = 'client-chat-files'
const PROFILE_AVATAR_BUCKET = 'profile-images'
const AVATAR_CACHE_TTL_MS = 5 * 60 * 1000
const senderAvatarCache = new Map<string, { url: string | null; expiresAt: number }>()
const ATTACHMENT_URL_TTL_MS = 55 * 60 * 1000
const attachmentSignedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const HANDLER_NAME_TTL_MS = 10 * 60 * 1000
const handlerNameCache = new Map<string, { name: string; expiresAt: number }>()

function getParams(params: RouteParams | Promise<RouteParams>) {
  return params instanceof Promise ? params : Promise.resolve(params)
}

export async function GET(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const resolvedParams = await getParams(params)
  const clientId = Number.parseInt(resolvedParams.clientId, 10)
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const auth = await requireClientChatAccess(request, clientId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { actor } = auth
  const canMessage =
    actor.accountType === 'client' ||
    (actor.clientRow.handler_id || '').trim() === actor.user.id

  const markReadPromises: PromiseLike<unknown>[] = []
  if (actor.accountType === 'client') {
    markReadPromises.push(
      actor.supabase
        .from('client_chat_messages')
        .update({ read_by_client: true })
        .eq('client_id', clientId)
        .eq('isdeleted', false)
        .neq('sender_auth_id', actor.user.id)
        .or('read_by_client.is.null,read_by_client.eq.false')
        .then(({ error }) => {
          if (error) {
            console.warn('Failed to mark client chat messages as read for client', error.message)
          }
        })
    )
  } else {
    const isAssignedHandler = (actor.clientRow.handler_id || '').trim() === actor.user.id
    if (isAssignedHandler) {
      markReadPromises.push(
        actor.supabase
          .from('client_chat_messages')
          .update({ read_by_employee: true })
          .eq('client_id', clientId)
          .eq('isdeleted', false)
          .neq('sender_auth_id', actor.user.id)
          .or('read_by_employee.is.null,read_by_employee.eq.false')
          .then(({ error }) => {
            if (error) {
              console.warn('Failed to mark client chat messages as read for employee', error.message)
            }
          })
      )
    }
  }
  void Promise.all(markReadPromises)

  const { searchParams } = new URL(request.url)
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '12', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 4
  const requestedBeforeId = Number.parseInt(searchParams.get('beforeId') || '', 10)
  const beforeId = Number.isFinite(requestedBeforeId) && requestedBeforeId > 0 ? requestedBeforeId : null

  let messagesQuery = actor.supabase
    .from('client_chat_messages')
    .select('id, client_id, sender_auth_id, message, read_by_client, read_by_employee, created_at, updated_at, isdeleted')
    .eq('client_id', clientId)
    .eq('isdeleted', false)
    .order('created_at', { ascending: false })

  if (beforeId !== null) {
    messagesQuery = messagesQuery.lt('id', beforeId)
  }

  const { data: messagesData, error: messagesError } = await messagesQuery.limit(limit + 1)

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message || 'Failed to load messages' }, { status: 500 })
  }

  const rawRows = (messagesData as ClientChatRow[] | null) ?? []
  const hasMore = rawRows.length > limit
  const rows = rawRows.slice(0, limit).reverse()
  const senderAuthIds = Array.from(new Set(rows.map((row) => row.sender_auth_id).filter(Boolean)))

  const [employeesResult, clientsResult] = await Promise.all([
    senderAuthIds.length
      ? actor.supabase
          .from('employees')
          .select('auth_id, employee_name')
          .in('auth_id', senderAuthIds)
          .neq('isdeleted', true)
      : Promise.resolve({ data: [], error: null }),
    senderAuthIds.length
      ? actor.supabase
          .from('clients')
          .select('auth_id, name')
          .in('auth_id', senderAuthIds)
          .neq('isdeleted', true)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (employeesResult.error || clientsResult.error) {
    return NextResponse.json(
      { error: employeesResult.error?.message || clientsResult.error?.message || 'Failed to load senders' },
      { status: 500 }
    )
  }

  const senderNameByAuthId = new Map<string, string>()
  ;(((employeesResult.data as Array<{ auth_id?: string | null; employee_name?: string | null }> | null) ?? [])).forEach((row) => {
    const authId = (row.auth_id || '').trim()
    if (!authId) return
    senderNameByAuthId.set(authId, row.employee_name?.trim() || 'Employee')
  })
  ;(((clientsResult.data as Array<{ auth_id?: string | null; name?: string | null }> | null) ?? [])).forEach((row) => {
    const authId = (row.auth_id || '').trim()
    if (!authId || senderNameByAuthId.has(authId)) return
    senderNameByAuthId.set(authId, row.name?.trim() || 'Client')
  })

  const senderAvatarByAuthId = new Map<string, string>()
  const now = Date.now()
  const senderAuthIdsNeedingLookup = senderAuthIds.filter((authId) => {
    const key = authId.trim()
    if (!key) return false
    const cached = senderAvatarCache.get(key)
    if (!cached) return true
    if (cached.expiresAt <= now) {
      senderAvatarCache.delete(key)
      return true
    }
    if (cached.url) {
      senderAvatarByAuthId.set(key, cached.url)
    }
    return false
  })

  await Promise.all(
    senderAuthIdsNeedingLookup.map(async (authId) => {
      const senderFolder = authId.trim()
      if (!senderFolder) return

      const { data: files, error } = await actor.supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .list(senderFolder, {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error || !files?.length) {
        senderAvatarCache.set(senderFolder, { url: null, expiresAt: now + AVATAR_CACHE_TTL_MS })
        return
      }
      const avatarFile = files.find((file) => Boolean(file.name))
      if (!avatarFile?.name) {
        senderAvatarCache.set(senderFolder, { url: null, expiresAt: now + AVATAR_CACHE_TTL_MS })
        return
      }

      const avatarPath = `${senderFolder}/${avatarFile.name}`
      const { data } = actor.supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(avatarPath)
      if (data?.publicUrl) {
        senderAvatarByAuthId.set(senderFolder, data.publicUrl)
        senderAvatarCache.set(senderFolder, { url: data.publicUrl, expiresAt: now + AVATAR_CACHE_TTL_MS })
      } else {
        senderAvatarCache.set(senderFolder, { url: null, expiresAt: now + AVATAR_CACHE_TTL_MS })
      }
    })
  )

  const messageIds = rows.map((row) => row.id)
  let attachmentRowsData: ClientChatAttachmentRow[] | null = []
  if (messageIds.length) {
    const { data } = await actor.supabase
      .from('client_chat_message_attachments')
      .select('message_id, attachment_name, attachment_path, sort_order')
      .in('message_id', messageIds)
      .order('sort_order', { ascending: true })

    attachmentRowsData = (data as ClientChatAttachmentRow[] | null) ?? []
  }

  const attachmentsByMessageId = new Map<number, Array<{ name: string; path: string }>>()
  ;((attachmentRowsData ?? [])).forEach((row) => {
    const messageId = Number(row.message_id)
    const attachmentName = (row.attachment_name || '').trim()
    const attachmentPath = (row.attachment_path || '').trim()
    if (!Number.isFinite(messageId) || messageId < 1 || !attachmentName || !attachmentPath) return
    const current = attachmentsByMessageId.get(messageId) || []
    current.push({ name: attachmentName, path: attachmentPath })
    attachmentsByMessageId.set(messageId, current)
  })

  const attachmentUrlByPath = new Map<string, string>()
  const nowForAttachments = Date.now()
  const attachmentPaths = Array.from(
    new Set(
      Array.from(attachmentsByMessageId.values())
        .flat()
        .map((attachment) => attachment.path)
        .filter(Boolean)
    )
  )
  const attachmentPathsToSign = attachmentPaths.filter((path) => {
    const cached = attachmentSignedUrlCache.get(path)
    if (!cached) return true
    if (cached.expiresAt <= nowForAttachments) {
      attachmentSignedUrlCache.delete(path)
      return true
    }
    attachmentUrlByPath.set(path, cached.url)
    return false
  })

  await Promise.all(
    attachmentPathsToSign.map(async (path) => {
      const { data } = await actor.supabase.storage.from(CHAT_BUCKET).createSignedUrl(path, 60 * 60)
      const signedUrl = data?.signedUrl ?? ''
      if (!signedUrl) return
      attachmentUrlByPath.set(path, signedUrl)
      attachmentSignedUrlCache.set(path, {
        url: signedUrl,
        expiresAt: nowForAttachments + ATTACHMENT_URL_TTL_MS,
      })
    })
  )

  const messages = rows.map((row) => {
    const attachments = (attachmentsByMessageId.get(row.id) || []).map((attachment) => ({
      name: attachment.name,
      url: attachmentUrlByPath.get(attachment.path) || null,
    }))
    const primaryAttachment = attachments[0]

    return {
      id: row.id,
      clientId: row.client_id,
      senderAuthId: row.sender_auth_id,
      senderName: senderNameByAuthId.get(row.sender_auth_id) || 'User',
      senderAvatarUrl: senderAvatarByAuthId.get(row.sender_auth_id) || null,
      message: row.message || '',
      attachmentName: primaryAttachment?.name || '',
      attachmentUrl: primaryAttachment?.url || null,
      attachments,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isOwnMessage:
        actor.accountType === 'employee' &&
        (actor.clientRow.handler_id || '').trim() &&
        actor.user.id !== (actor.clientRow.handler_id || '').trim()
          ? row.sender_auth_id === (actor.clientRow.handler_id || '').trim()
          : row.sender_auth_id === actor.user.id,
      seenByRecipient:
        row.sender_auth_id === actor.clientRow.auth_id
          ? Boolean(row.read_by_employee)
          : row.sender_auth_id === actor.clientRow.handler_id
            ? Boolean(row.read_by_client)
            : false,
    }
  })

  let handlerName = 'Handler'
  if ((actor.clientRow.handler_id || '').trim()) {
    const handlerId = (actor.clientRow.handler_id || '').trim()
    const cachedHandler = handlerNameCache.get(handlerId)
    const nowForHandler = Date.now()
    if (cachedHandler && cachedHandler.expiresAt > nowForHandler) {
      handlerName = cachedHandler.name || 'Handler'
    } else {
      const { data: handlerData } = await actor.supabase
        .from('employees')
        .select('employee_name')
        .eq('auth_id', handlerId)
        .neq('isdeleted', true)
        .maybeSingle()

      handlerName = ((handlerData as { employee_name?: string | null } | null)?.employee_name || '').trim() || 'Handler'
      handlerNameCache.set(handlerId, {
        name: handlerName,
        expiresAt: nowForHandler + HANDLER_NAME_TTL_MS,
      })
    }
  }

  return NextResponse.json({
    client: {
      id: actor.clientRow.id,
      name: actor.clientRow.name || 'Client',
      email: actor.clientRow.email || '',
      handlerName,
    },
    messages,
    hasMore,
    canMessage,
  })
}

export async function POST(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const resolvedParams = await getParams(params)
  const clientId = Number.parseInt(resolvedParams.clientId, 10)
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const auth = await requireClientChatAccess(request, clientId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const canMessage =
    auth.actor.accountType === 'client' ||
    (auth.actor.clientRow.handler_id || '').trim() === auth.actor.user.id

  if (!canMessage) {
    return NextResponse.json({ error: 'Only the assigned handler can message this client' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { message?: string } | null
  const message = String(body?.message ?? '').trim()

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  const { data, error } = await auth.actor.supabase
    .from('client_chat_messages')
    .insert({
      client_id: clientId,
      sender_auth_id: auth.actor.user.id,
      message,
      isdeleted: false,
      read_by_client: auth.actor.accountType === 'client',
      read_by_employee: auth.actor.accountType === 'employee',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 })
  }

  await sendHandlerChatPush({
    supabase: auth.actor.supabase,
    clientId,
    senderAuthId: auth.actor.user.id,
    title: `New message from ${auth.actor.clientRow.name || auth.actor.clientRow.email || 'Client'}`,
    body: message,
    url: `/dashboard/clients?chatClientId=${clientId}`,
  })

  return NextResponse.json({ ok: true, id: data?.id ?? null })
}
