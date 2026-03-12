'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 10
const PROFILE_AVATAR_BUCKET = 'profile-images'

type EmployeeRow = {
  id: number
  auth_id: string
  employee_name: string
  email: string
  role: string
  department: string
  created_at?: string
}

function getDepartmentStyle(dept: string): string {
  const d = (dept || '').toLowerCase()
  if (d.includes('design')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (d.includes('engineer')) return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  if (d.includes('market')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
  if (d.includes('operation')) return 'bg-teal-500/10 text-teal-400 border-teal-500/20'
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

export default function Employees() {
  const { displayRole, onlineAuthIds } = useDashboardProfile()
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addName, setAddName] = useState('')
  const [addRole, setAddRole] = useState<'user' | 'admin'>('user')
  const [addDepartment, setAddDepartment] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('') // '' = all, 'superadmin' | 'admin' | 'user'
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [employeeAvatarUrls, setEmployeeAvatarUrls] = useState<Record<string, string>>({})
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'user' | 'admin' | 'superadmin'>('user')
  const [editDepartment, setEditDepartment] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'superadmin', label: 'Superadmin' },
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
  ]
  const roleFilterLabel = roleOptions.find((o) => o.value === roleFilter)?.label ?? 'All Roles'

  const isSuperAdmin =
    (displayRole || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin'
  const isAdmin =
    (displayRole || '').trim().toLowerCase().replace(/\s+/g, '') === 'admin'
  const onlineAuthIdSet = new Set(onlineAuthIds)

  const [currentUserAuthId, setCurrentUserAuthId] = useState<string | null>(null)
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<number | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const authId = data.user?.id ?? null
      setCurrentUserAuthId(authId)
      if (authId) {
        const { data: emp } = await supabase.from('employees').select('id').eq('auth_id', authId).maybeSingle()
        setCurrentUserEmployeeId(emp ? (emp as { id: number }).id : null)
      } else {
        setCurrentUserEmployeeId(null)
      }
    })
  }, [])

  function canEdit(emp: EmployeeRow): boolean {
    if (emp.auth_id === currentUserAuthId) return true
    const role = (emp.role || '').trim().toLowerCase().replace(/\s+/g, '')
    if (isSuperAdmin) {
      if (role === 'superadmin') return false
      return true
    }
    if (isAdmin && role === 'user') return true
    return false
  }

  function canDelete(emp: EmployeeRow): boolean {
    if (emp.auth_id === currentUserAuthId) return false
    const role = (emp.role || '').trim().toLowerCase().replace(/\s+/g, '')
    if (isSuperAdmin) return true
    if (isAdmin && role === 'user') return true
    return false
  }

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
    setCurrentPage(1)
  }, [searchQuery, roleFilter])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [currentPage, totalPages])

  const fetchEmployeeAvatarUrls = useCallback(async (rows: EmployeeRow[]) => {
    const authIds = Array.from(new Set(rows.map((row) => row.auth_id).filter(Boolean)))

    if (authIds.length === 0) {
      setEmployeeAvatarUrls({})
      return
    }

    const avatarEntries = await Promise.all(
      authIds.map(async (authId) => {
        const { data, error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).list(authId)

        if (error || !data?.length) return [authId, ''] as const

        const latestFile = [...data]
          .sort((a, b) => {
            const aTime = Date.parse(a.updated_at || a.created_at || '')
            const bTime = Date.parse(b.updated_at || b.created_at || '')
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime)
          })[0]

        if (!latestFile?.name) return [authId, ''] as const

        const { data: publicUrlData } = supabase.storage
          .from(PROFILE_AVATAR_BUCKET)
          .getPublicUrl(`${authId}/${latestFile.name}`)

        return [authId, publicUrlData.publicUrl] as const
      })
    )

    setEmployeeAvatarUrls(
      Object.fromEntries(avatarEntries.filter((entry) => entry[1]))
    )
  }, [])

  const fetchEmployees = useCallback(async () => {
    setEmployeesLoading(true)
    const { data, error } = await supabase
      .from('employees')
      .select('id, auth_id, employee_name, email, role, department, created_at')
      .order('created_at', { ascending: false })

    setEmployeesLoading(false)
    if (error) {
      console.error('Failed to fetch employees', error)
      setEmployees([])
      setEmployeeAvatarUrls({})
      return
    }
    const rows = (data as EmployeeRow[]) ?? []
    setEmployees(rows)
    void fetchEmployeeAvatarUrls(rows)
  }, [fetchEmployeeAvatarUrls])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return
    setAddError(null)
    setAddLoading(true)

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: addEmail,
      password: addPassword,
    })

    if (signUpError) {
      setAddError(signUpError.message)
      setAddLoading(false)
      return
    }

    if (!authData.user?.id) {
      setAddError('Failed to create user')
      setAddLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('employees').insert({
      auth_id: authData.user.id,
      email: addEmail,
      employee_name: addName,
      role: addRole,
      department: addDepartment,
    })

    setAddLoading(false)
    if (insertError) {
      setAddError(insertError.message)
      return
    }

    setShowAddModal(false)
    setAddEmail('')
    setAddPassword('')
    setAddName('')
    setAddRole('user')
    setAddDepartment('')
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

  async function getAuthTokenForPasswordUpdate() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.access_token?.trim()) {
      return session.access_token.trim()
    }

    const {
      data: refreshedData,
      error: refreshError,
    } = await supabase.auth.refreshSession()

    if (refreshError) {
      return ''
    }

    return refreshedData.session?.access_token?.trim() || ''
  }

  async function updateEmployeePassword(authId: string) {
    const nextPassword = editPassword.trim()
    if (!nextPassword || !isSuperAdmin) return null

    if (nextPassword.length < 8) {
      return 'Password must be at least 8 characters long.'
    }

    let token = await getAuthTokenForPasswordUpdate()

    if (!token) {
      return 'Authentication expired. Sign in again and try again.'
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch('/api/employees/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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

      token = await getAuthTokenForPasswordUpdate()
      if (!token) {
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
        return
      }
      setEditingEmployee(null)
      await fetchEmployees()
      window.location.reload()
      return
    }

    const isEditingSelf = editingEmployee.auth_id === currentUserAuthId
    const updatePayload: { employee_name: string; role?: string; department: string } = {
      employee_name: editName.trim(),
      department: editDepartment.trim(),
    }
    if (!isEditingSuperAdmin && !isAdmin && !isEditingSelf) updatePayload.role = editRole

    const { error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', editingEmployee.id)

    setEditLoading(false)
    if (error) {
      setEditError(error.message)
      return
    }

    setEditingEmployee(null)
    await fetchEmployees()
  }

  async function handleDeleteConfirm() {
    if (!deletingEmployee || !canDelete(deletingEmployee)) return
    setDeleteLoading(true)
    const { error } = await supabase.from('employees').delete().eq('id', deletingEmployee.id)
    setDeleteLoading(false)
    if (error) {
      console.error('Failed to delete employee', error)
      return
    }
    setDeletingEmployee(null)
    await fetchEmployees()
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
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-12 min-w-36 px-6 bg-orange-500 rounded-xl shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] flex justify-center items-center gap-2 hover:bg-orange-600 transition shrink-0"
            >
              <PlusIcon className="h-4 w-3 text-white" />
              <span className="text-white text-sm font-bold">Add New Employee</span>
            </button>
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
        <div className="w-full overflow-x-auto">
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
                <div className="relative w-10 h-10 shrink-0">
                  <div className="h-full w-full overflow-hidden rounded-full border border-orange-500/20 bg-orange-500/10">
                    <img
                      src={employeeAvatarUrls[emp.auth_id] || 'https://placehold.co/40x40'}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {onlineAuthIdSet.has(emp.auth_id) && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-800 bg-emerald-500"
                      title="Online"
                    />
                  )}
                </div>
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
                    onClick={() => setDeletingEmployee(emp)}
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
              onClick={() => !deleteLoading && setDeletingEmployee(null)}
              disabled={deleteLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-slate-600 p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Delete Employee</h2>
            <p className="mt-1 text-sm text-slate-400">
              Delete <span className="font-semibold text-white">{deletingEmployee.employee_name}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => !deleteLoading && setDeletingEmployee(null)}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
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
              className="absolute right-4 top-4 rounded-full border border-slate-600 p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Edit Employee</h2>
            <p className="mt-1 text-sm text-slate-400">Update employee details.</p>
            <form onSubmit={handleEditSubmit} className="mt-4 flex flex-col gap-4">
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
                ) : isAdmin || editingEmployee?.auth_id === currentUserAuthId ? (
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
                <input
                  id="edit-department"
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  required
                  placeholder="e.g. Design, Engineering"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => !editLoading && setEditingEmployee(null)}
                  className="flex-1 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
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
              className="absolute right-4 top-4 rounded-full border border-slate-600 p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Add New Employee</h2>
            <p className="mt-1 text-sm text-slate-400">Create a user or admin. Super Admin is set separately (one only).</p>
            <form onSubmit={handleAddSubmit} className="mt-4 flex flex-col gap-4">
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
                <input
                  id="add-department"
                  type="text"
                  value={addDepartment}
                  onChange={(e) => setAddDepartment(e.target.value)}
                  required
                  placeholder="e.g. Design, Engineering"
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
              {addError && (
                <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{addError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => !addLoading && setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {addLoading ? 'Signing up…' : 'Sign Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
