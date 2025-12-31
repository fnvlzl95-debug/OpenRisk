'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    kakao: {
      maps: {
        load: (callback: () => void) => void
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap
        LatLng: new (lat: number, lng: number) => KakaoLatLng
        LatLngBounds: new () => KakaoLatLngBounds
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

interface KakaoLatLng {
  getLat: () => number
  getLng: () => number
}

interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void
}

interface KakaoMap {
  setCenter: (latlng: unknown) => void
  setLevel: (level: number) => void
  getLevel: () => number
  setBounds: (bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number) => void
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
  searchedLocation?: { lat: number; lng: number } | null  // 사용자가 검색한 실제 위치
  className?: string
}

const GRADE_COLORS = {
  A: '#10b981',
  B: '#f59e0b',
  C: '#ef4444',
  D: '#8b5cf6'
}

export default function AreaMap({ center, areaName, grade, polygon, searchedLocation, className = '' }: AreaMapProps) {
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
  }, [center.lat, center.lng, polygon, searchedLocation])

  function initializeMap() {
    if (!mapRef.current) return

    try {
      const { kakao } = window
      const position = new kakao.maps.LatLng(center.lat, center.lng)

      const map = new kakao.maps.Map(mapRef.current, {
        center: position,
        level: 5 // 줌 레벨 5 = 약 250m 범위
      })

      // 등급 색상 먼저 정의
      const gradeColor = GRADE_COLORS[grade]

      // 상권 중심 마커 (말풍선 스타일 - 위쪽 배치)
      const centerMarkerContent = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <div style="
            padding: 8px 12px;
            background: rgba(17, 17, 20, 0.95);
            border: 1px solid ${gradeColor};
            border-radius: 6px;
            color: #f4f4f5;
            font-size: 12px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          ">
            <span style="color: ${gradeColor}; margin-right: 6px;">${grade}</span>
            ${areaName}
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 8px solid transparent;
            border-right: 8px solid transparent;
            border-top: 10px solid rgba(17, 17, 20, 0.95);
          "></div>
          <div style="
            width: 14px;
            height: 14px;
            background: ${gradeColor};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            margin-top: -3px;
          "></div>
        </div>
      `
      new kakao.maps.CustomOverlay({
        position: position,
        content: centerMarkerContent,
        yAnchor: 1,
        map: map
      })

      // 검색 위치 마커 추가 (상권 밖일 때만, 검색 위치가 있을 때만)
      const hasSearchLocation = searchedLocation && (searchedLocation.lat !== center.lat || searchedLocation.lng !== center.lng)

      if (hasSearchLocation) {
        const searchPosition = new kakao.maps.LatLng(searchedLocation.lat, searchedLocation.lng)

        // 검색 위치 마커 + 라벨 통합 (말풍선 스타일)
        const searchMarkerContent = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              padding: 6px 10px;
              background: #ef4444;
              border-radius: 6px;
              color: white;
              font-size: 11px;
              font-weight: 600;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">
              검색 위치
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #ef4444;
            "></div>
            <div style="
              width: 10px;
              height: 10px;
              background: #ef4444;
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              margin-top: -2px;
            "></div>
          </div>
        `
        new kakao.maps.CustomOverlay({
          position: searchPosition,
          content: searchMarkerContent,
          yAnchor: 1,
          map: map
        })

        // 지도 범위를 검색 위치와 상권 중심이 모두 보이도록 조정
        const bounds = new kakao.maps.LatLngBounds()
        bounds.extend(position)
        bounds.extend(searchPosition)
        map.setBounds(bounds, 80, 80, 80, 80)  // 상하좌우 80px 패딩

        // setBounds 후 최소 줌 레벨 보장 (너무 가까우면 조정)
        if (map.getLevel() < 5) {
          map.setLevel(5)
        }
      }

      // 상권 영역 표시 (폴리곤 또는 원형 폴백)
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
