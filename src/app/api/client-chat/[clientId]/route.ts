import { NextResponse } from 'next/server'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'

type RouteParams = { clientId: string }

type ClientChatRow = {
  id: number
  client_id: number
  sender_auth_id: string
  message: string | null
  attachment_name: string | null
  attachment_path: string | null
  created_at: string | null
  updated_at: string | null
  isdeleted: boolean | null
}

const CHAT_BUCKET = 'client-chat-files'

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

  const { data: messagesData, error: messagesError } = await actor.supabase
    .from('client_chat_messages')
    .select('id, client_id, sender_auth_id, message, attachment_name, attachment_path, created_at, updated_at, isdeleted')
    .eq('client_id', clientId)
    .eq('isdeleted', false)
    .order('created_at', { ascending: false })

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message || 'Failed to load messages' }, { status: 500 })
  }

  const rows = ((messagesData as ClientChatRow[] | null) ?? []).reverse()
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
        message: row.message || '',
        attachmentName: row.attachment_name || '',
        attachmentUrl,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isOwnMessage: row.sender_auth_id === actor.user.id,
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
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null })
}
