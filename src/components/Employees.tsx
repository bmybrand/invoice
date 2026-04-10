'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'
import { logFetchError } from '@/lib/fetch-error'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 4
const PROFILE_AVATAR_BUCKET = 'profile-images'

type EmployeeRow = {
  id: number
  auth_id: string
  employee_name: string
  email: string
  role: string
  department: string
  avatar_path?: string | null
  avatar_url?: string | null
  created_at?: string
}

type ArchivedEmployeeRow = EmployeeRow

type EmployeesTableCache = {
  ownerAuthId: string | null
  employees: EmployeeRow[]
  avatarUrls: Record<string, string>
}

let employeesTableCache: EmployeesTableCache | null = null

function getDepartmentStyle(dept: string): string {
  const d = (dept || '').toLowerCase()
  if (d.includes('sales')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (d.includes('finance')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (d.includes('it')) return 'bg-sky-500/10 text-sky-400 border-sky-500/20'
  if (d.includes('development') || d.includes('devomplent') || d.includes('develop')) {
    return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function ChevronDownIcon({ className = 'h-4 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
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

function ArchiveIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5H3.75m15.75 0-1.06 11.126A2.25 2.25 0 0116.2 20.75H7.8a2.25 2.25 0 01-2.24-2.124L4.5 7.5m15 0-.47-2.114A2.25 2.25 0 0016.84 3.75H7.16a2.25 2.25 0 00-2.19 1.636L4.5 7.5m4.5 4.5h6m-3-3v6" />
    </svg>
  )
}

function ArrowPathIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m0 0-3.181 3.182A8.25 8.25 0 105.25 19.5m2.727-4.848H3.015v4.992m0 0 3.182-3.182" />
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

function UsersStatIcon({ className = 'h-6 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
    </svg>
  )
}

function CheckCircleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClockIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function areEmployeeRowsEqual(a: EmployeeRow[], b: EmployeeRow[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function areAvatarMapsEqual(a: Record<string, string>, b: Record<string, string>) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function buildEmployeeAvatarUrl(employee: Pick<EmployeeRow, 'avatar_path' | 'avatar_url'>) {
  const avatarPath = (employee.avatar_path || '').trim()
  if (avatarPath) {
    const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(avatarPath)
    return data.publicUrl || ''
  }
  return (employee.avatar_url || '').trim()
}

function initials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  return (tokens[0]?.[0] || '') + (tokens[1]?.[0] || tokens[0]?.[1] || '')
}

function avatarColorsFromName(name: string) {
  const normalized = name.trim().toLowerCase() || 'user'
  let hash = 0

  for (let index = 0; index < normalized.length; index += 1) {
    hash = normalized.charCodeAt(index) + ((hash << 5) - hash)
  }

  const hue = Math.abs(hash) % 360
  const background = `hsl(${hue} 56% 34%)`
  const border = `hsl(${hue} 62% 46%)`

  return { background, border }
}

function EmployeeAvatar({
  name,
  imageUrl,
  isOnline,
}: {
  name: string
  imageUrl?: string
  isOnline: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(imageUrl && !imageFailed)
  const colors = avatarColorsFromName(name)

  return (
    <div className="relative w-10 h-10 shrink-0">
      <div
        className="h-full w-full overflow-hidden rounded-full border border-orange-500/20 bg-orange-500/10 flex items-center justify-center text-sm font-bold text-white"
        style={
          showImage
            ? undefined
            : {
                backgroundColor: colors.background,
                borderColor: colors.border,
              }
        }
      >
        {showImage ? (
          <img
            src={imageUrl || ''}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{initials(name).toUpperCase()}</span>
        )}
      </div>
      {isOnline && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-800 bg-emerald-500"
          title="Online"
        />
      )}
    </div>
  )
}

export default function Employees() {
  const searchParams = useSearchParams()
  const { currentUserAuthId: profileCurrentUserAuthId, displayRole, onlineAuthIds } = useDashboardProfile()
  const { token } = useSessionContext()
  const scopedEmployeesCache =
    employeesTableCache?.ownerAuthId === profileCurrentUserAuthId ? employeesTableCache : null
  const [employees, setEmployees] = useState<EmployeeRow[]>(() => scopedEmployeesCache?.employees ?? [])
  const [employeesLoading, setEmployeesLoading] = useState(() => !scopedEmployeesCache)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<'user' | 'admin'>('user')
  const [addDepartment, setAddDepartment] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('globalSearch') || '').trim())
  const [roleFilter, setRoleFilter] = useState('') // '' = all, 'superadmin' | 'admin' | 'user'
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [employeeAvatarUrls, setEmployeeAvatarUrls] = useState<Record<string, string>>(
    () => scopedEmployeesCache?.avatarUrls ?? {}
  )
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'user' | 'admin' | 'superadmin'>('user')
  const [editDepartment, setEditDepartment] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [archivedEmployees, setArchivedEmployees] = useState<ArchivedEmployeeRow[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [archivedError, setArchivedError] = useState<string | null>(null)
  const [archivedActionEmployeeId, setArchivedActionEmployeeId] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'superadmin', label: 'Superadmin' },
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' }
  ]

  // Department dropdown options
  const departmentOptions = [
    { value: '', label: 'Select department' },
    { value: 'Finance', label: 'Finance' },
    { value: 'Sales', label: 'Sales' },
    { value: 'Development', label: 'Development' },
    { value: 'IT', label: 'IT' },
    { value: 'Other', label: 'Other' },
  ]
  const roleFilterLabel = roleOptions.find((o) => o.value === roleFilter)?.label ?? 'All Roles'

  const isSuperAdmin =
    (displayRole || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin'
  const isAdmin =
    (displayRole || '').trim().toLowerCase().replace(/\s+/g, '') === 'admin'
  const canManageArchivedEmployees = isSuperAdmin || isAdmin
  const onlineAuthIdSet = new Set(onlineAuthIds)

  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<number | null>(null)
  useEffect(() => {
    if (!profileCurrentUserAuthId) {
      const timeoutId = window.setTimeout(() => {
        setCurrentUserEmployeeId(null)
      }, 0)
      return () => window.clearTimeout(timeoutId)
    }

    let cancelled = false
    const timeoutId = window.setTimeout(() => {
      supabase
        .from('employees')
        .select('id')
        .eq('auth_id', profileCurrentUserAuthId)
        .neq('isdeleted', true)
        .maybeSingle()
        .then(({ data: emp }) => {
          if (cancelled) return
          setCurrentUserEmployeeId(emp ? (emp as { id: number }).id : null)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [profileCurrentUserAuthId])

  function canEdit(emp: EmployeeRow): boolean {
    if (emp.auth_id === profileCurrentUserAuthId) return true
    const role = (emp.role || '').trim().toLowerCase().replace(/\s+/g, '')
    if (isSuperAdmin) {
      if (role === 'superadmin') return false
      return true
    }
    if (isAdmin && role === 'user') return true
    return false
  }

  function canDelete(emp: EmployeeRow): boolean {
    if (emp.auth_id === profileCurrentUserAuthId) return false
    const role = (emp.role || '').trim().toLowerCase().replace(/\s+/g, '')
    if (isSuperAdmin) return true
    if (isAdmin && role === 'user') return true
    return false
  }

  const canManageArchivedEmployee = useCallback((emp: ArchivedEmployeeRow): boolean => {
    if (emp.auth_id === profileCurrentUserAuthId) return false
    const role = (emp.role || '').trim().toLowerCase().replace(/\s+/g, '')
    if (isSuperAdmin) return true
    if (isAdmin && role === 'user') return true
    return false
  }, [isAdmin, isSuperAdmin, profileCurrentUserAuthId])

  const filteredEmployees = (() => {
    let list = employees
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (e) =>
          (e.employee_name || '').toLowerCase().includes(q) ||
          (e.email || '').toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q) ||
          (e.role || '').toLowerCase().includes(q)
      )
    }
    if (roleFilter) {
      list = list.filter((e) => (e.role || '').toLowerCase() === roleFilter.toLowerCase())
    }
    return list
  })()

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE))
  const start = (currentPage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginatedEmployees = filteredEmployees.slice(start, end)

  // Reset to page 1 when search or role filter changes
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [searchQuery, roleFilter])

  useEffect(() => {
    if (currentPage <= totalPages) return
    const timeoutId = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [currentPage, totalPages])

  const fetchEmployeeAvatarUrls = useCallback(async (rows: EmployeeRow[]) => {
    if (rows.length === 0) {
      setEmployeeAvatarUrls({})
      employeesTableCache = {
        ownerAuthId: profileCurrentUserAuthId,
        employees: scopedEmployeesCache?.employees ?? [],
        avatarUrls: {},
      }
      return
    }

    const nextMap = Object.fromEntries(
      rows
        .map((employee) => [employee.auth_id, buildEmployeeAvatarUrl(employee)] as const)
        .filter((entry) => entry[1])
    )
    setEmployeeAvatarUrls((prev) => {
      const next = areAvatarMapsEqual(prev, nextMap) ? prev : nextMap
      employeesTableCache = {
        ownerAuthId: profileCurrentUserAuthId,
        employees: scopedEmployeesCache?.employees ?? [],
        avatarUrls: next,
      }
      return next
    })
  }, [profileCurrentUserAuthId, scopedEmployeesCache])

  const fetchEmployees = useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background ?? false
    if (!isBackgroundRefresh && !scopedEmployeesCache) {
      setEmployeesLoading(true)
    }
    const { data, error } = await supabase
      .from('employees')
      .select('id, auth_id, employee_name, email, role, department, avatar_path, avatar_url, created_at')
      .neq('isdeleted', true)
      .order('created_at', { ascending: false })

    if (!isBackgroundRefresh) {
      setEmployeesLoading(false)
    }
    if (error) {
      logFetchError('Failed to fetch employees', error)
      setEmployees([])
      setEmployeeAvatarUrls({})
      if (!isBackgroundRefresh) {
        employeesTableCache = null
      }
      return
    }
    const rows = (data as EmployeeRow[]) ?? []
    setEmployees((prev) => {
      if (prev.length !== rows.length || !areEmployeeRowsEqual(prev, rows)) {
        const next = rows
        employeesTableCache = {
          ownerAuthId: profileCurrentUserAuthId,
          employees: next,
          avatarUrls: scopedEmployeesCache?.avatarUrls ?? {},
        }
        return next
      }
      // Force update to trigger UI refresh on delete/add
      employeesTableCache = {
        ownerAuthId: profileCurrentUserAuthId,
        employees: [...rows],
        avatarUrls: scopedEmployeesCache?.avatarUrls ?? {},
      }
      return [...rows]
    })
    void fetchEmployeeAvatarUrls(rows)
  }, [fetchEmployeeAvatarUrls, profileCurrentUserAuthId, scopedEmployeesCache])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchEmployees()
    }, 0)

    // Supabase Realtime subscription for employees table
    const channelName = `employees-table-sync-${profileCurrentUserAuthId || 'unknown'}`
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'employees',
      },
      () => { void fetchEmployees({ background: true }) }
    )
    channel.subscribe()

    return () => {
      window.clearTimeout(timeoutId)
      void supabase.removeChannel(channel)
    }
  }, [fetchEmployees, profileCurrentUserAuthId])

  useEffect(() => {
    const nextQuery = (searchParams.get('globalSearch') || '').trim()
    setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery))
  }, [searchParams])

  const fetchArchivedEmployees = useCallback(async () => {
    setArchivedLoading(true)
    setArchivedError(null)

    const { data, error } = await supabase
      .from('employees')
      .select('id, auth_id, employee_name, email, role, department, avatar_path, avatar_url, created_at')
      .eq('isdeleted', true)
      .order('created_at', { ascending: false })

    setArchivedLoading(false)

    if (error) {
      setArchivedError(error.message || 'Failed to load archived employees')
      return
    }

    const rows = ((data as ArchivedEmployeeRow[]) ?? []).filter((employee) => canManageArchivedEmployee(employee))
    setArchivedEmployees(rows)
  }, [canManageArchivedEmployee])

  useEffect(() => {
    if (!showArchivedModal) return
    const timeoutId = window.setTimeout(() => {
      void fetchArchivedEmployees()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchArchivedEmployees, showArchivedModal])

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return
    setAddError(null)
    setAddLoading(true)

    const accessToken = token?.trim() || ''
    if (!accessToken) {
      setAddLoading(false)
      setAddError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: addEmail,
        password: addPassword,
        name: addName,
        role: addRole,
        department: addDepartment,
      }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null

    setAddLoading(false)
    if (!response.ok) {
      setAddError(result?.error || 'Failed to create user')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to create user' })
      return
    }

    setShowAddModal(false)
    setAddEmail('')
    setAddPassword('')
    setAddName('')
    setAddRole('user')
    setAddDepartment('')
    setActionMessage({ type: 'success', text: `Employee ${addName.trim()} added successfully.` })
    await fetchEmployees()
  }

  function openEditModal(emp: EmployeeRow) {
    setEditingEmployee(emp)
    setEditName(emp.employee_name || '')
    const role = (emp.role || '').trim().toLowerCase().replace(/\s+/g, '')
    setEditRole(
      role === 'superadmin' ? 'superadmin' : role === 'admin' ? 'admin' : 'user'
    )
    setEditDepartment(emp.department || '')
    setEditPassword('')
    setEditError(null)
  }

  async function updateEmployeePassword(authId: string) {
    const nextPassword = editPassword.trim()
    if (!nextPassword || !isSuperAdmin) return null

    if (nextPassword.length < 8) {
      return 'Password must be at least 8 characters long.'
    }

    let accessToken = token?.trim() || ''

    if (!accessToken) {
      return 'Authentication expired. Sign in again and try again.'
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch('/api/employees/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          authId,
          password: nextPassword,
        }),
      })

      const result = await response.json().catch(() => null)
      if (response.ok) {
        return null
      }

      const authError =
        response.status === 401 &&
        (result?.error === 'Authentication failed' || result?.error === 'Missing authorization token')

      if (!authError || attempt === 1) {
        return result?.error || 'Failed to update employee password.'
      }

      accessToken = token?.trim() || ''
      if (!accessToken) {
        return 'Authentication expired. Sign in again and try again.'
      }
    }
    return 'Failed to update employee password.'
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEmployee || !canEdit(editingEmployee)) return
    setEditError(null)
    setEditLoading(true)

    const passwordError = await updateEmployeePassword(editingEmployee.auth_id)
    if (passwordError) {
      setEditLoading(false)
      setEditError(passwordError)
      setActionMessage({ type: 'error', text: passwordError })
      return
    }

    const isEditingSuperAdmin = (editingEmployee.role || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin'

    if (editRole === 'superadmin' && !isEditingSuperAdmin && currentUserEmployeeId) {
      const { error: demoteError } = await supabase
        .from('employees')
        .update({ role: 'admin' })
        .eq('id', currentUserEmployeeId)
      if (demoteError) {
        setEditLoading(false)
        setEditError(demoteError.message)
        setActionMessage({ type: 'error', text: demoteError.message })
        return
      }
      const { error: promoteError } = await supabase
        .from('employees')
        .update({
          employee_name: editName.trim(),
          role: 'superadmin',
          department: editDepartment.trim(),
        })
        .eq('id', editingEmployee.id)
      setEditLoading(false)
      if (promoteError) {
        setEditError(promoteError.message)
        setActionMessage({ type: 'error', text: promoteError.message })
        return
      }
      setActionMessage({ type: 'success', text: `Employee ${editName.trim()} updated successfully.` })
      setEditingEmployee(null)
      await fetchEmployees()
      window.location.reload()
      return
    }

    const isEditingSelf = editingEmployee.auth_id === profileCurrentUserAuthId
    const updatePayload: { employee_name: string; role?: string; department: string } = {
      employee_name: editName.trim(),
      department: isEditingSelf ? (editingEmployee.department || '').trim() : editDepartment.trim(),
    }
    if (!isEditingSuperAdmin && !isAdmin && !isEditingSelf) updatePayload.role = editRole

    const { error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', editingEmployee.id)

    setEditLoading(false)
    if (error) {
      setEditError(error.message)
      setActionMessage({ type: 'error', text: error.message })
      return
    }

    setEditingEmployee(null)
    setActionMessage({ type: 'success', text: `Employee ${editName.trim()} updated successfully.` })
    await fetchEmployees()
  }

  async function handleDeleteConfirm() {
    if (!deletingEmployee || !canDelete(deletingEmployee)) return
    setDeleteError(null)
    setDeleteLoading(true)
    const accessToken = token?.trim() || ''

    if (!accessToken) {
      setDeleteLoading(false)
      setDeleteError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const response = await fetch(`/api/employees/${deletingEmployee.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setDeleteLoading(false)
    if (!response.ok) {
      setDeleteError(result?.error || 'Failed to delete employee')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to delete employee' })
      return
    }
    setActionMessage({ type: 'success', text: `Employee ${deletingEmployee.employee_name} archived successfully.` })
    setDeletingEmployee(null)
    await fetchEmployees()
    if (showArchivedModal) {
      await fetchArchivedEmployees()
    }
  }

  async function handleArchivedEmployeeAction(employee: ArchivedEmployeeRow, action: 'purge' | 'restore') {
    if (archivedActionEmployeeId !== null) return

    setArchivedActionEmployeeId(employee.id)
    setArchivedError(null)

    const accessToken = token?.trim() || ''
    if (!accessToken) {
      setArchivedActionEmployeeId(null)
      setArchivedError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const response = await fetch(`/api/employees/${employee.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ action }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setArchivedActionEmployeeId(null)

    if (!response.ok) {
      setArchivedError(
        result?.error ||
          (action === 'restore'
            ? 'Failed to restore archived employee'
            : 'Failed to permanently delete archived employee')
      )
      setActionMessage({
        type: 'error',
        text:
          result?.error ||
          (action === 'restore'
            ? 'Failed to restore archived employee'
            : 'Failed to permanently delete archived employee'),
      })
      return
    }

    setActionMessage({
      type: 'success',
      text:
        action === 'restore'
          ? `Archived employee ${employee.employee_name} was restored.`
          : `Archived employee ${employee.employee_name} was permanently deleted.`,
    })

    await fetchEmployees({ background: true })
    await fetchArchivedEmployees()
  }

  return (
    <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
      {/* Header */}
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Manage Employees</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">Overview of your current workforce and roles</p>
          </div>
          {(canManageArchivedEmployees || isSuperAdmin) && (
            <div className="flex items-center gap-2">
              {canManageArchivedEmployees ? (
                <button
                  type="button"
                  onClick={() => setShowArchivedModal(true)}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700/80 hover:text-white"
                  aria-label="View archived employees"
                  title="View archived employees"
                >
                  <ArchiveIcon className="h-4 w-4" />
                </button>
              ) : null}
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="h-12 min-w-36 px-6 bg-orange-500 rounded-xl shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] flex justify-center items-center gap-2 hover:bg-orange-600 transition shrink-0"
                >
                  <PlusIcon className="h-4 w-3 text-white" />
                  <span className="text-white text-sm font-bold">Add New Employee</span>
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards - above search */}
      <div className="w-full pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <UsersStatIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-normal">Total Employees</p>
              <p className="text-white text-xl font-bold">{employeesLoading ? '…' : filteredEmployees.length}</p>
            </div>
          </div>
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-normal">Admins</p>
              <p className="text-white text-xl font-bold">{employeesLoading ? '…' : filteredEmployees.filter((e) => (e.role || '').toLowerCase() === 'admin').length}</p>
            </div>
          </div>
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg">
              <ClockIcon className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-normal">Users</p>
              <p className="text-white text-xl font-bold">{employeesLoading ? '…' : filteredEmployees.filter((e) => (e.role || '').toLowerCase() === 'user').length}</p>
            </div>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="w-full pb-6">
          <p
            className={`rounded-lg border px-4 py-3 text-sm ${
              actionMessage.type === 'error'
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {actionMessage.text}
          </p>
        </div>
      )}

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
                placeholder="Search by name, email, department or role"
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="w-full sm:w-52 h-12 rounded-xl border border-slate-700 flex items-center relative">
            <button
              type="button"
              onClick={() => setRoleDropdownOpen((open) => !open)}
              className="w-full h-full px-4 bg-[#141e32] text-slate-300 text-sm font-medium focus:outline-none cursor-pointer flex justify-between items-center rounded-xl hover:bg-[#1a2842] transition text-left"
              aria-haspopup="listbox"
              aria-expanded={roleDropdownOpen}
              aria-label="Filter by role"
            >
              <span>{roleFilterLabel}</span>
              <ChevronDownIcon className={`h-4 w-3 text-slate-400 shrink-0 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {roleDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setRoleDropdownOpen(false)} />
                <ul
                  className="absolute left-0 right-0 top-full mt-1 z-20 py-1 rounded-xl border border-slate-700 bg-[#141e32] shadow-xl overflow-hidden"
                  role="listbox"
                >
                  {roleOptions.map((opt) => (
                    <li key={opt.value || 'all'}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={roleFilter === opt.value}
                        onClick={() => {
                          setRoleFilter(opt.value)
                          setRoleDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-medium transition ${roleFilter === opt.value ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-800/80'}`}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          {/* Table header */}
          <div className="w-full min-w-[560px] bg-slate-900/50 border-b border-slate-700 grid grid-cols-[1fr_1fr_140px_100px] gap-0">
            <div className="px-4 sm:px-6 py-4">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Employee</span>
            </div>
            <div className="px-4 sm:px-6 py-4">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Role</span>
            </div>
            <div className="px-4 sm:px-6 py-4">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Department</span>
            </div>
            <div className="px-4 sm:px-6 py-4 text-right">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Actions</span>
            </div>
          </div>

          {/* Table rows */}
          {employeesLoading ? (
            <div className="w-full min-w-[560px] border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
              Loading employees…
            </div>
          ) : (
            paginatedEmployees.map((emp) => (
            <div key={emp.id} className="w-full min-w-[560px] border-t border-slate-700 grid grid-cols-[1fr_1fr_140px_100px] gap-0 items-center">
              <div className="px-4 sm:px-6 py-4 flex items-center gap-3 min-w-0">
                <EmployeeAvatar
                  name={emp.employee_name || emp.email || 'User'}
                  imageUrl={employeeAvatarUrls[emp.auth_id] || ''}
                  isOnline={onlineAuthIdSet.has(emp.auth_id)}
                />
                <div className="min-w-0">
                  <p className="text-white text-sm font-bold truncate">{emp.employee_name}</p>
                  <p className="text-slate-400 text-xs truncate">{emp.email}</p>
                </div>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <p className="text-slate-300 text-sm capitalize">{emp.role}</p>
              </div>
              <div className="px-4 sm:px-6 py-4">
                <span className={`inline-block px-2 py-1 rounded-lg border text-xs font-medium ${getDepartmentStyle(emp.department)}`}>{emp.department}</span>
              </div>
              <div className="px-4 sm:px-6 py-4 flex justify-end gap-1">
                {canEdit(emp) && (
                  <button
                    type="button"
                    onClick={() => openEditModal(emp)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition"
                    aria-label="Edit"
                  >
                    <PencilIcon />
                  </button>
                )}
                {canDelete(emp) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null)
                      setDeletingEmployee(emp)
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition"
                    aria-label="Delete"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          )))}
        </div>

        {/* Pagination */}
        <div className="w-full px-4 sm:px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-slate-400 text-xs">
            {employeesLoading
              ? 'Loading…'
              : filteredEmployees.length === 0
                ? searchQuery.trim() ? 'No matching employees' : 'No employees'
                : `Showing ${start + 1} to ${Math.min(end, filteredEmployees.length)} of ${filteredEmployees.length} employees`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>
            {(() => {
              const pages: (number | 'ellipsis')[] =
                totalPages <= 4
                  ? Array.from({ length: totalPages }, (_, i) => i + 1)
                  : [1, 2, 'ellipsis', totalPages]
              return pages.map((page, i) =>
                page === 'ellipsis' ? (
                  <span key="ellipsis" className="w-8 text-center text-slate-500 text-xs">
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg flex justify-center items-center text-xs font-medium transition ${
                      currentPage === page
                        ? 'bg-orange-500 text-white'
                        : 'border border-slate-700 text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {page}
                  </button>
                )
              )
            })()}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                if (!deleteLoading) {
                  setDeleteError(null)
                  setDeletingEmployee(null)
                }
              }}
              disabled={deleteLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Delete Employee</h2>
            <p className="mt-1 text-sm text-slate-400">
              Archive <span className="font-semibold text-white">{deletingEmployee.employee_name}</span>? This hides the employee but keeps historical invoice links.
            </p>
            {deleteError && (
              <p className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 sm:w-auto sm:min-w-[140px]"
              >
                {deleteLoading ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchivedModal && canManageArchivedEmployees && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="flex max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Archived Employees</h2>
                <p className="mt-1 text-sm text-slate-400">Restore archived employees or permanently delete them when no invoices are linked.</p>
              </div>
              <button
                type="button"
                onClick={() => archivedActionEmployeeId === null && setShowArchivedModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition"
                aria-label="Close archived employees"
              >
                <CloseIcon />
              </button>
            </div>

            {archivedError && (
              <div className="px-6 pt-4">
                <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {archivedError}
                </p>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
              <table className="w-full min-w-[760px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-700 text-left">
                    <th className="w-[80px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">ID</th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Employee</th>
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Email</th>
                    <th className="w-[120px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Role</th>
                    <th className="w-[140px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Department</th>
                    <th className="w-[160px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Archived</th>
                    <th className="w-[160px] px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">Loading archived employees...</td>
                    </tr>
                  ) : archivedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">No archived employees found.</td>
                    </tr>
                  ) : (
                    archivedEmployees.map((employee) => (
                      <tr key={employee.id} className="border-b border-slate-700/60 last:border-b-0">
                        <td className="px-3 py-4 text-sm font-mono text-white">{employee.id}</td>
                        <td className="px-3 py-4 text-sm font-semibold text-white">{employee.employee_name || '-'}</td>
                        <td className="px-3 py-4 text-sm text-slate-300">{employee.email || '-'}</td>
                        <td className="px-3 py-4 text-sm capitalize text-slate-300">{employee.role || '-'}</td>
                        <td className="px-3 py-4 text-sm text-slate-300">{employee.department || '-'}</td>
                        <td className="px-3 py-4 text-sm text-slate-400">{employee.created_at ? new Date(employee.created_at).toLocaleDateString() : '--'}</td>
                        <td className="px-3 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleArchivedEmployeeAction(employee, 'restore')}
                              disabled={archivedActionEmployeeId !== null}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                              title="Restore employee"
                              aria-label="Restore employee"
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleArchivedEmployeeAction(employee, 'purge')}
                              disabled={archivedActionEmployeeId !== null}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                              title="Delete forever"
                              aria-label="Delete forever"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit employee modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => !editLoading && setEditingEmployee(null)}
              disabled={editLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Edit Employee</h2>
            <p className="mt-1 text-sm text-slate-400">Update employee details.</p>
            <form
              onSubmit={handleEditSubmit}
              onInvalidCapture={handleRequiredFieldInvalid}
              onInputCapture={clearRequiredFieldInvalid}
              onChangeCapture={clearRequiredFieldInvalid}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-slate-300">Employee name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="Full name"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="edit-email" className="block text-sm font-medium text-slate-300">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={editingEmployee.email}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-slate-500 cursor-not-allowed"
                />
                <p className="mt-0.5 text-xs text-slate-500">Email cannot be changed</p>
              </div>
              <div>
                <label htmlFor="edit-role" className="block text-sm font-medium text-slate-300">Role</label>
                {(editingEmployee?.role || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin' ? (
                  <>
                    <input
                      id="edit-role"
                      type="text"
                      value="Superadmin"
                      readOnly
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-slate-500 cursor-not-allowed"
                    />
                    <p className="mt-0.5 text-xs text-slate-500">Superadmin role cannot be changed</p>
                  </>
                ) : isAdmin || editingEmployee?.auth_id === profileCurrentUserAuthId ? (
                  <>
                    <input
                      id="edit-role"
                      type="text"
                      value={(editingEmployee?.role || 'user').charAt(0).toUpperCase() + (editingEmployee?.role || 'user').slice(1).toLowerCase()}
                      readOnly
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-slate-500 cursor-not-allowed"
                    />
                    <p className="mt-0.5 text-xs text-slate-500">{isAdmin ? 'Admin cannot change role' : 'You can only update your name and department'}</p>
                  </>
                ) : (
                  <>
                    <select
                      id="edit-role"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as 'user' | 'admin' | 'superadmin')}
                      className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      {isSuperAdmin && (
                        <option value="superadmin">Superadmin</option>
                      )}
                    </select>
                    {editRole === 'superadmin' && (
                      <p className="mt-1 text-xs text-amber-400">Promoting to Superadmin will transfer your role — you will become Admin.</p>
                    )}
                  </>
                )}
              </div>
              <div>
                <label htmlFor="edit-department" className="block text-sm font-medium text-slate-300">Department</label>
                <select
                  id="edit-department"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  disabled={editingEmployee.auth_id === profileCurrentUserAuthId}
                  required
                  className={`mt-1 w-full rounded-lg border px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    editingEmployee.auth_id === profileCurrentUserAuthId
                      ? 'cursor-not-allowed border-slate-600 bg-slate-900/50 text-slate-500'
                      : 'border-slate-600 bg-slate-900 text-white'
                  }`}
                >
                  {departmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {editingEmployee.auth_id === profileCurrentUserAuthId ? (
                  <p className="mt-0.5 text-xs text-slate-500">You cannot change your own department.</p>
                ) : null}
              </div>
              {isSuperAdmin && (
                <div>
                  <label htmlFor="edit-password" className="block text-sm font-medium text-slate-300">New password</label>
                  <input
                    id="edit-password"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <p className="mt-0.5 text-xs text-slate-500">
                    Superadmin only. Leave this blank if you do not want to change the password.
                  </p>
                </div>
              )}
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

      {/* Add user modal */}
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
            <h2 className="text-lg font-bold text-white">Add New Employee</h2>
            <p className="mt-1 text-sm text-slate-400">Create a user or admin. Super Admin is set separately (one only).</p>
            <form
              onSubmit={handleAddSubmit}
              onInvalidCapture={handleRequiredFieldInvalid}
              onInputCapture={clearRequiredFieldInvalid}
              onChangeCapture={clearRequiredFieldInvalid}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label htmlFor="add-name" className="block text-sm font-medium text-slate-300">Employee name</label>
                <input
                  id="add-name"
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  placeholder="Full name"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="add-email" className="block text-sm font-medium text-slate-300">Email</label>
                <input
                  id="add-email"
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  required
                  placeholder="employee@company.com"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="add-password" className="block text-sm font-medium text-slate-300">Password</label>
                <input
                  id="add-password"
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              <div>
                <label htmlFor="add-role" className="block text-sm font-medium text-slate-300">Role</label>
                <select
                  id="add-role"
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as 'user' | 'admin')}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label htmlFor="add-department" className="block text-sm font-medium text-slate-300">Department</label>
                <select
                  id="add-department"
                  value={addDepartment}
                  onChange={(e) => setAddDepartment(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {departmentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
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
                  {addLoading ? 'Adding User...' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
