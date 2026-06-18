import { Suspense } from 'react'
import Clients from '@/components/Clients'

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <Clients />
    </Suspense>
  )
}
