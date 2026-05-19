import VideoAnimationBriefRouteShell from '@/components/VideoAnimationBriefRouteShell'
import { redirectAuthenticatedBriefFormRequest } from '@/lib/server-brief-form-route'

export default async function PublicVideoAnimationBriefPage() {
  await redirectAuthenticatedBriefFormRequest('/dashboard/brief-forms/video-animation')
  return <VideoAnimationBriefRouteShell />
}
