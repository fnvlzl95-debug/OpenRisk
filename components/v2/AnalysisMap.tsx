'use client'

import { useEffect, useRef, useState } from 'react'
import { RiskLevel } from '@/lib/v2/types'

interface AnalysisMapProps {
  center: { lat: number; lng: number }
  locationName: string
  riskLevel: RiskLevel
  riskScore: number
  className?: string
}

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  VERY_HIGH: '#f43f5e',
}

export default function AnalysisMap({ center, locationName, riskLevel, riskScore, className = '' }: AnalysisMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    let loaded = false

    // 카카오맵이 로드될 때까지 대기 (layout.tsx에서 전역 로드)
    const checkKakao = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        clearInterval(checkKakao)
        if (isCancelled) return
        console.log('[AnalysisMap] Kakao maps ready, initializing...')
        window.kakao.maps.load(() => {
          if (!isCancelled) {
            initMap()
          }
        })
      }
    }, 100)

    // 10초 후 타임아웃
    const timeout = setTimeout(() => {
      clearInterval(checkKakao)
      if (isCancelled || loaded) {
        return
      }
      console.error('[AnalysisMap] Kakao maps load timeout')
      setError('지도 로딩 타임아웃 - 카카오 개발자 콘솔에서 localhost:8081 도메인 등록 필요')
    }, 10000)

    // 카카오맵이 로드될 때까지 대기 (layout.tsx에서 전역 로드)
    function initMap() {
      clearTimeout(timeout)
      if (!mapRef.current) return

      try {
        const { kakao } = window
        const position = new kakao.maps.LatLng(center.lat, center.lng)
        const color = RISK_COLORS[riskLevel]

        const map = new kakao.maps.Map(mapRef.current, {
          center: position,
          level: 5
        })

        // 분석 중심점 마커
        const markerContent = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              padding: 6px 10px;
              background: rgba(17, 17, 20, 0.95);
              border: 1px solid ${color};
              border-radius: 6px;
              color: #f4f4f5;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
              <span style="color: ${color}; margin-right: 4px;">${riskScore}</span>
              ${locationName}
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid rgba(17, 17, 20, 0.95);
            "></div>
            <div style="
              width: 12px;
              height: 12px;
              background: ${color};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.4);
              margin-top: -2px;
            "></div>
          </div>
        `

        new kakao.maps.CustomOverlay({
          position: position,
          content: markerContent,
          yAnchor: 1,
          map: map
        })

        // 500m 분석 반경 표시
        new kakao.maps.Circle({
          center: position,
          radius: 500,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: color,
          fillOpacity: 0.15,
          map: map
        })

        loaded = true
        setIsLoaded(true)
      } catch (err) {
        console.error('Map initialization error:', err)
        setError('지도 초기화 실패')
      }
    }

    return () => {
      isCancelled = true
      clearInterval(checkKakao)
      clearTimeout(timeout)
    }
  }, [center.lat, center.lng, locationName, riskLevel, riskScore])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-[#111] ${className}`}>
        <p className="text-xs text-white/40">{error}</p>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs text-white/40">지도 로딩 중...</span>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '200px' }} />
      {isLoaded && (
        <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-[9px] text-white/60 font-mono">
          500m 반경 분석
        </div>
      )}
    </div>
  )
}
