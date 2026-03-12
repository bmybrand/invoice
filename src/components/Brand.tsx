'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

type BrandRow = {
  id: number
  brand_name: string
  brand_url: string
  logo_url: string
  favicon_url: string
  created_at?: string
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function PencilIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}

function TrashIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function PlusIcon({ className = 'h-4 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ChevronLeftIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

export default function Brand() {
  const { displayRole } = useDashboardProfile()
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addLogoUrl, setAddLogoUrl] = useState('')
  const [addFaviconUrl, setAddFaviconUrl] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null)
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editFaviconUrl, setEditFaviconUrl] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingBrand, setDeletingBrand] = useState<BrandRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isSuperAdmin = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin'

  const PAGE_SIZE = 10

  const fetchBrands = useCallback(async () => {
    setBrandsLoading(true)
    const { data, error } = await supabase
      .from('brands')
      .select('id, brand_name, brand_url, logo_url, favicon_url, created_at')
      .order('created_at', { ascending: false })
    setBrandsLoading(false)
    if (error) {
      console.error('Failed to fetch brands', error)
      setBrands([])
      return
    }
    setBrands((data as BrandRow[]) ?? [])
  }, [])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const filteredBrands = searchQuery.trim()
    ? brands.filter(
        (b) =>
          (b.brand_name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (b.brand_url || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          String(b.id).includes(searchQuery.trim())
      )
    : brands
  const totalPages = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE))
  const start = (currentPage - 1) * PAGE_SIZE
  const paginatedBrands = filteredBrands.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!expandedImageUrl) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedImageUrl(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expandedImageUrl])

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return
    setAddError(null)
    setAddLoading(true)

    const { error: insertError } = await supabase.from('brands').insert({
      brand_name: addName.trim(),
      brand_url: addUrl.trim() || null,
      logo_url: addLogoUrl.trim() || null,
      favicon_url: addFaviconUrl.trim() || null,
    })

    setAddLoading(false)
    if (insertError) {
      setAddError(insertError.message)
      return
    }

    setShowAddModal(false)
    setAddName('')
    setAddUrl('')
    setAddLogoUrl('')
    setAddFaviconUrl('')
    await fetchBrands()
  }

  function openEditModal(brand: BrandRow) {
    setEditingBrand(brand)
    setEditName(brand.brand_name || '')
    setEditUrl(brand.brand_url || '')
    setEditLogoUrl(brand.logo_url || '')
    setEditFaviconUrl(brand.favicon_url || '')
    setEditError(null)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBrand || !isSuperAdmin) return
    setEditError(null)
    setEditLoading(true)

    const { error } = await supabase
      .from('brands')
      .update({
        brand_name: editName.trim(),
        brand_url: editUrl.trim() || null,
        logo_url: editLogoUrl.trim() || null,
        favicon_url: editFaviconUrl.trim() || null,
      })
      .eq('id', editingBrand.id)

    setEditLoading(false)
    if (error) {
      setEditError(error.message)
      return
    }

    setEditingBrand(null)
    await fetchBrands()
  }

  async function handleDeleteConfirm() {
    if (!deletingBrand || !isSuperAdmin) return
    setDeleteLoading(true)
    const { error } = await supabase.from('brands').delete().eq('id', deletingBrand.id)
    setDeleteLoading(false)
    if (error) {
      console.error('Failed to delete brand', error)
      return
    }
    setDeletingBrand(null)
    await fetchBrands()
  }

  return (
    <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
      {/* Header */}
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Manage Brands</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">
              Create, edit and organize your global brand portfolio.
            </p>
          </div>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-12 min-w-36 px-6 bg-orange-500 rounded-xl shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] flex justify-center items-center gap-2 hover:bg-orange-600 transition shrink-0"
            >
              <PlusIcon className="h-4 w-3 text-white" />
              <span className="text-white text-sm font-bold">Add New Brand</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="w-full pb-6">
        <div className="w-full p-4 sm:p-6 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="h-12 w-full bg-slate-900/50 rounded-xl border border-slate-700 flex items-center gap-3 pl-4 overflow-hidden">
              <SearchIcon className="h-4 w-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brands by name, URL or ID..."
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <div className="w-full min-w-[640px]">
            {/* Table header */}
            <div className="w-full grid grid-cols-[minmax(80px,1fr)_minmax(120px,2fr)_minmax(120px,2fr)_128px_96px_100px] bg-slate-900/50 border-b border-slate-700">
              <div className="px-4 sm:px-6 py-4">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Brand ID</span>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Brand Name</span>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Brand URL</span>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Logo</span>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Favicon</span>
              </div>
              <div className="px-4 sm:px-6 py-4 text-right">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Action</span>
              </div>
            </div>
            {/* Table rows */}
            {brandsLoading ? (
              <div className="w-full px-4 sm:px-6 py-12 text-center text-slate-400 text-sm">
                Loading…
              </div>
            ) : paginatedBrands.length === 0 ? (
              <div className="w-full px-4 sm:px-6 py-12 text-center text-slate-400 text-sm">
                No brands yet. Add a brand to get started.
              </div>
            ) : (
            paginatedBrands.map((brand) => (
              <div
                key={brand.id}
                className="w-full grid grid-cols-[minmax(80px,1fr)_minmax(120px,2fr)_minmax(120px,2fr)_128px_96px_100px] border-t border-slate-700 items-center"
              >
                <div className="px-4 sm:px-6 py-4">
                  <span className="text-white text-sm font-bold font-mono">#{brand.id}</span>
                </div>
                <div className="px-4 sm:px-6 py-4">
                  <span className="text-white text-sm font-semibold">{brand.brand_name}</span>
                </div>
                <div className="px-4 sm:px-6 py-4">
                  {brand.brand_url ? (
                    <a href={brand.brand_url.startsWith('http') ? brand.brand_url : `https://${brand.brand_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm underline hover:text-blue-300">
                      {brand.brand_url}
                    </a>
                  ) : (
                    <span className="text-slate-500 text-sm">—</span>
                  )}
                </div>
                <div className="px-4 sm:px-6 py-4">
                  {brand.logo_url ? (
                    <button
                      type="button"
                      onClick={() => setExpandedImageUrl(brand.logo_url)}
                      className="w-10 h-10 rounded-lg border border-slate-800 overflow-hidden cursor-pointer hover:ring-2 hover:ring-orange-500/50 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <img src={brand.logo_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </div>
                <div className="px-4 sm:px-6 py-4">
                  {brand.favicon_url ? (
                    <button
                      type="button"
                      onClick={() => setExpandedImageUrl(brand.favicon_url)}
                      className="w-8 h-8 rounded-lg border border-slate-800 overflow-hidden cursor-pointer hover:ring-2 hover:ring-orange-500/50 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <img src={brand.favicon_url} alt="" className="w-full h-full" />
                    </button>
                  ) : (
                    <span className="text-slate-500 text-xs">—</span>
                  )}
                </div>
                <div className="px-4 sm:px-6 py-4 flex justify-end gap-1">
                  {isSuperAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditModal(brand)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition"
                        aria-label="Edit"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingBrand(brand)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition"
                        aria-label="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )))}
          </div>
        </div>

        {/* Pagination */}
        <div className="w-full px-4 sm:px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-slate-400 text-sm">
            Showing {filteredBrands.length === 0 ? 0 : start + 1} to {Math.min(start + PAGE_SIZE, filteredBrands.length)} of {filteredBrands.length} brands
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Expanded image modal */}
      {expandedImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setExpandedImageUrl(null)}
              aria-label="Close modal"
              className="absolute right-3 top-3 z-10 rounded-full border border-orange-400/40 bg-black/60 p-2 text-orange-400 transition hover:bg-black/80 hover:text-orange-300"
            >
              <CloseIcon />
            </button>
            <img
              src={expandedImageUrl}
              alt=""
              className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Add brand modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => !addLoading && setShowAddModal(false)}
              disabled={addLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Add New Brand</h2>
            <p className="mt-1 text-sm text-slate-400">Add a new brand to your portfolio.</p>
            <form onSubmit={handleAddSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="add-brand-name" className="block text-sm font-medium text-slate-300">Brand name</label>
                <input
                  id="add-brand-name"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  placeholder="e.g. Nike"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="add-brand-url" className="block text-sm font-medium text-slate-300">Brand URL</label>
                <input
                  id="add-brand-url"
                  type="text"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="e.g. nike.com"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="add-logo-url" className="block text-sm font-medium text-slate-300">Logo URL</label>
                <input
                  id="add-logo-url"
                  type="url"
                  value={addLogoUrl}
                  onChange={(e) => setAddLogoUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="add-favicon-url" className="block text-sm font-medium text-slate-300">Favicon URL</label>
                <input
                  id="add-favicon-url"
                  type="url"
                  value={addFaviconUrl}
                  onChange={(e) => setAddFaviconUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              {addError && (
                <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{addError}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 sm:w-auto sm:min-w-[148px]"
                >
                  {addLoading ? 'Adding…' : 'Add Brand'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => !deleteLoading && setDeletingBrand(null)}
              disabled={deleteLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Delete Brand</h2>
            <p className="mt-1 text-sm text-slate-400">
              Delete <span className="font-semibold text-white">{deletingBrand.brand_name}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 sm:w-auto sm:min-w-[140px]"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit brand modal */}
      {editingBrand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => !editLoading && setEditingBrand(null)}
              disabled={editLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Edit Brand</h2>
            <p className="mt-1 text-sm text-slate-400">Update brand details.</p>
            <form onSubmit={handleEditSubmit} className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="edit-brand-name" className="block text-sm font-medium text-slate-300">Brand name</label>
                <input
                  id="edit-brand-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="e.g. Nike"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="edit-brand-url" className="block text-sm font-medium text-slate-300">Brand URL</label>
                <input
                  id="edit-brand-url"
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="e.g. nike.com"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="edit-logo-url" className="block text-sm font-medium text-slate-300">Logo URL</label>
                <input
                  id="edit-logo-url"
                  type="url"
                  value={editLogoUrl}
                  onChange={(e) => setEditLogoUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="edit-favicon-url" className="block text-sm font-medium text-slate-300">Favicon URL</label>
                <input
                  id="edit-favicon-url"
                  type="url"
                  value={editFaviconUrl}
                  onChange={(e) => setEditFaviconUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              {editError && (
                <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{editError}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 sm:w-auto sm:min-w-[148px]"
                >
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
