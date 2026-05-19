import LogoDesignBriefRouteShell from '@/components/LogoDesignBriefRouteShell'
import { redirectAuthenticatedBriefFormRequest } from '@/lib/server-brief-form-route'

export default async function PublicLogoDesignBriefPage() {
  await redirectAuthenticatedBriefFormRequest('/dashboard/brief-forms/logo-design')
  return <LogoDesignBriefRouteShell />
}
