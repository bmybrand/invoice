import { Suspense } from 'react'
import StrategyCallCalendar from '@/components/StrategyCallCalendar'

export default function StrategyCallsPage() {
  return (
    <Suspense fallback={null}>
      <StrategyCallCalendar />
    </Suspense>
  )
}
