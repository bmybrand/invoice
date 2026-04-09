import { Suspense } from 'react'
import Brand from '@/components/Brand'

export default function BrandsPage() {
  return (
    <Suspense fallback={null}>
      <Brand />
    </Suspense>
  )
}
