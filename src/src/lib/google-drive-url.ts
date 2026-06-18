export function getGoogleDriveFileId(value: string | null | undefined) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''

  if (!trimmed.includes('drive.google.com')) {
    return trimmed
  }

  const url = new URL(trimmed)
  const queryId = url.searchParams.get('id')?.trim()
  if (queryId) return queryId

  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/)
  const folderMatch = url.pathname.match(/\/folders\/([^/]+)/)
  return fileMatch?.[1] || folderMatch?.[1] || ''
}

export function getGoogleDrivePublicUrl(fileId: string | null | undefined) {
  const id = getGoogleDriveFileId(fileId)
  return id ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}` : ''
}

export function getGoogleDriveImageUrl(value: string | null | undefined) {
  const id = getGoogleDriveFileId(value)
  if (!id) return ''
  return `/api/google-drive/files/${encodeURIComponent(id)}`
}
