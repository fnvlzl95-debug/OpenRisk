'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap
        LatLng: new (lat: number, lng: number) => unknown
        Marker: new (options: { position: unknown; map: KakaoMap }) => unknown
        Circle: new (options: {
          center: unknown
          radius: number
          strokeWeight: number
          strokeColor: string
          strokeOpacity: number
          strokeStyle: string
          fillColor: string
          fillOpacity: number
          map: KakaoMap
        }) => unknown
        Polygon: new (options: {
          path: unknown[]
          strokeWeight: number
          strokeColor: string
          strokeOpacity: number
          strokeStyle: string
          fillColor: string
          fillOpacity: number
          map: KakaoMap
        }) => unknown
        CustomOverlay: new (options: {
          position: unknown
          content: string
          yAnchor: number
          map: KakaoMap
        }) => unknown
      }
    }
  }
}

interface KakaoMap {
  setCenter: (latlng: unknown) => void
  setLevel: (level: number) => void
}

interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

interface AreaMapProps {
  center: { lat: number; lng: number }
  areaName: string
  grade: 'A' | 'B' | 'C' | 'D'
  polygon?: GeoJSONPolygon | null
  className?: string
}

const GRADE_COLORS = {
  A: '#10b981',
  B: '#f59e0b',
  C: '#ef4444',
  D: '#8b5cf6'
}

export default function AreaMap({ center, areaName, grade, polygon, className = '' }: AreaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 카카오맵 스크립트가 이미 로드되었는지 확인
    if (window.kakao && window.kakao.maps) {
      initializeMap()
      return
    }

    // 스크립트 로드
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`
    script.async = true

    script.onload = () => {
      window.kakao.maps.load(() => {
        initializeMap()
      })
    }

    script.onerror = () => {
      setError('지도를 불러올 수 없습니다')
    }

    document.head.appendChild(script)

    return () => {
      // cleanup if needed
    }
  }, [center.lat, center.lng, polygon])

  function initializeMap() {
    if (!mapRef.current) return

    try {
      const { kakao } = window
      const position = new kakao.maps.LatLng(center.lat, center.lng)

      const map = new kakao.maps.Map(mapRef.current, {
        center: position,
        level: 4 // 줌 레벨 (1~14, 작을수록 확대)
      })

      // 마커 추가
      new kakao.maps.Marker({
        position: position,
        map: map
      })

      // 상권 영역 표시 (폴리곤 또는 원형 폴백)
      const gradeColor = GRADE_COLORS[grade]

      if (polygon && polygon.coordinates && polygon.coordinates.length > 0) {
        // GeoJSON 폴리곤 그리기
        const path = polygon.coordinates[0].map(coord => {
          // GeoJSON은 [lng, lat] 순서
          return new kakao.maps.LatLng(coord[1], coord[0])
        })

        new kakao.maps.Polygon({
          path: path,
          strokeWeight: 2,
          strokeColor: gradeColor,
          strokeOpacity: 0.9,
          strokeStyle: 'solid',
          fillColor: gradeColor,
          fillOpacity: 0.2,
          map: map
        })
      } else {
        // 폴리곤이 없으면 원형으로 폴백
        new kakao.maps.Circle({
          center: position,
          radius: 300, // 반경 300m
          strokeWeight: 2,
          strokeColor: gradeColor,
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: gradeColor,
          fillOpacity: 0.15,
          map: map
        })
      }

      // 상권명 오버레이
      const overlayContent = `
        <div style="
          padding: 8px 12px;
          background: rgba(17, 17, 20, 0.95);
          border: 1px solid ${gradeColor};
          border-radius: 6px;
          color: #f4f4f5;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        ">
          <span style="color: ${gradeColor}; margin-right: 6px;">${grade}</span>
          ${areaName}
        </div>
      `

      new kakao.maps.CustomOverlay({
        position: position,
        content: overlayContent,
        yAnchor: 2.5,
        map: map
      })

      setIsLoaded(true)
    } catch (err) {
      console.error('Map initialization error:', err)
      setError('지도 초기화 실패')
    }
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-caption" style={{ color: 'var(--text-muted)' }}>{error}</p>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-2">
            <svg className="spinner w-5 h-5" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
            </svg>
            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>지도 로딩 중...</span>
          </div>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '200px' }} />
    </div>
  )
}
