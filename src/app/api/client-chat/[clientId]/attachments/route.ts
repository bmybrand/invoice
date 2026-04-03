import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'

type RouteParams = { clientId: string }

const CHAT_BUCKET = 'client-chat-files'

function getParams(params: RouteParams | Promise<RouteParams>) {
  return params instanceof Promise ? params : Promise.resolve(params)
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
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

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  const message = String(formData?.get('message') ?? '').trim()

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const fileName = sanitizeFileName(file.name || 'attachment')
  const filePath = `client-${clientId}/${Date.now()}-${randomUUID()}-${fileName}`

  const { error: uploadError } = await auth.actor.supabase.storage
    .from(CHAT_BUCKET)
    .upload(filePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || 'Failed to upload file' }, { status: 500 })
  }

  const { data: messageData, error: insertError } = await auth.actor.supabase
    .from('client_chat_messages')
    .insert({
      client_id: clientId,
      sender_auth_id: auth.actor.user.id,
      message: message || null,
      attachment_name: file.name || fileName,
      attachment_path: filePath,
      isdeleted: false,
      read_by_client: auth.actor.accountType === 'client',
      read_by_employee: auth.actor.accountType === 'employee',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message || 'Failed to save attachment message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: messageData?.id ?? null })
}
