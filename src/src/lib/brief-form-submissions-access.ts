export function normalizeEmployeeRole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export function isSalesDepartment(department: string | null | undefined): boolean {
  return (department || '').trim().toLowerCase().includes('sales')
}

/** Admin, superadmin, and sales employees may view brief form submissions. Clients may not. */
export function canViewBriefFormSubmissions(input: {
  accountType: 'employee' | 'client' | null
  role: string | null | undefined
  department: string | null | undefined
}): boolean {
  if (input.accountType !== 'employee') {
    return false
  }

  const role = normalizeEmployeeRole(input.role)
  if (role === 'superadmin' || role === 'admin') {
    return true
  }

  return isSalesDepartment(input.department)
}
