import { NextResponse } from 'next/server'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'

type RouteParams = { clientId: string; messageId: string }

function getParams(params: RouteParams | Promise<RouteParams>) {
  return params instanceof Promise ? params : Promise.resolve(params)
}

export async function PATCH(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const resolvedParams = await getParams(params)
  const clientId = Number.parseInt(resolvedParams.clientId, 10)
  const messageId = Number.parseInt(resolvedParams.messageId, 10)

  if (!Number.isFinite(clientId) || clientId < 1 || !Number.isFinite(messageId) || messageId < 1) {
    return NextResponse.json({ error: 'Invalid chat message' }, { status: 400 })
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

  const { data: existing, error: fetchError } = await auth.actor.supabase
    .from('client_chat_messages')
    .select('id, sender_auth_id')
    .eq('id', messageId)
    .eq('client_id', clientId)
    .eq('isdeleted', false)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message || 'Message not found' }, { status: 404 })
  }

  if ((existing as { sender_auth_id?: string | null }).sender_auth_id !== auth.actor.user.id) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
  }

  const { error } = await auth.actor.supabase
    .from('client_chat_messages')
    .update({
      message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to update message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const resolvedParams = await getParams(params)
  const clientId = Number.parseInt(resolvedParams.clientId, 10)
  const messageId = Number.parseInt(resolvedParams.messageId, 10)

  if (!Number.isFinite(clientId) || clientId < 1 || !Number.isFinite(messageId) || messageId < 1) {
    return NextResponse.json({ error: 'Invalid chat message' }, { status: 400 })
  }

  const auth = await requireClientChatAccess(request, clientId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data: existing, error: fetchError } = await auth.actor.supabase
    .from('client_chat_messages')
    .select('id, sender_auth_id')
    .eq('id', messageId)
    .eq('client_id', clientId)
    .eq('isdeleted', false)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message || 'Message not found' }, { status: 404 })
  }

  if ((existing as { sender_auth_id?: string | null }).sender_auth_id !== auth.actor.user.id) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
  }

  const { error } = await auth.actor.supabase
    .from('client_chat_messages')
    .update({
      isdeleted: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId)

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to delete message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
