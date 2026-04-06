import { NextResponse } from 'next/server'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'
import { sendHandlerChatPush } from '@/lib/server-push-notifications'

type RouteParams = { clientId: string }

type ClientChatRow = {
  id: number
  client_id: number
  sender_auth_id: string
  message: string | null
  attachment_name: string | null
  attachment_path: string | null
  read_by_client: boolean | null
  read_by_employee: boolean | null
  created_at: string | null
  updated_at: string | null
  isdeleted: boolean | null
}

const CHAT_BUCKET = 'client-chat-files'
const PROFILE_AVATAR_BUCKET = 'profile-images'

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

  if (actor.accountType === 'client') {
    void actor.supabase
      .from('client_chat_messages')
      .update({ read_by_client: true })
      .eq('client_id', clientId)
      .eq('isdeleted', false)
      .neq('sender_auth_id', actor.user.id)
      .eq('read_by_client', false)
  } else {
    const isAssignedHandler = (actor.clientRow.handler_id || '').trim() === actor.user.id
    if (isAssignedHandler) {
      void actor.supabase
        .from('client_chat_messages')
        .update({ read_by_employee: true })
        .eq('client_id', clientId)
        .eq('isdeleted', false)
        .neq('sender_auth_id', actor.user.id)
        .eq('read_by_employee', false)
    }
  }

  const { searchParams } = new URL(request.url)
  const requestedLimit = Number.parseInt(searchParams.get('limit') || '4', 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 4
  const requestedBeforeId = Number.parseInt(searchParams.get('beforeId') || '', 10)
  const beforeId = Number.isFinite(requestedBeforeId) && requestedBeforeId > 0 ? requestedBeforeId : null

  let messagesQuery = actor.supabase
    .from('client_chat_messages')
    .select('id, client_id, sender_auth_id, message, attachment_name, attachment_path, read_by_client, read_by_employee, created_at, updated_at, isdeleted')
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
  await Promise.all(
    senderAuthIds.map(async (authId) => {
      const senderFolder = authId.trim()
      if (!senderFolder) return

      const { data: files, error } = await actor.supabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .list(senderFolder, {
          limit: 20,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error || !files?.length) return
      const avatarFile = files.find((file) => Boolean(file.name))
      if (!avatarFile?.name) return

      const avatarPath = `${senderFolder}/${avatarFile.name}`
      const { data } = actor.supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(avatarPath)
      if (data?.publicUrl) {
        senderAvatarByAuthId.set(senderFolder, data.publicUrl)
      }
    })
  )

  const messages = await Promise.all(
    rows.map(async (row) => {
      let attachmentUrl: string | null = null

      if ((row.attachment_path || '').trim()) {
        const { data } = await actor.supabase.storage.from(CHAT_BUCKET).createSignedUrl(row.attachment_path!, 60 * 60)
        attachmentUrl = data?.signedUrl ?? null
      }

      return {
        id: row.id,
        clientId: row.client_id,
        senderAuthId: row.sender_auth_id,
        senderName: senderNameByAuthId.get(row.sender_auth_id) || 'User',
        senderAvatarUrl: senderAvatarByAuthId.get(row.sender_auth_id) || null,
        message: row.message || '',
        attachmentName: row.attachment_name || '',
        attachmentUrl,
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
  )

  let handlerName = 'Handler'
  if ((actor.clientRow.handler_id || '').trim()) {
    const { data: handlerData } = await actor.supabase
      .from('employees')
      .select('employee_name')
      .eq('auth_id', actor.clientRow.handler_id)
      .neq('isdeleted', true)
      .maybeSingle()

    handlerName = ((handlerData as { employee_name?: string | null } | null)?.employee_name || '').trim() || 'Handler'
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
    url: '/dashboard/clients',
  })

  return NextResponse.json({ ok: true, id: data?.id ?? null })
}
