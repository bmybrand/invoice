import GraphicDesignBriefRouteShell from '@/components/GraphicDesignBriefRouteShell'
import { redirectAuthenticatedBriefFormRequest } from '@/lib/server-brief-form-route'

export default async function PublicGraphicDesignBriefPage() {
  await redirectAuthenticatedBriefFormRequest('/dashboard/brief-forms/graphic-design')
  return <GraphicDesignBriefRouteShell />
}
