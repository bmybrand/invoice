'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'

const RichTextEditor = dynamic(() => import('@/components/BlogRichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-500">
      Loading editor…
    </div>
  ),
})

type BlogRow = {
  slug: string
  title: string
  excerpt: string
  category: string
  published_on: string
  updated_on: string | null
  read_time: string
  author: string
  hero_image: string
  accent: string
  display_number: string
  sort_order: number
  tags: unknown[]
  highlights: unknown[]
  introduction: unknown[]
  sections: unknown[]
  conclusion: unknown
  closing_images: unknown[] | null
  faqs: unknown[]
  is_published: boolean
}

type VisualSection = {
  id: string
  title: string
  paragraphs: string[]
  bullets?: string[]
  bulletsTitle?: string
  image?: string
  imageAlt?: string
  images?: Array<{ src: string; alt: string }>
  itemsTitle?: string
  itemsDescription?: string
  divideItems?: boolean
  items?: Array<{ title: string; description: string; bullets?: string[] }>
  html?: string
  hideTitle?: boolean
  hideFromJump?: boolean
  blocks?: FlexibleBlock[]
}

type FlexibleBlock = {
  type: 'richtext' | 'heading' | 'paragraph' | 'points' | 'image' | 'banner' | 'html'
  text?: string
  level?: 2 | 3
  items?: string[]
  image?: string
  alt?: string
  width?: number
  columns?: number
  rowStart?: boolean
  heading?: string
  html?: string
}

type EditorState = {
  originalSlug: string
  slug: string
  title: string
  excerpt: string
  category: string
  publishedOn: string
  updatedOn: string
  readTime: string
  author: string
  heroImage: string
  accent: string
  displayNumber: string
  sortOrder: string
  tags: string
  highlights: string
  introduction: string
  sections: string
  customHtml: string
  conclusion: string
  closingImages: string
  faqs: string
  isPublished: boolean
}

const today = new Date().toISOString().slice(0, 10)
const EMPTY_EDITOR: EditorState = {
  originalSlug: '',
  slug: '',
  title: '',
  excerpt: '',
  category: '',
  publishedOn: today,
  updatedOn: today,
  readTime: '5 min read',
  author: 'BmyBrand Editorial Team',
  heroImage: '',
  accent: '#F45B25',
  displayNumber: '',
  sortOrder: '0',
  tags: '',
  highlights: '',
  introduction: '',
  sections: '[\n  {\n    "id": "flexible-content",\n    "title": "",\n    "paragraphs": [],\n    "hideTitle": true,\n    "hideFromJump": true,\n    "blocks": []\n  }\n]',
  customHtml: '',
  conclusion: '',
  closingImages: '[]',
  faqs: '[]',
  isPublished: true,
}

const inputClass = 'w-full rounded-xl border border-slate-700 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400'
const pageInputClass = 'w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-inherit outline-none transition hover:border-white/10 hover:bg-white/[0.025] focus:border-orange-500/60 focus:bg-white/[0.04]'
const removeButtonClass = 'shrink-0 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/10'
const HTML_BLOCK_TEMPLATE = '<div class="blog-block">\n  <h3>Heading</h3>\n  <p>Content...</p>\n</div>'

function normalizeRole(role: string) {
  return role.trim().toLowerCase().replace(/\s+/g, '')
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? [], null, 2)
}

function slugifyBlogTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function plainTextFromHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function excerptFromSections(sections: unknown[]) {
  const pieces: string[] = []

  sections.forEach((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return
    const record = section as Record<string, unknown>

    if (Array.isArray(record.paragraphs)) {
      pieces.push(...record.paragraphs.filter((item): item is string => typeof item === 'string'))
    }

    if (Array.isArray(record.blocks)) {
      record.blocks.forEach((block) => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) return
        const blockRecord = block as Record<string, unknown>
        if (typeof blockRecord.html === 'string') pieces.push(plainTextFromHtml(blockRecord.html))
        else if (typeof blockRecord.text === 'string') pieces.push(blockRecord.text)
      })
    }
  })

  const excerpt = pieces.join(' ').replace(/\s+/g, ' ').trim()
  return excerpt.length > 220 ? `${excerpt.slice(0, 217).trimEnd()}...` : excerpt
}

function richTextH2Titles(sections: VisualSection[]) {
  const titles: string[] = []

  function collect(html: string | undefined) {
    if (!html) return
    for (const match of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
      const title = plainTextFromHtml(match[1])
      if (title) titles.push(title)
    }
  }

  sections.forEach((section) => {
    section.blocks?.forEach((block) => {
      if (block.type === 'richtext' || block.type === 'html') collect(block.html)
    })
    collect(section.html)
  })

  return titles
}

function editorFromBlog(blog: BlogRow): EditorState {
  const sections = (blog.sections ?? []).filter((section): section is Record<string, unknown> => Boolean(section && typeof section === 'object'))
  const customHtmlSection = sections.find((section) => section.id === 'custom-html-content')

  return {
    originalSlug: blog.slug,
    slug: blog.slug,
    title: blog.title,
    excerpt: blog.excerpt,
    category: blog.category,
    publishedOn: blog.published_on,
    updatedOn: blog.updated_on ?? blog.published_on,
    readTime: blog.read_time,
    author: blog.author,
    heroImage: blog.hero_image,
    accent: blog.accent,
    displayNumber: blog.display_number,
    sortOrder: String(blog.sort_order),
    tags: (blog.tags ?? []).join(', '),
    highlights: (blog.highlights ?? []).join('\n'),
    introduction: (blog.introduction ?? []).join('\n\n'),
    sections: pretty(sections.filter((section) => section.id !== 'custom-html-content')),
    customHtml: typeof customHtmlSection?.html === 'string' ? customHtmlSection.html : '',
    conclusion: Array.isArray(blog.conclusion) ? blog.conclusion.join('\n\n') : String(blog.conclusion ?? ''),
    closingImages: pretty(blog.closing_images),
    faqs: pretty(blog.faqs),
    isPublished: blog.is_published,
  }
}

function parseJsonArray(value: string, label: string) {
  const parsed = JSON.parse(value || '[]')
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a JSON array.`)
  return parsed
}

function parseVisualSections(value: string): VisualSection[] {
  try {
    const sections = JSON.parse(value || '[]')
    if (!Array.isArray(sections)) return []
    return sections.map((section, index) => {
      const source = section && typeof section === 'object' ? section as Partial<VisualSection> : {}
      return {
        ...source,
        id: source.id || `section-${index + 1}`,
        title: source.title || '',
        paragraphs: Array.isArray(source.paragraphs) ? source.paragraphs.map(String) : [],
      }
    })
  } catch {
    return []
  }
}

function parseFaqs(value: string): Array<{ question: string; answer: string }> {
  try {
    const faqs = JSON.parse(value || '[]')
    return Array.isArray(faqs)
      ? faqs.map((faq) => ({
          question: typeof faq?.question === 'string' ? faq.question : '',
          answer: typeof faq?.answer === 'string' ? faq.answer : '',
        }))
      : []
  } catch {
    return []
  }
}

function parseImages(value: string): Array<{ src: string; alt: string; columns?: number; rowStart?: boolean }> {
  try {
    const images = JSON.parse(value || '[]')
    return Array.isArray(images)
      ? images.map((image) => ({
          src: typeof image?.src === 'string' ? image.src : '',
          alt: typeof image?.alt === 'string' ? image.alt : '',
          columns: typeof image?.columns === 'number'
            ? Math.min(12, Math.max(1, Math.round(image.columns)))
            : 6,
          rowStart: typeof image?.rowStart === 'boolean' ? image.rowStart : undefined,
        }))
      : []
  } catch {
    return []
  }
}

function splitEditorLines(value: string, key: 'highlights' | 'introduction' | 'conclusion') {
  if (!value.length) return []
  return value.split(key === 'highlights' ? '\n' : /\n\s*\n/)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className={labelClass}>{label}</span>{children}</label>
}

const FLEXIBLE_BLOCK_TYPES: Array<{ type: FlexibleBlock['type']; label: string }> = [
  { type: 'richtext', label: 'Text Editor' },
  { type: 'image', label: 'Image' },
  { type: 'html', label: 'HTML' },
]

function blockColumns(block: FlexibleBlock) {
  if (block.columns) return Math.min(12, Math.max(1, Math.round(block.columns)))
  return Math.min(12, Math.max(1, Math.round(((block.width ?? 100) / 100) * 12)))
}

function availableColumnsInBlockRow(blocks: FlexibleBlock[], targetIndex: number) {
  let row = 0
  let usedColumns = 0
  const rowByIndex: number[] = []
  const usageByRow: number[] = []

  blocks.forEach((block, index) => {
    const columns = blockColumns(block)
    if (block.rowStart || usedColumns + columns > 12) {
      row += 1
      usedColumns = 0
    }
    usedColumns += columns
    rowByIndex[index] = row
    usageByRow[row] = usedColumns
  })

  return Math.max(0, 12 - (usageByRow[rowByIndex[targetIndex]] ?? 12))
}

function isFlexibleRowEnd(blocks: FlexibleBlock[], blockIndex: number) {
  let usedColumns = 0

  for (let index = 0; index <= blockIndex; index += 1) {
    const block = blocks[index]
    const columns = blockColumns(block)
    if (block.rowStart || usedColumns + columns > 12) usedColumns = 0
    usedColumns += columns
  }

  const nextBlock = blocks[blockIndex + 1]
  if (!nextBlock || nextBlock.rowStart || usedColumns === 12) return true
  return usedColumns + blockColumns(nextBlock) > 12
}

function BlockPalette({
  onInsert,
  onDragStateChange,
}: {
  onInsert: (type: FlexibleBlock['type']) => void
  onDragStateChange: (dragging: boolean) => void
}) {
  return (
    <div className="sticky top-20 z-20 mb-6 rounded-xl border border-white/10 bg-[#1A1B3B]/95 p-4 shadow-xl backdrop-blur">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/45">Drag a block into the article</p>
      <div className="flex flex-wrap gap-2">
        {FLEXIBLE_BLOCK_TYPES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData('application/x-blog-flexible-block', type)
              onDragStateChange(true)
            }}
            onDragEnd={() => onDragStateChange(false)}
            onClick={() => onInsert(type)}
            className="cursor-grab rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/65 transition hover:border-[#F45B25] hover:text-[#F45B25] active:cursor-grabbing"
          >
            + {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FlexibleDropZone({
  active,
  onDragEnter,
  onDrop,
}: {
  active: boolean
  onDragEnter: () => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-blog-flexible-index') ? 'move' : 'copy'
      }}
      onDrop={onDrop}
      className={`col-span-12 my-2 flex min-h-20 w-full items-center justify-center rounded-xl border-2 border-dashed transition ${
        active ? 'border-[#F45B25] bg-[#F45B25]/20 text-white' : 'border-[#F45B25]/45 bg-[#F45B25]/5 text-white/55'
      }`}
      aria-label="Drop block here"
    >
      <span className="pointer-events-none text-xs font-black uppercase tracking-[0.16em]">Drop as a new row</span>
    </div>
  )
}

export default function BlogManager() {
  const { token } = useSessionContext()
  const { accountType, displayRole, profileLoaded } = useDashboardProfile()
  const [blogs, setBlogs] = useState<BlogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [flexibleDropIndex, setFlexibleDropIndex] = useState<number | null>(null)
  const [flexibleDragging, setFlexibleDragging] = useState(false)
  const [flexibleDragSourceIndex, setFlexibleDragSourceIndex] = useState<number | null>(null)
  const [uploadingImageBlockIndex, setUploadingImageBlockIndex] = useState<number | null>(null)
  const [uploadingHeroImage, setUploadingHeroImage] = useState(false)
  const [uploadingClosingImageIndex, setUploadingClosingImageIndex] = useState<number | null>(null)
  const editorModalRef = useRef<HTMLDivElement>(null)

  const role = normalizeRole(displayRole)
  const canManage = accountType === 'employee' && (role === 'editor' || role === 'superadmin')
  const accessToken = token?.trim() || ''
  const editorIsOpen = editor !== null

  const loadBlogs = useCallback(async () => {
    if (!accessToken || !canManage) {
      setBlogs([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const response = await fetch('/api/blogs', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = (await response.json().catch(() => null)) as { blogs?: BlogRow[]; error?: string } | null
    if (!response.ok) setError(result?.error || 'Unable to load blogs.')
    setBlogs(result?.blogs ?? [])
    setLoading(false)
  }, [accessToken, canManage])

  useEffect(() => {
    if (profileLoaded) void loadBlogs()
  }, [loadBlogs, profileLoaded])

  useEffect(() => {
    if (!editorIsOpen) return
    const frame = window.requestAnimationFrame(() => {
      editorModalRef.current?.scrollTo({ top: 0 })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editorIsOpen])

  const filteredBlogs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return blogs
    return blogs.filter((blog) => `${blog.title} ${blog.slug} ${blog.category}`.toLowerCase().includes(needle))
  }, [blogs, query])

  function handleEditorDragOver(event: React.DragEvent<HTMLDivElement>) {
    if (!flexibleDragging || !editorModalRef.current) return
    const modal = editorModalRef.current
    const bounds = modal.getBoundingClientRect()
    const edge = Math.min(150, bounds.height * 0.22)
    const distanceFromTop = event.clientY - bounds.top
    const distanceFromBottom = bounds.bottom - event.clientY

    if (distanceFromTop < edge) {
      modal.scrollTop -= Math.max(14, Math.round((edge - distanceFromTop) / 3))
    } else if (distanceFromBottom < edge) {
      modal.scrollTop += Math.max(14, Math.round((edge - distanceFromBottom) / 3))
    }
  }

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => current ? { ...current, [key]: value } : current)
  }

  function updateLines(key: 'highlights' | 'introduction' | 'conclusion', index: number, value: string) {
    if (!editor) return
    const separator = key === 'highlights' ? '\n' : '\n\n'
    const lines = splitEditorLines(editor[key], key)
    lines[index] = value
    update(key, lines.join(separator))
  }

  function addLine(key: 'highlights' | 'introduction' | 'conclusion') {
    if (!editor) return
    const separator = key === 'highlights' ? '\n' : '\n\n'
    update(key, editor[key].length ? `${editor[key]}${separator} ` : ' ')
  }

  function removeLine(key: 'highlights' | 'introduction' | 'conclusion', index: number) {
    if (!editor) return
    const separator = key === 'highlights' ? '\n' : '\n\n'
    const lines = splitEditorLines(editor[key], key)
    lines.splice(index, 1)
    update(key, lines.join(separator))
  }

  function setVisualSections(sections: VisualSection[]) {
    update('sections', pretty(sections))
  }

  function isFlexibleContentSection(section: VisualSection) {
    return section.id === 'flexible-content' || Array.isArray(section.blocks)
  }

  function getFlexibleBlocks() {
    if (!editor) return []
    const sections = parseVisualSections(editor.sections)
    return sections.find(isFlexibleContentSection)?.blocks ?? []
  }

  function showsFlexibleCanvas() {
    if (!editor) return false
    return !editor.originalSlug || parseVisualSections(editor.sections).some(isFlexibleContentSection)
  }

  function setFlexibleBlocks(blocks: FlexibleBlock[]) {
    if (!editor) return
    const sections = parseVisualSections(editor.sections)
    const sectionIndex = sections.findIndex(isFlexibleContentSection)
    const section = sectionIndex >= 0
      ? sections[sectionIndex]
      : { id: 'flexible-content', title: '', paragraphs: [], hideTitle: true, hideFromJump: true }
    const nextSection = { ...section, id: 'flexible-content', title: '', paragraphs: [], hideTitle: true, hideFromJump: true, blocks }
    if (sectionIndex >= 0) sections[sectionIndex] = nextSection
    else sections.unshift(nextSection)
    setVisualSections(sections)
  }

  function createFlexibleBlock(type: FlexibleBlock['type'], columns = 12): FlexibleBlock {
    return type === 'richtext'
      ? { type, html: '<p>Start writing here.</p>', columns }
      : type === 'heading'
      ? { type, text: 'New heading', level: 2, columns }
      : type === 'paragraph'
        ? { type, text: 'Start writing here.', columns }
        : type === 'points'
          ? { type, items: ['New point'], columns }
          : type === 'image'
            ? { type, image: '', alt: '', width: (columns / 12) * 100, columns }
            : { type, html: HTML_BLOCK_TEMPLATE, columns }
  }

  function insertFlexibleBlock(index: number, type: FlexibleBlock['type']) {
    const blocks = getFlexibleBlocks()
    const block = createFlexibleBlock(type)
    blocks.splice(index, 0, block)
    setFlexibleBlocks(blocks)
  }

  function patchFlexibleBlock(index: number, patch: Partial<FlexibleBlock>) {
    setEditor((current) => {
      if (!current) return current
      const sections = parseVisualSections(current.sections)
      const sectionIndex = sections.findIndex(isFlexibleContentSection)
      if (sectionIndex < 0) return current
      const section = sections[sectionIndex]
      const blocks = [...(section.blocks ?? [])]
      const block = blocks[index]
      if (!block) return current
      blocks[index] = { ...block, ...patch }
      sections[sectionIndex] = {
        ...section,
        id: 'flexible-content',
        title: '',
        paragraphs: [],
        hideTitle: true,
        hideFromJump: true,
        blocks,
      }
      return { ...current, sections: pretty(sections) }
    })
  }

  async function uploadFlexibleBlockImage(blockIndex: number, file: File | undefined) {
    if (!file || !accessToken) return
    if (!file.type.startsWith('image/')) {
      setError('Select an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Blog images must be 10MB or smaller.')
      return
    }

    setUploadingImageBlockIndex(blockIndex)
    setError('')

    try {
      const formData = new FormData()
      formData.set('file', file, file.name)
      const response = await fetch('/api/blogs/images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })
      const result = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !result?.url) throw new Error(result?.error || 'Unable to upload the image.')

      patchFlexibleBlock(blockIndex, {
        image: result.url,
        alt: getFlexibleBlocks()[blockIndex]?.alt || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the image.')
    } finally {
      setUploadingImageBlockIndex(null)
    }
  }

  async function uploadEditorImage(
    file: File | undefined,
    onUploaded: (url: string, file: File) => void,
    setUploading: (uploading: boolean) => void,
  ) {
    if (!file || !accessToken) return
    if (!file.type.startsWith('image/')) {
      setError('Select an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Blog images must be 10MB or smaller.')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.set('file', file, file.name)
      const response = await fetch('/api/blogs/images', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      })
      const result = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !result?.url) throw new Error(result?.error || 'Unable to upload the image.')
      onUploaded(result.url, file)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the image.')
    } finally {
      setUploading(false)
    }
  }

  function uploadHeroImage(file: File | undefined) {
    return uploadEditorImage(file, (url) => update('heroImage', url), setUploadingHeroImage)
  }

  function uploadClosingImage(index: number, file: File | undefined) {
    return uploadEditorImage(
      file,
      (url, uploadedFile) => patchClosingImage(index, {
        src: url,
        alt: parseImages(editor?.closingImages ?? '[]')[index]?.alt
          || uploadedFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      }),
      (uploading) => setUploadingClosingImageIndex(uploading ? index : null),
    )
  }

  function beginConclusionImageWidthResize(
    event: React.PointerEvent<HTMLButtonElement>,
    imageIndex: number,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const imageElement = event.currentTarget.closest<HTMLElement>('[data-conclusion-image]')
    const canvas = imageElement?.closest<HTMLElement>('[data-conclusion-image-canvas]')
    if (!imageElement || !canvas) return

    const startX = event.clientX
    const images = parseImages(editor?.closingImages ?? '[]')
    const startColumns = images[imageIndex]?.columns ?? 6
    const columnWidth = canvas.getBoundingClientRect().width / 12

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaColumns = Math.round((moveEvent.clientX - startX) / columnWidth)
      const columns = Math.min(12, Math.max(1, startColumns + deltaColumns))
      patchClosingImage(imageIndex, { columns })
    }

    const stopResize = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stopResize)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stopResize)
  }

  function beginBlockWidthResize(
    event: React.PointerEvent<HTMLButtonElement>,
    blockIndex: number,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const blockElement = event.currentTarget.closest<HTMLElement>('[data-flexible-block]')
    const canvas = blockElement?.closest<HTMLElement>('[data-flexible-canvas]')
    if (!blockElement || !canvas) return

    const startX = event.clientX
    const startColumns = blockColumns(getFlexibleBlocks()[blockIndex])
    const columnWidth = canvas.getBoundingClientRect().width / 12

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaColumns = Math.round((moveEvent.clientX - startX) / columnWidth)
      const columns = Math.min(12, Math.max(1, startColumns + deltaColumns))
      patchFlexibleBlock(blockIndex, { columns, width: (columns / 12) * 100 })
    }

    const stopResize = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stopResize)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stopResize)
  }

  function removeFlexibleBlock(index: number) {
    const blocks = getFlexibleBlocks()
    blocks.splice(index, 1)
    setFlexibleBlocks(blocks)
  }

  function moveFlexibleBlock(index: number, direction: -1 | 1) {
    const blocks = getFlexibleBlocks()
    const target = index + direction
    if (target < 0 || target >= blocks.length) return
    const current = blocks[index]
    blocks[index] = blocks[target]
    blocks[target] = current
    setFlexibleBlocks(blocks)
  }

  function dropFlexibleBlock(event: React.DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault()
    event.stopPropagation()
    const type = event.dataTransfer.getData('application/x-blog-flexible-block') as FlexibleBlock['type']
    const sourceValue = event.dataTransfer.getData('application/x-blog-flexible-index')
    setFlexibleDropIndex(null)
    setFlexibleDragging(false)
    setFlexibleDragSourceIndex(null)

    if (FLEXIBLE_BLOCK_TYPES.some((item) => item.type === type)) {
      insertFlexibleBlock(targetIndex, type)
      return
    }

    if (!sourceValue) return
    const sourceIndex = Number(sourceValue)
    if (!Number.isInteger(sourceIndex)) return
    const blocks = getFlexibleBlocks()
    const [moved] = blocks.splice(sourceIndex, 1)
    if (!moved) return
    const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    blocks.splice(adjustedTarget, 0, moved)
    setFlexibleBlocks(blocks)
  }

  function dropFlexibleBlockBeside(event: React.DragEvent<HTMLDivElement>, targetIndex: number) {
    event.preventDefault()
    event.stopPropagation()
    const type = event.dataTransfer.getData('application/x-blog-flexible-block') as FlexibleBlock['type']
    const sourceValue = event.dataTransfer.getData('application/x-blog-flexible-index')
    const blocks = getFlexibleBlocks()
    const target = blocks[targetIndex]
    setFlexibleDropIndex(null)
    setFlexibleDragging(false)
    setFlexibleDragSourceIndex(null)
    if (!target) return

    const availableColumns = availableColumnsInBlockRow(blocks, targetIndex)
    if (availableColumns < 1) return

    if (FLEXIBLE_BLOCK_TYPES.some((item) => item.type === type)) {
      blocks.splice(targetIndex + 1, 0, createFlexibleBlock(type, availableColumns))
      setFlexibleBlocks(blocks)
      return
    }

    const sourceIndex = Number(sourceValue)
    if (!sourceValue || !Number.isInteger(sourceIndex) || sourceIndex === targetIndex) return
    const source = blocks[sourceIndex]
    if (!source || blockColumns(source) > availableColumns) return
    const [moved] = blocks.splice(sourceIndex, 1)
    if (!moved) return
    const insertIndex = sourceIndex < targetIndex ? targetIndex : targetIndex + 1
    blocks.splice(insertIndex, 0, { ...moved, rowStart: false })
    setFlexibleBlocks(blocks)
  }

  function patchSection(index: number, patch: Partial<VisualSection>) {
    if (!editor) return
    const sections = parseVisualSections(editor.sections)
    sections[index] = { ...sections[index], ...patch }
    setVisualSections(sections)
  }

  function addBlockToSection(index: number, blockType: 'subheadings' | 'html', droppedHtml = '') {
    if (!editor) return
    const sections = parseVisualSections(editor.sections)
    const section = sections[index]
    if (!section) return

    if (blockType === 'subheadings') {
      section.itemsTitle = section.itemsTitle ?? 'Subsection heading'
      section.itemsDescription = section.itemsDescription ?? ''
      section.items = [...(section.items ?? []), { title: 'New subheading', description: '' }]
    } else {
      const nextHtml = droppedHtml || HTML_BLOCK_TEMPLATE
      section.html = `${section.html ?? ''}${section.html?.trim() ? '\n\n' : ''}${nextHtml}`
    }

    setVisualSections(sections)
  }

  function handleSectionDrop(event: React.DragEvent<HTMLDivElement>, sectionIndex: number) {
    event.preventDefault()
    const blockType = event.dataTransfer.getData('application/x-blog-block')
    if (blockType === 'subheadings' || blockType === 'html') {
      addBlockToSection(sectionIndex, blockType)
      return
    }

    const dropped = event.dataTransfer.getData('text/html') || event.dataTransfer.getData('text/plain')
    if (!dropped.trim()) return
    const html = /<\/?[a-z][\s\S]*>/i.test(dropped)
      ? dropped
      : `<div class="blog-block"><p>${dropped.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div>`
    addBlockToSection(sectionIndex, 'html', html)
  }

  function removeSection(index: number) {
    if (!editor || !window.confirm('Remove this section?')) return
    const sections = parseVisualSections(editor.sections)
    sections.splice(index, 1)
    setVisualSections(sections)
  }

  function patchFaq(index: number, patch: Partial<{ question: string; answer: string }>) {
    if (!editor) return
    const faqs = parseFaqs(editor.faqs)
    faqs[index] = { ...faqs[index], ...patch }
    update('faqs', pretty(faqs))
  }

  function addFaq() {
    if (!editor) return
    const faqs = parseFaqs(editor.faqs)
    faqs.push({ question: 'New question', answer: 'Write the answer here.' })
    update('faqs', pretty(faqs))
  }

  function removeFaq(index: number) {
    if (!editor) return
    const faqs = parseFaqs(editor.faqs)
    faqs.splice(index, 1)
    update('faqs', pretty(faqs))
  }

  function patchClosingImage(
    index: number,
    patch: Partial<{ src: string; alt: string; columns: number; rowStart: boolean }>,
  ) {
    if (!editor) return
    const images = parseImages(editor.closingImages)
    images[index] = { ...images[index], ...patch }
    update('closingImages', pretty(images))
  }

  function removeClosingImage(index: number) {
    if (!editor) return
    const images = parseImages(editor.closingImages)
    images.splice(index, 1)
    update('closingImages', pretty(images))
  }

  function dropConclusionImage(event: React.DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault()
    event.stopPropagation()
    if (!editor) return
    const images = parseImages(editor.closingImages)
    const paletteType = event.dataTransfer.getData('application/x-blog-flexible-block')
    const conclusionSource = event.dataTransfer.getData('application/x-blog-conclusion-image-index')
    const flexibleSource = event.dataTransfer.getData('application/x-blog-flexible-index')

    if (paletteType === 'image') {
      images.splice(targetIndex, 0, { src: '', alt: '', columns: 6 })
      update('closingImages', pretty(images))
      return
    }

    if (conclusionSource) {
      const sourceIndex = Number(conclusionSource)
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= images.length) return
      const [moved] = images.splice(sourceIndex, 1)
      const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
      images.splice(adjustedTarget, 0, moved)
      update('closingImages', pretty(images))
      return
    }

    if (flexibleSource) {
      const sourceIndex = Number(flexibleSource)
      const blocks = getFlexibleBlocks()
      const source = blocks[sourceIndex]
      if (!Number.isInteger(sourceIndex) || source?.type !== 'image') return
      blocks.splice(sourceIndex, 1)
      setFlexibleBlocks(blocks)
      images.splice(targetIndex, 0, {
        src: source.image ?? '',
        alt: source.alt ?? '',
        columns: blockColumns(source),
      })
      update('closingImages', pretty(images))
    }
  }

  async function saveBlog(event: React.FormEvent) {
    event.preventDefault()
    if (!editor || !accessToken) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const sections = parseJsonArray(editor.sections, 'Sections')
      const title = editor.title.trim()
      if (!title) throw new Error('Add a blog title before saving.')

      const slug = editor.slug.trim() || slugifyBlogTitle(title)
      if (!slug) throw new Error('Add a URL slug before saving.')

      const category = editor.category.trim() || 'Insights'
      const excerpt = editor.excerpt.trim() || excerptFromSections(sections) || title

      if (editor.customHtml.trim()) {
        sections.push({
          id: 'custom-html-content',
          title: '',
          paragraphs: [],
          html: editor.customHtml.trim(),
          hideTitle: true,
          hideFromJump: true,
        })
      }

      const payload = {
        original_slug: editor.originalSlug,
        slug,
        title,
        excerpt,
        category,
        published_on: editor.publishedOn,
        updated_on: editor.updatedOn,
        read_time: editor.readTime,
        author: editor.author,
        hero_image: editor.heroImage,
        accent: editor.accent,
        display_number: editor.displayNumber,
        sort_order: Number(editor.sortOrder),
        tags: editor.tags.split(',').map((item) => item.trim()).filter(Boolean),
        highlights: editor.highlights.split('\n').map((item) => item.trim()).filter(Boolean),
        introduction: editor.introduction.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
        sections,
        conclusion: editor.conclusion.trim(),
        closing_images: parseJsonArray(editor.closingImages, 'Closing images'),
        faqs: parseJsonArray(editor.faqs, 'FAQs'),
        is_published: editor.isPublished,
      }

      const response = await fetch('/api/blogs', {
        method: editor.originalSlug ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => null)) as { blog?: BlogRow; error?: string } | null
      if (!response.ok) throw new Error(result?.error || 'Unable to save the blog.')

      if (result?.blog) {
        setBlogs((current) => {
          const withoutPrevious = current.filter((blog) => blog.slug !== editor.originalSlug && blog.slug !== result.blog?.slug)
          return [...withoutPrevious, result.blog as BlogRow].sort((a, b) => a.sort_order - b.sort_order)
        })
      }
      setSuccess(editor.originalSlug ? 'Blog updated successfully.' : 'Blog created successfully.')
      setEditor(null)
      await loadBlogs()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the blog.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBlog(blog: BlogRow) {
    if (!accessToken || !window.confirm(`Delete “${blog.title}”? This cannot be undone.`)) return

    setDeletingSlug(blog.slug)
    setError('')
    setSuccess('')
    const response = await fetch(`/api/blogs?slug=${encodeURIComponent(blog.slug)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) setError(result?.error || 'Unable to delete the blog.')
    else {
      setSuccess('Blog deleted successfully.')
      setBlogs((current) => current.filter((item) => item.slug !== blog.slug))
    }
    setDeletingSlug('')
  }

  if (!profileLoaded || loading) {
    return <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">Loading blogs...</div>
  }

  if (!canManage) {
    return <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-10 text-center text-slate-400">Only editors and administrators can manage blogs.</div>
  }

  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-[2rem] border border-slate-800 bg-[#0f172a] p-6 sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Content Management</p>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Manage Blogs</h1>
            <p className="mt-2 text-sm text-slate-400">Create, edit, publish, or remove articles shown on the BmyBrand website.</p>
          </div>
          <button type="button" onClick={() => { setEditor({ ...EMPTY_EDITOR }); setError(''); setSuccess('') }} className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600">+ Add Blog</button>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">{success}</div>}

      <section className="rounded-[2rem] border border-slate-800 bg-[#0f172a] p-5 sm:p-7">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, slug, or category..." className={`${inputClass} mb-5`} />
        <div className="space-y-3">
          {filteredBlogs.map((blog) => (
            <article
              key={blog.slug}
              className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0b1323] p-4 transition lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 [&>span]:hidden">
                <span className="select-none text-xl font-black tracking-[-0.35em] text-slate-600" aria-hidden="true">••</span>
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: blog.accent }} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{blog.category}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${blog.is_published ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-300'}`}>{blog.is_published ? 'Published' : 'Draft'}</span>
                </div>
                <h2 className="mt-2 truncate text-base font-bold text-white sm:text-lg">{blog.title}</h2>
                <p className="mt-1 truncate text-xs text-slate-500">/{blog.slug} · Order {blog.sort_order}</p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => { setEditor(editorFromBlog(blog)); setError(''); setSuccess('') }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 hover:border-orange-500 hover:text-orange-400">Edit</button>
                <button type="button" disabled={deletingSlug === blog.slug} onClick={() => void deleteBlog(blog)} className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50">{deletingSlug === blog.slug ? 'Deleting...' : 'Delete'}</button>
              </div>
            </article>
          ))}
          {filteredBlogs.length === 0 && <div className="py-14 text-center text-sm text-slate-500">No blogs found.</div>}
        </div>
      </section>

      {editor && (
        <div
          ref={editorModalRef}
          onDragOver={handleEditorDragOver}
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6"
        >
          <form noValidate onSubmit={saveBlog} className="mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#11122F] text-white shadow-2xl">
            <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-[#11122F]/95 px-5 py-4 backdrop-blur sm:px-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F45B25]">Live Page Editor</p>
                <p className="mt-1 text-sm text-white/55">Click into the page content and edit it.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditor(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/65 hover:text-white">Close</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-[#F45B25] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save changes'}</button>
              </div>
            </div>

            {error && (
              <div className="fixed left-1/2 top-24 z-[70] flex w-[min(90vw,720px)] -translate-x-1/2 items-start justify-between gap-4 rounded-xl border border-red-500/40 bg-[#2a1320] px-5 py-4 text-sm text-red-200 shadow-2xl" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => setError('')} className="shrink-0 font-black text-red-300 hover:text-white" aria-label="Dismiss error">×</button>
              </div>
            )}

            <details className="mx-auto mt-8 w-[90%] max-w-[1322px] rounded-xl border border-white/10 bg-[#1A1B3B]">
              <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-white">Post and card settings</summary>
              <div className="grid gap-5 border-t border-white/10 p-5 md:grid-cols-2 xl:grid-cols-4">
                <Field label="URL Slug"><input required value={editor.slug} onChange={(e) => update('slug', e.target.value)} className={inputClass} /></Field>
                <Field label="Category"><input required value={editor.category} onChange={(e) => update('category', e.target.value)} className={inputClass} /></Field>
                <Field label="Tags"><input value={editor.tags} onChange={(e) => update('tags', e.target.value)} placeholder="Comma separated" className={inputClass} /></Field>
                <div className="md:col-span-2">
                  <span className={labelClass}>Hero / banner image</span>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      type="url"
                      value={editor.heroImage}
                      onChange={(e) => update('heroImage', e.target.value)}
                      className={inputClass}
                      placeholder="Paste an image URL"
                    />
                    <label className="flex cursor-pointer items-center justify-center rounded-xl border border-[#F45B25]/60 bg-[#F45B25]/10 px-5 py-3 text-sm font-bold text-[#F45B25] transition hover:bg-[#F45B25]/20">
                      <input
                        type="file"
                        accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploadingHeroImage}
                        onChange={(event) => {
                          void uploadHeroImage(event.target.files?.[0])
                          event.currentTarget.value = ''
                        }}
                      />
                      {uploadingHeroImage ? 'Uploading…' : 'Upload from computer'}
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-white/40">Paste a URL, click Upload, or drag an image onto the banner preview below.</p>
                </div>
                <Field label="Author"><input value={editor.author} onChange={(e) => update('author', e.target.value)} className={inputClass} /></Field>
                <Field label="Read Time"><input value={editor.readTime} onChange={(e) => update('readTime', e.target.value)} className={inputClass} /></Field>
                <Field label="Published Date"><input type="date" value={editor.publishedOn} onChange={(e) => update('publishedOn', e.target.value)} className={inputClass} /></Field>
                <Field label="Updated Date"><input type="date" value={editor.updatedOn} onChange={(e) => update('updatedOn', e.target.value)} className={inputClass} /></Field>
                <Field label="Card Number"><input value={editor.displayNumber} onChange={(e) => update('displayNumber', e.target.value)} className={inputClass} /></Field>
                <Field label="Card Order"><input type="number" value={editor.sortOrder} onChange={(e) => update('sortOrder', e.target.value)} className={inputClass} /></Field>
                <Field label="Accent Color"><input type="color" value={editor.accent} onChange={(e) => update('accent', e.target.value)} className={`${inputClass} h-12`} /></Field>
                <label className="flex items-center gap-3 self-end rounded-xl border border-slate-700 bg-[#0b1323] px-4 py-3">
                  <input type="checkbox" checked={editor.isPublished} onChange={(e) => update('isPublished', e.target.checked)} className="h-4 w-4 accent-orange-500" />
                  <span className="text-sm font-bold">Published</span>
                </label>
                <div className="md:col-span-2 xl:col-span-4"><Field label="Card Excerpt"><textarea required rows={3} value={editor.excerpt} onChange={(e) => update('excerpt', e.target.value)} className={inputClass} /></Field></div>
              </div>
            </details>

            <header className="mx-auto w-[90%] max-w-[1322px] pb-16 pt-16">
              <div className="max-w-[1040px]">
                <div className="mb-5 flex flex-wrap gap-2">
                  {(editor.tags.split(',').map((tag) => tag.trim()).filter(Boolean).length ? editor.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [editor.category || 'Category']).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/[0.07] px-5 py-2 text-xs text-white/60">{tag}</span>
                  ))}
                </div>
                <textarea
                  required
                  rows={2}
                  value={editor.title}
                  onChange={(e) => update('title', e.target.value)}
                  className={`${pageInputClass} resize-none text-[clamp(2.2rem,3.2vw,3.8rem)] font-black leading-[1.12] tracking-[-0.035em]`}
                  placeholder="Blog title"
                />
                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/55">
                  <span>Posted By: <span className="text-white">{editor.author}</span></span><span className="text-[#F45B25]">•</span><span>Created on: {editor.publishedOn}</span><span className="text-[#F45B25]">•</span><span>Last updated: {editor.updatedOn}</span>
                </div>
              </div>
              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  event.dataTransfer.dropEffect = 'copy'
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  void uploadHeroImage(event.dataTransfer.files[0])
                }}
                className="relative mt-14 flex aspect-[1322/825] cursor-pointer items-center justify-center overflow-hidden rounded-[1.75rem] border-2 border-dashed border-white/20 bg-[#090A22] transition hover:border-[#F45B25]"
              >
                {editor.heroImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={editor.heroImage}
                    alt={editor.title || 'Blog hero image'}
                    className="absolute inset-0 h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <input
                  type="file"
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploadingHeroImage}
                  onChange={(event) => {
                    void uploadHeroImage(event.target.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
                <span className="relative z-10 rounded-xl bg-black/70 px-5 py-3 text-center text-sm font-bold text-white">
                  {uploadingHeroImage ? 'Uploading banner…' : editor.heroImage ? 'Drop or click to replace banner' : 'Drop banner here or click to upload'}
                </span>
                <span className="absolute bottom-5 right-5 rounded-lg bg-black/65 px-4 py-2 text-xs font-bold">Hero image</span>
              </label>
            </header>

            <div className="mx-auto grid w-[90%] max-w-[1322px] gap-12 pb-24 lg:grid-cols-[minmax(0,872px)_minmax(300px,398px)] lg:items-start lg:gap-[52px]">
              <article className="min-w-0">
                <section className="rounded-[1.25rem] border border-white/10 bg-[#1A1B3B] px-7 py-7 sm:px-9">
                  <h2 className="mb-5 flex items-center gap-3 text-2xl font-black"><span className="text-[#F45B25]">✦</span> Key Highlights</h2>
                  <div className="divide-y divide-white/10">
                    {splitEditorLines(editor.highlights, 'highlights').map((highlight, index) => (
                      <div key={index} className="flex items-start gap-3 py-3">
                        <span className="mt-2 text-[#F45B25]">✓</span>
                        <textarea rows={1} value={highlight} onChange={(e) => updateLines('highlights', index, e.target.value)} className={`${pageInputClass} resize-none text-base leading-7 text-white/65`} placeholder="Add a key highlight" />
                        <button type="button" onClick={() => removeLine('highlights', index)} className={removeButtonClass} aria-label="Remove highlight">×</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => addLine('highlights')} className="mt-4 text-sm font-bold text-[#F45B25]">+ Add highlight</button>
                </section>

                <div className="mt-10 space-y-4">
                  {splitEditorLines(editor.introduction, 'introduction').map((paragraph, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <textarea rows={3} value={paragraph} onChange={(e) => updateLines('introduction', index, e.target.value)} className={`${pageInputClass} resize-y text-base leading-7 text-white/65`} placeholder="Write an introductory paragraph" />
                      <button type="button" onClick={() => removeLine('introduction', index)} className={removeButtonClass} aria-label="Remove paragraph">×</button>
                    </div>
                  ))}
                </div>

                <div className="mt-12">
                  {showsFlexibleCanvas() && (
                    <div>
                      <div className="mb-6 rounded-xl border border-white/10 bg-[#1A1B3B] p-5">
                        <p className="text-sm font-black text-white">Flexible article canvas</p>
                        <p className="mt-1 text-xs leading-5 text-white/45">Arrange content on a 12-column grid. “Drop beside” appears only when the row has enough unused columns for that block.</p>
                      </div>
                      <BlockPalette
                        onInsert={(type) => insertFlexibleBlock(getFlexibleBlocks().length, type)}
                        onDragStateChange={(dragging) => {
                          setFlexibleDragging(dragging)
                          setFlexibleDragSourceIndex(null)
                        }}
                      />
                      <div
                        data-flexible-canvas
                        onDragOver={(event) => {
                          if (!flexibleDragging) return
                          event.preventDefault()
                          event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-blog-flexible-index') ? 'move' : 'copy'
                        }}
                        onDrop={(event) => {
                          if (flexibleDragging) dropFlexibleBlock(event, getFlexibleBlocks().length)
                        }}
                        className="grid min-h-40 grid-cols-12 items-start gap-4 rounded-xl"
                      >
                        {flexibleDragging && (
                          <FlexibleDropZone
                            active={flexibleDropIndex === 0}
                            onDragEnter={() => setFlexibleDropIndex(0)}
                            onDrop={(event) => dropFlexibleBlock(event, 0)}
                          />
                        )}
                      {getFlexibleBlocks().map((block, blockIndex) => {
                        const columns = blockColumns(block)
                        const draggedBlock = flexibleDragSourceIndex === null ? null : getFlexibleBlocks()[flexibleDragSourceIndex]
                        const draggedColumns = draggedBlock ? blockColumns(draggedBlock) : 1
                        const availableColumns = availableColumnsInBlockRow(getFlexibleBlocks(), blockIndex)
                        const canDropBeside = availableColumns > 0
                          && flexibleDragSourceIndex !== blockIndex
                          && (flexibleDragSourceIndex === null || draggedColumns <= availableColumns)
                        const isRowEnd = isFlexibleRowEnd(getFlexibleBlocks(), blockIndex)
                        return (
                        <Fragment key={blockIndex}>
                        <div
                          data-flexible-block
                          className="min-w-0"
                          style={{ gridColumn: block.rowStart ? `1 / span ${columns}` : `span ${columns} / span ${columns}` }}
                        >
                          <div className="group relative rounded-xl border border-white/10 bg-white/[0.025] p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <span
                                draggable
                                onDragStart={(event) => {
                                  event.dataTransfer.effectAllowed = 'move'
                                  event.dataTransfer.setData('application/x-blog-flexible-index', String(blockIndex))
                                  setFlexibleDragging(true)
                                  setFlexibleDragSourceIndex(blockIndex)
                                }}
                                onDragEnd={() => {
                                  setFlexibleDropIndex(null)
                                  setFlexibleDragging(false)
                                  setFlexibleDragSourceIndex(null)
                                }}
                                className="cursor-grab select-none text-[11px] font-bold uppercase tracking-[0.14em] text-[#F45B25] active:cursor-grabbing"
                                title="Drag to reorder this block"
                              >
                                ⠿ {block.type}
                              </span>
                              <div className="flex gap-2">
                                <button type="button" disabled={blockIndex === 0} onClick={() => moveFlexibleBlock(blockIndex, -1)} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/55 disabled:opacity-25">↑</button>
                                <button type="button" disabled={blockIndex === getFlexibleBlocks().length - 1} onClick={() => moveFlexibleBlock(blockIndex, 1)} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/55 disabled:opacity-25">↓</button>
                                <button type="button" onClick={() => removeFlexibleBlock(blockIndex)} className={removeButtonClass}>Remove</button>
                              </div>
                            </div>

                            {block.type === 'richtext' && (
                              <RichTextEditor
                                value={block.html ?? ''}
                                onChange={(html) => patchFlexibleBlock(blockIndex, { html })}
                              />
                            )}

                            {block.type === 'heading' && (
                              <div>
                                <div className="mb-2 flex gap-2">
                                  <button type="button" onClick={() => patchFlexibleBlock(blockIndex, { level: 2 })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${block.level !== 3 ? 'bg-[#F45B25] text-white' : 'border border-white/15 text-white/50'}`}>Heading 2</button>
                                  <button type="button" onClick={() => patchFlexibleBlock(blockIndex, { level: 3 })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${block.level === 3 ? 'bg-[#F45B25] text-white' : 'border border-white/15 text-white/50'}`}>Heading 3</button>
                                </div>
                                <input value={block.text ?? ''} onChange={(e) => patchFlexibleBlock(blockIndex, { text: e.target.value })} className={`${pageInputClass} ${block.level === 3 ? 'text-xl' : 'text-3xl'} font-black`} placeholder="Heading" />
                              </div>
                            )}

                            {block.type === 'paragraph' && (
                              <textarea rows={4} value={block.text ?? ''} onChange={(e) => patchFlexibleBlock(blockIndex, { text: e.target.value })} className={`${pageInputClass} resize-y text-base leading-7 text-white/65`} placeholder="Write a paragraph" />
                            )}

                            {block.type === 'points' && (
                              <div className="space-y-2">
                                {(block.items ?? []).map((point, pointIndex) => (
                                  <div key={pointIndex} className="flex items-center gap-2">
                                    <span className="text-[#F45B25]">✓</span>
                                    <input value={point} onChange={(e) => {
                                      const items = [...(block.items ?? [])]
                                      items[pointIndex] = e.target.value
                                      patchFlexibleBlock(blockIndex, { items })
                                    }} className={`${pageInputClass} text-sm text-white/65`} placeholder="Point" />
                                    <button type="button" onClick={() => {
                                      const items = [...(block.items ?? [])]
                                      items.splice(pointIndex, 1)
                                      patchFlexibleBlock(blockIndex, { items })
                                    }} className={removeButtonClass} aria-label="Remove point">×</button>
                                  </div>
                                ))}
                                <button type="button" onClick={() => patchFlexibleBlock(blockIndex, { items: [...(block.items ?? []), ''] })} className="text-sm font-bold text-[#F45B25]">+ Add point</button>
                              </div>
                            )}

                            {(block.type === 'image' || block.type === 'banner') && (
                              <div>
                                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-white/45">Image source</p>
                                <label
                                  onDragOver={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    event.dataTransfer.dropEffect = 'copy'
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    void uploadFlexibleBlockImage(blockIndex, event.dataTransfer.files[0])
                                  }}
                                  className="relative mx-auto block aspect-[1.95/1] w-full max-w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-[#F45B25]/55 bg-[#090A22] transition hover:border-[#F45B25]"
                                >
                                  {block.image && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={block.image}
                                      alt={block.alt || 'Blog content image'}
                                      className="absolute inset-0 h-full w-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                  <input
                                    type="file"
                                    accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    disabled={uploadingImageBlockIndex !== null}
                                    onChange={(event) => {
                                      void uploadFlexibleBlockImage(blockIndex, event.target.files?.[0])
                                      event.currentTarget.value = ''
                                    }}
                                  />
                                  <span className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 px-5 text-center text-xs font-bold text-white">
                                    {uploadingImageBlockIndex === blockIndex ? 'Uploading image…' : block.image ? 'Drop or click to replace image' : 'Drop image here or click to upload'}
                                  </span>
                                </label>
                                <p className="mt-2 text-center text-[11px] text-white/35">Upload, drag and drop, or paste a public image URL. Height adjusts automatically.</p>
                                <div className="mt-3 space-y-2">
                                  <input type="url" value={block.image ?? ''} onChange={(e) => patchFlexibleBlock(blockIndex, { image: e.target.value })} className={`${inputClass} text-xs`} placeholder="Paste an image URL" />
                                  <input value={block.alt ?? ''} onChange={(e) => patchFlexibleBlock(blockIndex, { alt: e.target.value })} className={`${inputClass} text-xs`} placeholder="Image alt text" />
                                </div>
                              </div>
                            )}

                            {block.type === 'html' && (
                              <textarea rows={10} value={block.html ?? ''} onChange={(e) => patchFlexibleBlock(blockIndex, { html: e.target.value })} className={`${inputClass} font-mono text-xs leading-6`} placeholder="<div>Custom HTML</div>" />
                            )}
                            <button
                              type="button"
                              onPointerDown={(event) => beginBlockWidthResize(event, blockIndex)}
                              className="absolute bottom-3 right-0 top-16 w-3 cursor-ew-resize touch-none rounded-l bg-[#F45B25]/25 transition hover:bg-[#F45B25]/90"
                              aria-label={`Drag to resize ${block.type} block width`}
                              title={`Drag to resize across the grid (${columns}/12 columns)`}
                            />
                            <span className="pointer-events-none absolute bottom-1 right-4 rounded bg-[#11122F]/85 px-1.5 py-0.5 text-[10px] font-bold text-[#F45B25]">{columns}/12</span>
                            {flexibleDragging && canDropBeside && (
                              <div
                                onDragOver={(event) => {
                                  event.preventDefault()
                                  event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-blog-flexible-index') ? 'move' : 'copy'
                                }}
                                onDrop={(event) => dropFlexibleBlockBeside(event, blockIndex)}
                                className="absolute inset-y-0 right-0 z-30 flex w-1/2 items-center justify-center rounded-r-xl border-2 border-dashed border-[#F45B25] bg-[#F45B25]/20 text-xs font-black uppercase tracking-wider text-white backdrop-blur-sm"
                              >
                                Drop beside
                              </div>
                            )}
                          </div>
                        </div>
                        {flexibleDragging && isRowEnd && (
                          <FlexibleDropZone
                            active={flexibleDropIndex === blockIndex + 1}
                            onDragEnter={() => setFlexibleDropIndex(blockIndex + 1)}
                            onDrop={(event) => dropFlexibleBlock(event, blockIndex + 1)}
                          />
                        )}
                        </Fragment>
                      )})}
                      </div>
                    </div>
                  )}

                  {editor.originalSlug && parseVisualSections(editor.sections)
                    .map((section, sectionIndex) => ({ section, sectionIndex }))
                    .filter(({ section }) => !isFlexibleContentSection(section))
                    .map(({ section, sectionIndex }) => (
                    <section key={section.id} className="group mb-12 border-b border-white/10 pb-12 sm:mb-16 sm:pb-16">
                      <div className="mb-4 flex items-start gap-3">
                        <input
                          value={section.title}
                          onChange={(e) => patchSection(sectionIndex, { title: e.target.value })}
                          className={`${pageInputClass} text-[clamp(1.65rem,2vw,2.15rem)] font-black leading-[1.15]`}
                          placeholder="Section heading"
                        />
                        <button type="button" onClick={() => removeSection(sectionIndex)} className={`${removeButtonClass} mt-1`}>Remove section</button>
                      </div>

                      <div className="space-y-2">
                        {section.paragraphs.map((paragraph, paragraphIndex) => (
                          <div key={paragraphIndex} className="flex items-start gap-2">
                            <textarea
                              rows={3}
                              value={paragraph}
                              onChange={(e) => {
                                const paragraphs = [...section.paragraphs]
                                paragraphs[paragraphIndex] = e.target.value
                                patchSection(sectionIndex, { paragraphs })
                              }}
                              className={`${pageInputClass} resize-y text-base leading-7 text-white/65`}
                              placeholder="Write a paragraph"
                            />
                            <button type="button" onClick={() => {
                              const paragraphs = [...section.paragraphs]
                              paragraphs.splice(paragraphIndex, 1)
                              patchSection(sectionIndex, { paragraphs })
                            }} className={removeButtonClass} aria-label="Remove section paragraph">×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => patchSection(sectionIndex, { paragraphs: [...section.paragraphs, ''] })} className="text-sm font-bold text-[#F45B25]">+ Add paragraph</button>
                      </div>

                      {section.bullets && (
                        <div className="mt-7">
                          <div className="flex items-start gap-2">
                            <input value={section.bulletsTitle ?? ''} onChange={(e) => patchSection(sectionIndex, { bulletsTitle: e.target.value })} className={`${pageInputClass} mb-2 text-xl font-black`} placeholder="List heading" />
                            <button type="button" onClick={() => patchSection(sectionIndex, { bullets: undefined, bulletsTitle: undefined })} className={removeButtonClass}>Remove list</button>
                          </div>
                          <div className="space-y-2">
                            {section.bullets.map((bullet, bulletIndex) => (
                              <div key={bulletIndex} className="flex items-center gap-3">
                                <span className="text-[#F45B25]">✓</span>
                                <input value={bullet} onChange={(e) => {
                                  const bullets = [...(section.bullets ?? [])]
                                  bullets[bulletIndex] = e.target.value
                                  patchSection(sectionIndex, { bullets })
                                }} className={`${pageInputClass} text-sm leading-6 text-white/65`} />
                                <button type="button" onClick={() => {
                                  const bullets = [...(section.bullets ?? [])]
                                  bullets.splice(bulletIndex, 1)
                                  patchSection(sectionIndex, { bullets })
                                }} className={removeButtonClass} aria-label="Remove list item">×</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => patchSection(sectionIndex, { bullets: [...(section.bullets ?? []), ''] })} className="text-sm font-bold text-[#F45B25]">+ Add list item</button>
                          </div>
                        </div>
                      )}

                      {section.items && (
                        <div className="mt-8">
                          <div className="flex items-start gap-2">
                            <input value={section.itemsTitle ?? ''} onChange={(e) => patchSection(sectionIndex, { itemsTitle: e.target.value })} className={`${pageInputClass} mb-1 text-xl font-black`} placeholder="Subsection heading" />
                            <button type="button" onClick={() => patchSection(sectionIndex, { items: undefined, itemsTitle: undefined, itemsDescription: undefined })} className={removeButtonClass}>Remove group</button>
                          </div>
                          <textarea rows={2} value={section.itemsDescription ?? ''} onChange={(e) => patchSection(sectionIndex, { itemsDescription: e.target.value })} className={`${pageInputClass} mb-3 resize-y text-sm leading-6 text-white/55`} placeholder="Optional description" />
                          {section.items.map((item, itemIndex) => (
                            <div key={itemIndex} className={section.divideItems ? 'border-b border-white/10 py-4' : 'py-4'}>
                              <div className="flex items-start gap-2">
                                <input value={item.title} onChange={(e) => {
                                  const items = [...(section.items ?? [])]
                                  items[itemIndex] = { ...item, title: e.target.value }
                                  patchSection(sectionIndex, { items })
                                }} className={`${pageInputClass} text-lg font-black`} placeholder="Subheading" />
                                <button type="button" onClick={() => {
                                  const items = [...(section.items ?? [])]
                                  items.splice(itemIndex, 1)
                                  patchSection(sectionIndex, { items })
                                }} className={removeButtonClass} aria-label="Remove subheading">×</button>
                              </div>
                              <textarea rows={2} value={item.description} onChange={(e) => {
                                const items = [...(section.items ?? [])]
                                items[itemIndex] = { ...item, description: e.target.value }
                                patchSection(sectionIndex, { items })
                              }} className={`${pageInputClass} mt-1 resize-y text-sm leading-6 text-white/55`} placeholder="Description" />
                              {item.bullets && (
                                <div className="mt-2 space-y-2 pl-2">
                                  {item.bullets.map((bullet, itemBulletIndex) => (
                                    <div key={itemBulletIndex} className="flex items-center gap-2">
                                      <span className="text-[#F45B25]">✓</span>
                                      <input value={bullet} onChange={(e) => {
                                        const items = [...(section.items ?? [])]
                                        const bullets = [...(item.bullets ?? [])]
                                        bullets[itemBulletIndex] = e.target.value
                                        items[itemIndex] = { ...item, bullets }
                                        patchSection(sectionIndex, { items })
                                      }} className={`${pageInputClass} text-sm text-white/60`} />
                                      <button type="button" onClick={() => {
                                        const items = [...(section.items ?? [])]
                                        const bullets = [...(item.bullets ?? [])]
                                        bullets.splice(itemBulletIndex, 1)
                                        items[itemIndex] = { ...item, bullets: bullets.length ? bullets : undefined }
                                        patchSection(sectionIndex, { items })
                                      }} className={removeButtonClass} aria-label="Remove nested list item">×</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button type="button" onClick={() => {
                                const items = [...(section.items ?? [])]
                                items[itemIndex] = { ...item, bullets: [...(item.bullets ?? []), ''] }
                                patchSection(sectionIndex, { items })
                              }} className="ml-2 mt-2 text-xs font-bold text-[#F45B25]">+ Add nested list item</button>
                            </div>
                          ))}
                          <button type="button" onClick={() => patchSection(sectionIndex, { items: [...(section.items ?? []), { title: 'New subheading', description: '' }] })} className="mt-2 text-sm font-bold text-[#F45B25]">+ Add subheading</button>
                        </div>
                      )}

                      {(section.image !== undefined || section.images) && (
                        <div className={`mt-8 grid gap-5 ${section.images ? 'sm:grid-cols-2' : ''}`}>
                          {(section.images ?? [{ src: section.image ?? '', alt: section.imageAlt ?? '' }]).map((image, imageIndex) => (
                            <div key={imageIndex}>
                              <div className="aspect-[1.48/1] rounded-2xl border border-white/10 bg-[#090A22] bg-cover bg-center" style={image.src ? { backgroundImage: `url("${image.src}")` } : undefined} />
                              <div className="mt-2 flex items-center gap-2">
                                <input value={image.src} onChange={(e) => {
                                  if (section.images) {
                                    const images = [...section.images]
                                    images[imageIndex] = { ...image, src: e.target.value }
                                    patchSection(sectionIndex, { images })
                                  } else patchSection(sectionIndex, { image: e.target.value })
                                }} className={`${pageInputClass} text-xs text-white/45`} placeholder="/image-path.png" />
                                <button type="button" onClick={() => {
                                  if (section.images) {
                                    const images = [...section.images]
                                    images.splice(imageIndex, 1)
                                    patchSection(sectionIndex, { images: images.length ? images : undefined })
                                  } else patchSection(sectionIndex, { image: undefined, imageAlt: undefined })
                                }} className={removeButtonClass}>Remove</button>
                              </div>
                              <input value={image.alt} onChange={(e) => {
                                if (section.images) {
                                  const images = [...section.images]
                                  images[imageIndex] = { ...image, alt: e.target.value }
                                  patchSection(sectionIndex, { images })
                                } else patchSection(sectionIndex, { imageAlt: e.target.value })
                              }} className={`${pageInputClass} mt-1 text-xs text-white/45`} placeholder="Image description" />
                            </div>
                          ))}
                          <button type="button" onClick={() => {
                            if (section.images) patchSection(sectionIndex, { images: [...section.images, { src: '', alt: '' }] })
                            else patchSection(sectionIndex, { images: [{ src: section.image ?? '', alt: section.imageAlt ?? '' }, { src: '', alt: '' }], image: undefined, imageAlt: undefined })
                          }} className="text-sm font-bold text-[#F45B25]">+ Add another image</button>
                        </div>
                      )}

                      {section.html !== undefined && (
                        <div className="mt-6">
                          <div className="mb-2 flex items-center justify-end gap-2">
                            <span
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'copy'
                                event.dataTransfer.setData('text/html', section.html ?? HTML_BLOCK_TEMPLATE)
                              }}
                              className="cursor-grab rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white/55 active:cursor-grabbing"
                              title="Drag this HTML into another section"
                            >
                              ⠿ Drag HTML
                            </span>
                            <button type="button" onClick={() => patchSection(sectionIndex, { html: undefined })} className={removeButtonClass}>Remove HTML block</button>
                          </div>
                          <textarea rows={10} value={section.html} onChange={(e) => patchSection(sectionIndex, { html: e.target.value })} className={`${inputClass} font-mono text-xs leading-6`} placeholder="<div>Custom HTML content</div>" />
                        </div>
                      )}

                      <div
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'copy'
                        }}
                        onDrop={(event) => handleSectionDrop(event, sectionIndex)}
                        className="mt-8 flex min-h-28 flex-wrap content-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-3 transition hover:border-[#F45B25]/70 hover:bg-[#F45B25]/5"
                      >
                        <span className="w-full text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">Add content to this section</span>
                        {!section.bullets && <button type="button" onClick={() => patchSection(sectionIndex, { bulletsTitle: 'List heading', bullets: [''] })} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/65 hover:border-[#F45B25] hover:text-[#F45B25]">+ List</button>}
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'copy'
                            event.dataTransfer.setData('application/x-blog-block', 'subheadings')
                          }}
                          onClick={() => addBlockToSection(sectionIndex, 'subheadings')}
                          className="cursor-grab rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/65 hover:border-[#F45B25] hover:text-[#F45B25] active:cursor-grabbing"
                          title="Click to add, or drag into a section"
                        >
                          + Subheadings
                        </button>
                        {section.image === undefined && !section.images && <button type="button" onClick={() => patchSection(sectionIndex, { image: '', imageAlt: '' })} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/65 hover:border-[#F45B25] hover:text-[#F45B25]">+ Single image</button>}
                        {section.image === undefined && !section.images && <button type="button" onClick={() => patchSection(sectionIndex, { images: [{ src: '', alt: '' }, { src: '', alt: '' }] })} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/65 hover:border-[#F45B25] hover:text-[#F45B25]">+ Two images</button>}
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'copy'
                            event.dataTransfer.setData('application/x-blog-block', 'html')
                            event.dataTransfer.setData('text/html', HTML_BLOCK_TEMPLATE)
                          }}
                          onClick={() => addBlockToSection(sectionIndex, 'html')}
                          className="cursor-grab rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white/65 hover:border-[#F45B25] hover:text-[#F45B25] active:cursor-grabbing"
                          title="Click to add, or drag into a section"
                        >
                          + HTML block
                        </button>
                        <span className="w-full pt-1 text-xs text-white/35">Drop a DIV/HTML snippet or either draggable button anywhere in this box.</span>
                      </div>
                    </section>
                  ))}
                  <details className="hidden" aria-hidden="true">
                    <summary className="cursor-pointer px-5 py-4 text-sm font-bold">Custom HTML / DIV block</summary>
                    <div className="border-t border-white/10 p-5">
                      <div className="mb-3 flex items-center justify-end gap-2">
                        <span
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = 'copy'
                            event.dataTransfer.setData('text/html', editor.customHtml || HTML_BLOCK_TEMPLATE)
                          }}
                          className="cursor-grab rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white/55 active:cursor-grabbing"
                        >
                          ⠿ Drag HTML
                        </span>
                        <button type="button" onClick={() => update('customHtml', '')} className={removeButtonClass}>Remove HTML content</button>
                      </div>
                      <textarea
                        rows={12}
                        value={editor.customHtml}
                        onChange={(e) => update('customHtml', e.target.value)}
                        spellCheck={false}
                        className={`${inputClass} font-mono text-xs leading-6`}
                        placeholder={'<div class="blog-block">\n  <h2>Heading</h2>\n  <p>Content...</p>\n</div>'}
                      />
                    </div>
                  </details>
                </div>

                <section className="mt-16 rounded-xl border border-[#F45B25] bg-[#F45B25]/10 p-7 sm:p-9">
                  <h2 className="mb-5 flex items-center gap-3 text-2xl font-black"><span className="text-[#F45B25]">✦</span> Conclusion</h2>
                  <textarea
                    rows={8}
                    value={editor.conclusion}
                    onChange={(event) => update('conclusion', event.target.value)}
                    className={`${pageInputClass} resize-y whitespace-pre-wrap text-base leading-7 text-white/70`}
                    placeholder="Write the conclusion"
                  />
                </section>

                <section
                  className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4"
                  onDragOver={(event) => {
                    const dragTypes = Array.from(event.dataTransfer.types)
                    if (
                      dragTypes.includes('application/x-blog-flexible-block')
                      || dragTypes.includes('application/x-blog-conclusion-image-index')
                      || dragTypes.includes('application/x-blog-flexible-index')
                    ) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = dragTypes.includes('application/x-blog-flexible-block') ? 'copy' : 'move'
                    }
                  }}
                  onDrop={(event) => dropConclusionImage(event, parseImages(editor.closingImages).length)}
                >
                  <div className="mb-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Images under Conclusion</p>
                    <p className="mt-1 text-xs leading-5 text-white/35">Drag the Image block here, or move an existing article image here.</p>
                  </div>
                  <div data-conclusion-image-canvas className="grid grid-cols-12 items-start gap-4">
                    {parseImages(editor.closingImages).map((image, index) => (
                      <div
                        key={index}
                        data-conclusion-image
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(event) => dropConclusionImage(event, index)}
                        className="relative rounded-xl border border-white/10 bg-[#090A22]/70 p-3"
                        style={{
                          gridColumn: `span ${image.columns ?? 6} / span ${image.columns ?? 6}`,
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move'
                              event.dataTransfer.setData('application/x-blog-conclusion-image-index', String(index))
                            }}
                            className="cursor-grab text-[11px] font-bold uppercase tracking-[0.14em] text-[#F45B25] active:cursor-grabbing"
                          >
                            â ¿ Image
                          </span>
                          <button type="button" onClick={() => removeClosingImage(index)} className={removeButtonClass}>Remove</button>
                        </div>
                        <label
                          onDragOver={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            event.dataTransfer.dropEffect = 'copy'
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void uploadClosingImage(index, event.dataTransfer.files[0])
                          }}
                          className="relative block aspect-[1.05/1] cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-[#F45B25]/45 bg-[#090A22] transition hover:border-[#F45B25]"
                        >
                          {image.src && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={image.src}
                              alt={image.alt || 'Closing blog image'}
                              className="absolute inset-0 h-full w-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <input
                            type="file"
                            accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={uploadingClosingImageIndex !== null}
                            onChange={(event) => {
                              void uploadClosingImage(index, event.target.files?.[0])
                              event.currentTarget.value = ''
                            }}
                          />
                          <span className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/25 px-4 text-center text-xs font-bold text-white">
                            {uploadingClosingImageIndex === index ? 'Uploading…' : image.src ? 'Drop or click to replace' : 'Drop or click to upload'}
                          </span>
                        </label>
                        <div className="mt-2 flex items-center gap-2">
                          <input type="url" value={image.src} onChange={(e) => patchClosingImage(index, { src: e.target.value })} className={`${pageInputClass} text-xs text-white/45`} placeholder="Paste an image URL" />
                        </div>
                        <input value={image.alt} onChange={(e) => patchClosingImage(index, { alt: e.target.value })} className={`${pageInputClass} mt-1 text-xs text-white/45`} placeholder="Image description" />
                        <button
                          type="button"
                          onPointerDown={(event) => beginConclusionImageWidthResize(event, index)}
                          className="absolute -right-1 top-1/2 z-20 h-14 w-3 -translate-y-1/2 cursor-ew-resize rounded-full border border-[#F45B25]/70 bg-[#F45B25]/30 transition hover:bg-[#F45B25]/60"
                          aria-label="Resize conclusion image width"
                          title="Drag to resize width"
                        />
                      </div>
                    ))}
                    {parseImages(editor.closingImages).length === 0 && (
                      <div className="col-span-12 flex min-h-28 items-center justify-center rounded-xl border border-dashed border-[#F45B25]/45 px-5 text-center text-sm font-bold text-white/45">
                        Drag Image here
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-16">
                  <h2 className="mb-6 text-2xl font-black">Frequently Asked Questions</h2>
                  <div className="space-y-3">
                    {parseFaqs(editor.faqs).map((faq, index) => (
                      <div key={index} className="rounded-xl border border-white/10 bg-[#1A1B3B] p-5">
                        <div className="flex items-start gap-2">
                          <input value={faq.question} onChange={(e) => patchFaq(index, { question: e.target.value })} className={`${pageInputClass} font-bold`} placeholder="Question" />
                          <button type="button" onClick={() => removeFaq(index)} className={removeButtonClass} aria-label="Remove FAQ">×</button>
                        </div>
                        <textarea rows={3} value={faq.answer} onChange={(e) => patchFaq(index, { answer: e.target.value })} className={`${pageInputClass} mt-2 resize-y text-sm leading-6 text-white/60`} placeholder="Answer" />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFaq} className="mt-4 text-sm font-bold text-[#F45B25]">+ Add question</button>
                </section>
              </article>

              <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
                <div className="rounded-[1.25rem] border border-white/10 bg-[#1A1B3B] p-6">
                  <p className="mb-5 text-xl font-black">Jump To:</p>
                  <nav className="space-y-1">
                    <span className="block rounded-lg px-2 py-2.5 text-sm text-[#F45B25]">→ Key Highlights</span>
                    {parseVisualSections(editor.sections).filter((section) => !section.hideFromJump).map((section) => (
                      <span key={section.id} className="block rounded-lg px-2 py-2.5 text-sm leading-5 text-white/60">{section.title || 'Untitled section'}</span>
                    ))}
                    {richTextH2Titles(parseVisualSections(editor.sections)).map((title, index) => (
                      <span key={`${title}-${index}`} className="block rounded-lg px-2 py-2.5 text-sm leading-5 text-white/60">{title}</span>
                    ))}
                    <span className="block rounded-lg px-2 py-2.5 text-sm text-white/60">Conclusion</span>
                    <span className="block rounded-lg px-2 py-2.5 text-sm text-white/60">Frequently Asked Questions</span>
                  </nav>
                </div>
              </aside>
            </div>

            <div className="hidden">
              <section className="rounded-2xl border border-slate-700 bg-[#111c30] p-5">
                <div className="mb-5 border-b border-slate-700 pb-4">
                  <h3 className="text-lg font-black text-white">Article Content</h3>
                  <p className="mt-1 text-xs text-slate-400">The full content shown after a visitor opens the blog card.</p>
                </div>
                <div className="space-y-5">
                  <Field label="Key Highlights — one per line"><textarea rows={6} value={editor.highlights} onChange={(e) => update('highlights', e.target.value)} className={inputClass} /></Field>
                  <Field label="Introduction — blank line between paragraphs"><textarea rows={7} value={editor.introduction} onChange={(e) => update('introduction', e.target.value)} className={inputClass} /></Field>
                  <details className="rounded-xl border border-slate-700 bg-[#0b1323]">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-white">Structured sections (advanced)</summary>
                    <div className="border-t border-slate-700 p-4">
                      <Field label="Sections — JSON array"><textarea rows={18} value={editor.sections} onChange={(e) => update('sections', e.target.value)} className={`${inputClass} font-mono text-xs leading-6`} /></Field>
                    </div>
                  </details>
                  <div className="rounded-xl border border-orange-500/30 bg-orange-500/[0.04] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={labelClass}>Custom HTML / DIV Code</p>
                        <p className="text-xs text-slate-500">Optional custom layout for this detailed page only.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('customHtml', `${editor.customHtml}${editor.customHtml ? '\n\n' : ''}<div class="blog-block">\n  <h2>Section heading</h2>\n  <p>Write your content here.</p>\n</div>`)}
                        className="rounded-lg border border-orange-500/50 px-3 py-2 text-xs font-bold text-orange-300 hover:bg-orange-500/10"
                      >
                        + Insert DIV
                      </button>
                    </div>
                    <textarea
                      rows={16}
                      value={editor.customHtml}
                      onChange={(e) => update('customHtml', e.target.value)}
                      spellCheck={false}
                      placeholder={'<div class="blog-block">\n  <h2>Heading</h2>\n  <p>Content...</p>\n</div>'}
                      className={`${inputClass} font-mono text-xs leading-6`}
                    />
                  </div>
                  <Field label="Conclusion — blank line between paragraphs"><textarea rows={6} value={editor.conclusion} onChange={(e) => update('conclusion', e.target.value)} className={inputClass} /></Field>
                  <details className="rounded-xl border border-slate-700 bg-[#0b1323]">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-white">FAQs and closing images</summary>
                    <div className="space-y-5 border-t border-slate-700 p-4">
                      <Field label="Closing Images — JSON array"><textarea rows={6} value={editor.closingImages} onChange={(e) => update('closingImages', e.target.value)} className={`${inputClass} font-mono text-xs leading-6`} /></Field>
                      <Field label="FAQs — JSON array"><textarea rows={10} value={editor.faqs} onChange={(e) => update('faqs', e.target.value)} className={`${inputClass} font-mono text-xs leading-6`} /></Field>
                    </div>
                  </details>
                </div>
              </section>

              <aside className="space-y-5 lg:sticky lg:top-5">
                <section className="rounded-2xl border border-slate-700 bg-[#111c30] p-5">
                  <h3 className="mb-4 font-black text-white">Publish</h3>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#0b1323] px-4 py-3">
                    <input type="checkbox" checked={editor.isPublished} onChange={(e) => update('isPublished', e.target.checked)} className="h-4 w-4 accent-orange-500" />
                    <span className="text-sm font-bold text-white">Published</span>
                  </label>
                  <div className="mt-4 space-y-4">
                    <Field label="Published Date"><input type="date" value={editor.publishedOn} onChange={(e) => update('publishedOn', e.target.value)} className={inputClass} /></Field>
                    <Field label="Updated Date"><input type="date" value={editor.updatedOn} onChange={(e) => update('updatedOn', e.target.value)} className={inputClass} /></Field>
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-700 bg-[#111c30] p-5">
                  <h3 className="mb-4 font-black text-white">Post Details</h3>
                  <div className="space-y-4">
                    <Field label="Author"><input value={editor.author} onChange={(e) => update('author', e.target.value)} className={inputClass} /></Field>
                    <Field label="Read Time"><input value={editor.readTime} onChange={(e) => update('readTime', e.target.value)} className={inputClass} /></Field>
                    <Field label="Accent Color"><input type="color" value={editor.accent} onChange={(e) => update('accent', e.target.value)} className={`${inputClass} h-12`} /></Field>
                  </div>
                </section>
              </aside>
            </div>

            <div className="hidden"><button type="button" onClick={() => setEditor(null)}>Cancel</button><button type="submit" disabled={saving}>Save Blog</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
