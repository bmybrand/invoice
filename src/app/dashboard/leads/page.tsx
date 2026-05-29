import { Suspense } from 'react'
import Leads from '@/components/Leads'

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <Leads />
    </Suspense>
  )
}
