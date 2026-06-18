import SeoQuestionnaireRouteShell from '@/components/SeoQuestionnaireRouteShell'
import { redirectAuthenticatedBriefFormRequest } from '@/lib/server-brief-form-route'

export default async function PublicSeoQuestionnairePage() {
  await redirectAuthenticatedBriefFormRequest('/dashboard/brief-forms/seo-questionnaire')
  return <SeoQuestionnaireRouteShell />
}
