'use client'

import { useEffect } from 'react'

let bodyScrollLockCount = 0
let dashboardScrollLockCount = 0
let dashboardPreviousOverflow = ''

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return

    bodyScrollLockCount += 1
    document.body.classList.add('overflow-hidden')
    const dashboardScroller = document.getElementById('dashboard-main-content')
    if (dashboardScroller) {
      if (dashboardScrollLockCount === 0) {
        dashboardPreviousOverflow = dashboardScroller.style.overflow
      }
      dashboardScrollLockCount += 1
      dashboardScroller.style.overflow = 'hidden'
    }

    return () => {
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1)
      if (bodyScrollLockCount === 0) {
        document.body.classList.remove('overflow-hidden')
      }
      if (dashboardScroller) {
        dashboardScrollLockCount = Math.max(0, dashboardScrollLockCount - 1)
        if (dashboardScrollLockCount === 0) {
          dashboardScroller.style.overflow = dashboardPreviousOverflow
          dashboardPreviousOverflow = ''
        }
      }
    }
  }, [locked])
}
