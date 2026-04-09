import { Suspense } from 'react'
import Employees from '@/components/Employees'

export default function EmployeesPage() {
  return (
    <Suspense fallback={null}>
      <Employees />
    </Suspense>
  )
}
