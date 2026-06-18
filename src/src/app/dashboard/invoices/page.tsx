import { Suspense } from 'react'
import Invoice from '@/components/Invoice'

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <Invoice />
    </Suspense>
  )
}
