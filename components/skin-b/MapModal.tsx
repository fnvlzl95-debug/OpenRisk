'use client'

import { useEffect, useRef, useState } from 'react'
import { RiskLevel } from '@/lib/v2/types'
import { X, MapPin } from 'lucide-react'
import type { KakaoMap } from '@/lib/kakao-maps.d'

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  center: { lat: number; lng: number }
  locationName: string
  riskLevel: RiskLevel
  riskScore: number
}

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#f97316',
  VERY_HIGH: '#dc2626',
}

export default function MapModal({
  isOpen,
  onClose,
  center,
  locationName,
  riskLevel,
  riskScore,
}: MapModalProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<KakaoMap | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // 카카오맵이 로드될 때까지 대기
    const checkKakao = setInterval(() => {
      if (window.kakao && window.kakao.maps) {
        clearInterval(checkKakao)
        window.kakao.maps.load(() => {
          initMap()
        })
      }
    }, 100)

    // 5초 후 타임아웃
    const timeout = setTimeout(() => {
      clearInterval(checkKakao)
      if (!isLoaded) {
        setError('지도 로딩 실패')
      }
    }, 5000)

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
        mapInstanceRef.current = map

        // 마커 (신문 스타일)
        const markerContent = `
          <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              padding: 8px 12px;
              background: white;
              border: 2px solid black;
              color: black;
              font-size: 12px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 3px 3px 0 rgba(0,0,0,0.2);
            ">
              <span style="color: ${color}; margin-right: 6px; font-size: 14px;">${riskScore}</span>
              ${locationName}
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 10px solid black;
            "></div>
            <div style="
              width: 14px;
              height: 14px;
              background: ${color};
              border: 3px solid black;
              border-radius: 50%;
              margin-top: -3px;
            "></div>
          </div>
        `

        new kakao.maps.CustomOverlay({
          position: position,
          content: markerContent,
          yAnchor: 1,
          map: map
        })

        // 500m 분석 반경
        new kakao.maps.Circle({
          center: position,
          radius: 500,
          strokeWeight: 2,
          strokeColor: '#000000',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
          fillColor: color,
          fillOpacity: 0.15,
          map: map
        })

        setIsLoaded(true)

        // 모달이 열린 후 지도 레이아웃 갱신
        setTimeout(() => {
          map.relayout()
          map.setCenter(position)
        }, 100)
      } catch (err) {
        console.error('Map initialization error:', err)
        setError('지도 초기화 실패')
      }
    }

    return () => {
      clearInterval(checkKakao)
      clearTimeout(timeout)
    }
  }, [isOpen, center.lat, center.lng, locationName, riskLevel, riskScore, isLoaded])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] sm:mx-4 bg-white border-t-2 sm:border-2 border-black shadow-xl overflow-hidden flex flex-col rounded-t-xl sm:rounded-none">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-gray-50">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-gray-600" />
            <div>
              <h2 className="text-sm sm:text-base font-bold">분석 반경 확인</h2>
              <p className="text-[10px] text-gray-500">500m 반경 데이터 분석 영역</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Map Content */}
        <div className="flex-1 relative" style={{ minHeight: '350px' }}>
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
                <span className="text-sm text-gray-600">지도 로딩 중...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" style={{ minHeight: '350px' }} />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 font-mono">
              중심점: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-black text-white text-xs font-medium hover:bg-gray-800 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
