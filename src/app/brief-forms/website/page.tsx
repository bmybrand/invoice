import WebsiteBriefRouteShell from '@/components/WebsiteBriefRouteShell'
import { redirectAuthenticatedBriefFormRequest } from '@/lib/server-brief-form-route'

export default async function PublicWebsiteBriefPage() {
  await redirectAuthenticatedBriefFormRequest('/dashboard/brief-forms/website')
  return <WebsiteBriefRouteShell />
}
