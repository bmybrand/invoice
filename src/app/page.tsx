import { Suspense } from 'react'
import { LoginForm } from '@/components/LoginForm'
export default function Home() {
  return (
    <main>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
