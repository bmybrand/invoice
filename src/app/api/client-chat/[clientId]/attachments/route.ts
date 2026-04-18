import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'
import { sendHandlerChatPush } from '@/lib/server-push-notifications'

type RouteParams = { clientId: string }

const CHAT_BUCKET = 'client-chat-files'

function getParams(params: RouteParams | Promise<RouteParams>) {
  return params instanceof Promise ? params : Promise.resolve(params)
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-')
}

type PrepareAttachmentBody = {
  operation: 'prepare'
  fileName?: string
}

type CompleteAttachmentBody = {
  operation: 'complete'
  filePath?: string
  attachmentName?: string
  message?: string
  attachments?: Array<{
    filePath?: string
    attachmentName?: string
  }>
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

  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as
      | PrepareAttachmentBody
      | CompleteAttachmentBody
      | null

    if (body?.operation === 'prepare') {
      const fileName = sanitizeFileName(String(body.fileName ?? '').trim() || 'attachment')
      const filePath = `client-${clientId}/${Date.now()}-${randomUUID()}-${fileName}`

      const { data, error } = await auth.actor.supabase.storage
        .from(CHAT_BUCKET)
        .createSignedUploadUrl(filePath)

      if (error || !data?.token) {
        return NextResponse.json(
          { error: error?.message || 'Failed to prepare attachment upload' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        filePath,
        token: data.token,
      })
    }

    if (body?.operation === 'complete') {
      const normalizedAttachments = Array.isArray(body.attachments)
        ? body.attachments
            .map((attachment) => ({
              filePath: String(attachment?.filePath ?? '').trim(),
              attachmentName: String(attachment?.attachmentName ?? '').trim(),
            }))
            .filter((attachment) => attachment.filePath && attachment.attachmentName)
        : []
      const legacyFilePath = String(body.filePath ?? '').trim()
      const legacyAttachmentName = String(body.attachmentName ?? '').trim()
      const attachments =
        normalizedAttachments.length > 0
          ? normalizedAttachments
          : legacyFilePath && legacyAttachmentName
            ? [{ filePath: legacyFilePath, attachmentName: legacyAttachmentName }]
            : []
      const message = String(body.message ?? '').trim()

      if (attachments.length === 0) {
        return NextResponse.json({ error: 'Attachment details are required' }, { status: 400 })
      }

      const { data: messageData, error: insertError } = await auth.actor.supabase
        .from('client_chat_messages')
        .insert({
          client_id: clientId,
          sender_auth_id: auth.actor.user.id,
          message: message || null,
          isdeleted: false,
          read_by_client: auth.actor.accountType === 'client',
          read_by_employee: auth.actor.accountType === 'employee',
        })
        .select('id')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || 'Failed to save attachment message' },
          { status: 500 }
        )
      }

      const messageId = Number(messageData?.id ?? 0)
      if (!Number.isFinite(messageId) || messageId < 1) {
        return NextResponse.json({ error: 'Failed to save attachment message' }, { status: 500 })
      }

      const { error: attachmentsInsertError } = await auth.actor.supabase
        .from('client_chat_message_attachments')
        .insert(
          attachments.map((attachment, index) => ({
            message_id: messageId,
            attachment_name: attachment.attachmentName,
            attachment_path: attachment.filePath,
            sort_order: index,
          }))
        )

      if (attachmentsInsertError) {
        await auth.actor.supabase
          .from('client_chat_messages')
          .update({ isdeleted: true })
          .eq('id', messageId)

        return NextResponse.json(
          { error: attachmentsInsertError.message || 'Failed to save message attachments' },
          { status: 500 }
        )
      }

      await sendHandlerChatPush({
        supabase: auth.actor.supabase,
        clientId,
        senderAuthId: auth.actor.user.id,
        title: `New file from ${auth.actor.clientRow.name || auth.actor.clientRow.email || 'Client'}`,
        body:
          message ||
          (attachments.length === 1
            ? `Attachment: ${attachments[0]?.attachmentName || 'Attachment'}`
            : `${attachments.length} attachments`),
        url: `/dashboard/clients?chatClientId=${clientId}`,
      })

      return NextResponse.json({ ok: true, id: messageId })
    }

    return NextResponse.json({ error: 'Invalid attachment operation' }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
}
