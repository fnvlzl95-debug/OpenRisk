'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function VisitorTracker() {
  const pathname = usePathname()

  useEffect(() => {
    // 관리자 페이지 및 API 경로는 추적하지 않음
    const excludedPaths = ['/ops-9f2', '/api']
    const shouldTrack = !excludedPaths.some(path => pathname.startsWith(path))

    if (!shouldTrack) {
      return
    }

    // 페이지 로드 시 방문자 추적
    async function trackVisit() {
      try {
        await fetch('/api/stats/visitor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_path: pathname })
        })
      } catch (error) {
        // 조용히 실패 (사용자 경험에 영향 없음)
        console.debug('Visitor tracking failed:', error)
      }
    }

    trackVisit()
  }, [pathname])

  return null // UI 없는 추적 컴포넌트
}
