type DriveToken = {
  accessToken: string
  expiresAt: number
}

export type DriveUploadResult = {
  fileId: string
  publicViewUrl: string
}

export type DriveMediaResult = {
  body: ArrayBuffer
  contentType: string
  contentLength: number
}

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&supportsAllDrives=true'
const DRIVE_PERMISSION_ROLE = 'reader'
const DRIVE_PERMISSION_TYPE = 'anyone'

let cachedToken: DriveToken | null = null
const folderIdCache = new Map<string, string>()

function getDriveConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim()
  const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim()

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive OAuth is not configured. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN.'
    )
  }

  return { clientId, clientSecret, refreshToken, rootFolderId }
}

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken
  }

  const { clientId, clientSecret, refreshToken } = getDriveConfig()
  const response = await fetch(DRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error_description?: string; error?: string }
    | null

  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || 'Failed to authenticate with Google Drive.')
  }

  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: now + Math.max(1, Number(payload.expires_in ?? 3600) - 60) * 1000,
  }

  return cachedToken.accessToken
}

function driveUrl(fileId: string) {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function ensureFolder(folderName: string, accessToken: string) {
  const normalizedFolderName = folderName.replace(/^\/+|\/+$/g, '').trim()
  if (!normalizedFolderName) {
    throw new Error('Google Drive folder name is required.')
  }

  const cached = folderIdCache.get(normalizedFolderName)
  if (cached) return cached

  const { rootFolderId } = getDriveConfig()
  const escapedName = escapeDriveQueryValue(normalizedFolderName)
  const parentQuery = rootFolderId ? [`'${escapeDriveQueryValue(rootFolderId)}' in parents`] : []
  const query = [
    `name='${escapedName}'`,
    "mimeType='application/vnd.google-apps.folder'",
    'trashed=false',
    ...parentQuery,
  ].join(' and ')

  const listUrl = new URL(DRIVE_FILES_URL)
  listUrl.searchParams.set('q', query)
  listUrl.searchParams.set('fields', 'files(id,name)')
  listUrl.searchParams.set('pageSize', '1')
  listUrl.searchParams.set('supportsAllDrives', 'true')
  listUrl.searchParams.set('includeItemsFromAllDrives', 'true')

  const listResponse = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const listPayload = (await listResponse.json().catch(() => null)) as
    | { files?: Array<{ id?: string }>; error?: { message?: string } }
    | null

  if (!listResponse.ok) {
    throw new Error(listPayload?.error?.message || 'Failed to find Google Drive folder.')
  }

  const existingId = listPayload?.files?.[0]?.id
  if (existingId) {
    folderIdCache.set(normalizedFolderName, existingId)
    return existingId
  }

  const createUrl = new URL(DRIVE_FILES_URL)
  createUrl.searchParams.set('supportsAllDrives', 'true')

  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: normalizedFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(rootFolderId ? { parents: [rootFolderId] } : {}),
    }),
  })
  const createPayload = (await createResponse.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null

  if (!createResponse.ok || !createPayload?.id) {
    throw new Error(createPayload?.error?.message || 'Failed to create Google Drive folder.')
  }

  folderIdCache.set(normalizedFolderName, createPayload.id)
  return createPayload.id
}

function sanitizeDriveFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'upload'
}

export async function uploadToDrive(file: File, folderName: string): Promise<DriveUploadResult> {
  if (!file || file.size < 1) {
    throw new Error('A non-empty file is required.')
  }

  const accessToken = await getAccessToken()
  const folderId = await ensureFolder(folderName, accessToken)
  const metadata = {
    name: sanitizeDriveFileName(file.name || 'upload'),
    parents: [folderId],
  }

  const formData = new FormData()
  formData.set('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  formData.set('file', file, metadata.name)

  const uploadResponse = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  })
  const uploadPayload = (await uploadResponse.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null

  if (!uploadResponse.ok || !uploadPayload?.id) {
    throw new Error(uploadPayload?.error?.message || 'Failed to upload file to Google Drive.')
  }

  const fileId = uploadPayload.id
  const permissionUrl = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}/permissions`)
  permissionUrl.searchParams.set('supportsAllDrives', 'true')

  const permissionResponse = await fetch(permissionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: DRIVE_PERMISSION_ROLE,
      type: DRIVE_PERMISSION_TYPE,
    }),
  })

  if (!permissionResponse.ok) {
    throw new Error('Uploaded file, but failed to make it viewable by link.')
  }

  return {
    fileId,
    publicViewUrl: driveUrl(fileId),
  }
}

export function getDrivePublicViewUrl(fileId: string) {
  const trimmed = fileId.trim()
  return trimmed ? driveUrl(trimmed) : ''
}

export function getDriveProxyUrl(fileId: string) {
  const trimmed = fileId.trim()
  return trimmed ? `/api/google-drive/files/${encodeURIComponent(trimmed)}` : ''
}

export async function getDriveFileMedia(fileId: string): Promise<DriveMediaResult> {
  const trimmed = fileId.trim()
  if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Invalid Google Drive file ID.')
  }

  const accessToken = await getAccessToken()
  const mediaUrl = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(trimmed)}`)
  mediaUrl.searchParams.set('alt', 'media')
  mediaUrl.searchParams.set('supportsAllDrives', 'true')

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to load Google Drive file: ${response.status}`)
  }

  const body = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  return {
    body,
    contentType,
    contentLength: body.byteLength,
  }
}

export async function deleteDriveFile(fileId: string) {
  const trimmed = fileId.trim()
  if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return false
  }

  const accessToken = await getAccessToken()
  const deleteUrl = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(trimmed)}`)
  deleteUrl.searchParams.set('supportsAllDrives', 'true')

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (response.status === 404) {
    return false
  }

  if (!response.ok) {
    throw new Error(`Failed to delete Google Drive file: ${response.status}`)
  }

  return true
}
