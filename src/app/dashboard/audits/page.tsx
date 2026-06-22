import { Suspense } from 'react'
import WebsiteAudits from '@/components/WebsiteAudits'

export default function WebsiteAuditsPage() {
  return (
    <Suspense fallback={null}>
      <WebsiteAudits />
    </Suspense>
  )
}
