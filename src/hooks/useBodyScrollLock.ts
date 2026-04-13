'use client'

import { useEffect } from 'react'

let bodyScrollLockCount = 0

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    bodyScrollLockCount += 1
    document.body.classList.add('overflow-hidden')

    return () => {
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
      if (bodyScrollLockCount === 0) {
        document.body.classList.remove('overflow-hidden')
      }
    }
  }, [locked])
}
