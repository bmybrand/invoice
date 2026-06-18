import { Suspense } from 'react'
import Payments from '@/components/Payments'

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <Payments />
    </Suspense>
  )
}
