import SmmBriefRouteShell from '@/components/SmmBriefRouteShell'
import { redirectAuthenticatedBriefFormRequest } from '@/lib/server-brief-form-route'

export default async function PublicSmmBriefPage() {
  await redirectAuthenticatedBriefFormRequest('/dashboard/brief-forms/smm')
  return <SmmBriefRouteShell />
}
