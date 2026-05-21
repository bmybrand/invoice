import {
  canViewBriefFormSubmissions,
  normalizeEmployeeRole,
} from '@/lib/brief-form-submissions-access'
import type { EmployeeAuthResult } from '@/lib/server-employee-auth'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

export type BriefFormSubmissionsAuthResult = EmployeeAuthResult

export async function requireBriefFormSubmissionsViewer(
  request: Request
): Promise<BriefFormSubmissionsAuthResult> {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return auth
  }

  const { data: employee, error } = await auth.supabase
    .from('employees')
    .select('role, department')
    .eq('auth_id', auth.user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (error) {
    return { ok: false, status: 500, error: 'Failed to verify employee access' }
  }

  const role = normalizeEmployeeRole((employee as { role?: string | null } | null)?.role)
  const department = (employee as { department?: string | null } | null)?.department ?? ''

  if (
    !canViewBriefFormSubmissions({
      accountType: 'employee',
      role,
      department,
    })
  ) {
    return {
      ok: false,
      status: 403,
      error: 'Only admin and sales staff can view brief form submissions',
    }
  }

  return { ...auth, role }
}
