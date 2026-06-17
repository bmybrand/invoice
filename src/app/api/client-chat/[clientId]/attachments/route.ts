import { NextResponse } from 'next/server'
import { uploadToDrive } from '@/lib/server-google-drive'
import { requireClientChatAccess } from '@/lib/server-client-chat-auth'
import { sendHandlerChatPush } from '@/lib/server-push-notifications'

type RouteParams = { clientId: string }

const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024
const ALLOWED_CHAT_FILE_TYPES = new Set([
  'application/pdf',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
])

function getParams(params: RouteParams | Promise<RouteParams>) {
  return params instanceof Promise ? params : Promise.resolve(params)
}

type CompleteAttachmentBody = {
  operation: 'complete'
  filePath?: string
  fileId?: string
  attachmentName?: string
  message?: string
  attachments?: Array<{
    filePath?: string
    fileId?: string
    attachmentName?: string
  }>
}

type UploadedAttachment = {
  fileId: string
  attachmentName: string
}

async function saveAttachmentMessage({
  auth,
  clientId,
  attachments,
  message,
}: {
  auth: Extract<Awaited<ReturnType<typeof requireClientChatAccess>>, { ok: true }>
  clientId: number
  attachments: UploadedAttachment[]
  message: string
}) {
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
    return {
      ok: false as const,
      status: 500,
      error: insertError.message || 'Failed to save attachment message',
    }
  }

  const messageId = Number(messageData?.id ?? 0)
  if (!Number.isFinite(messageId) || messageId < 1) {
    return { ok: false as const, status: 500, error: 'Failed to save attachment message' }
  }

  const { error: attachmentsInsertError } = await auth.actor.supabase
    .from('client_chat_message_attachments')
    .insert(
      attachments.map((attachment, index) => ({
        message_id: messageId,
        attachment_name: attachment.attachmentName,
        attachment_path: attachment.fileId,
        sort_order: index,
      }))
    )

  if (attachmentsInsertError) {
    await auth.actor.supabase
      .from('client_chat_messages')
      .update({ isdeleted: true })
      .eq('id', messageId)

    return {
      ok: false as const,
      status: 500,
      error: attachmentsInsertError.message || 'Failed to save message attachments',
    }
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

  return { ok: true as const, id: messageId }
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

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const message = String(formData.get('message') ?? '').trim()
    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)

    if (files.length === 0) {
      return NextResponse.json({ error: 'At least one attachment is required' }, { status: 400 })
    }

    const invalidType = files.find((file) => !ALLOWED_CHAT_FILE_TYPES.has(file.type))
    if (invalidType) {
      return NextResponse.json({ error: 'Only images and PDFs can be uploaded.' }, { status: 400 })
    }

    const invalidSize = files.find((file) => file.size > MAX_CHAT_FILE_BYTES)
    if (invalidSize) {
      return NextResponse.json({ error: 'Chat files must be 20MB or smaller.' }, { status: 400 })
    }

    try {
      const attachments = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToDrive(file, 'chat-files')
          return {
            fileId: result.fileId,
            attachmentName: file.name || 'Attachment',
          }
        })
      )

      const saveResult = await saveAttachmentMessage({ auth, clientId, attachments, message })
      if (!saveResult.ok) {
        return NextResponse.json({ error: saveResult.error }, { status: saveResult.status })
      }

      return NextResponse.json({
        ok: true,
        id: saveResult.id,
        attachments: attachments.map((attachment) => ({
          fileId: attachment.fileId,
          attachmentName: attachment.attachmentName,
        })),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload attachment'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as
      | CompleteAttachmentBody
      | null

    if (body?.operation === 'complete') {
      const normalizedAttachments = Array.isArray(body.attachments)
        ? body.attachments
            .map((attachment) => ({
              fileId: String(attachment?.fileId ?? attachment?.filePath ?? '').trim(),
              attachmentName: String(attachment?.attachmentName ?? '').trim(),
            }))
            .filter((attachment) => attachment.fileId && attachment.attachmentName)
        : []
      const legacyFileId = String(body.fileId ?? body.filePath ?? '').trim()
      const legacyAttachmentName = String(body.attachmentName ?? '').trim()
      const attachments =
        normalizedAttachments.length > 0
          ? normalizedAttachments
          : legacyFileId && legacyAttachmentName
            ? [{ fileId: legacyFileId, attachmentName: legacyAttachmentName }]
            : []
      const message = String(body.message ?? '').trim()

      if (attachments.length === 0) {
        return NextResponse.json({ error: 'Attachment details are required' }, { status: 400 })
      }

      const saveResult = await saveAttachmentMessage({ auth, clientId, attachments, message })
      if (!saveResult.ok) {
        return NextResponse.json({ error: saveResult.error }, { status: saveResult.status })
      }

      return NextResponse.json({ ok: true, id: saveResult.id })
    }

    return NextResponse.json({ error: 'Invalid attachment operation' }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
}
