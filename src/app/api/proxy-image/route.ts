import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = res.headers.get('content-type') || 'image/png'
    const dataUrl = `data:${contentType};base64,${base64}`
    return NextResponse.json({ dataUrl })
  } catch (err) {
    console.error('Proxy image failed:', err)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
