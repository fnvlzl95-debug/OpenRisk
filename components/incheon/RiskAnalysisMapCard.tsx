'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cellToBoundary } from 'h3-js'
import styles from './RiskAnalysisMapCard.module.css'
import type { RiskMapCell, RiskMapCenter } from '@/lib/incheon/risk-map-types'
import type {
  Circle,
  DivIcon,
  FeatureGroup,
  LatLngBoundsExpression,
  LatLngExpression,
  LayerGroup,
  Map as LeafletMap,
  Marker,
  Polygon,
} from 'leaflet'

type RiskAnalysisMapCardProps = {
  center?: RiskMapCenter
  radius?: number
  riskCells?: RiskMapCell[]
  locationLabel?: string
  className?: string
}

const LEGEND_COLORS = ['#2D8CFF', '#20C7E8', '#47D78D', '#F6D84A', '#FDBA3B', '#FF9E2C', '#FF6B1D', '#FF4B4B']
const DEFAULT_INCHEON_CENTER: RiskMapCenter = { lat: 37.3897, lng: 126.6454 }
const RADIUS_BOUNDS_SCALE = 1.16
const MAP_FIT_PADDING: [number, number] = [28, 28]

function getRiskColor(score: number) {
  if (score >= 86) return '#FF4B4B'
  if (score >= 74) return '#FF6B1D'
  if (score >= 62) return '#FF9E2C'
  if (score >= 50) return '#F6D84A'
  if (score >= 38) return '#47D78D'
  if (score >= 26) return '#20C7E8'
  return '#2D8CFF'
}

function destinationPoint(center: RiskMapCenter, distanceMeters: number, bearingDegrees: number): [number, number] {
  const earthRadius = 6371000
  const bearing = (bearingDegrees * Math.PI) / 180
  const lat1 = (center.lat * Math.PI) / 180
  const lng1 = (center.lng * Math.PI) / 180
  const angularDistance = distanceMeters / earthRadius

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    )

  return [(lat2 * 180) / Math.PI, (lng2 * 180) / Math.PI]
}

function getRadiusBounds(center: RiskMapCenter, radius: number): LatLngBoundsExpression {
  return [
    destinationPoint(center, radius * RADIUS_BOUNDS_SCALE, 225),
    destinationPoint(center, radius * RADIUS_BOUNDS_SCALE, 45),
  ]
}

function getCellStyle(cell: RiskMapCell) {
  if (cell.status === 'masked') {
    return {
      color: '#8CA3B7',
      fillColor: '#D8E5EE',
      fillOpacity: 0.18,
      opacity: 0.2,
    }
  }
  if (cell.status === 'no_data' || cell.score === null) {
    return {
      color: '#7A93A8',
      fillColor: '#BFD0DD',
      fillOpacity: 0.1,
      opacity: 0.15,
    }
  }
  return {
    color: '#87E8FF',
    fillColor: getRiskColor(cell.score),
    fillOpacity: Math.min(0.6, 0.14 + (cell.score / 100) * 0.46),
    opacity: 0.28,
  }
}

function getCellTooltip(cell: RiskMapCell) {
  if (cell.status === 'masked') return cell.reason ?? '상권 분석 제외 구역'
  if (cell.status === 'no_data' || cell.score === null) return cell.reason ?? '수집된 상권 데이터가 부족한 구역'
  return `위험도 점수 ${cell.score}`
}

function createPinElement() {
  const element = document.createElement('div')
  element.className = styles.pinMarker
  element.innerHTML = `
    <span class="${styles.pinHalo}"></span>
    <span class="${styles.pinBody}">
      <svg viewBox="0 0 78 96" aria-hidden="true">
        <defs>
          <linearGradient id="pinGradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="#FFF7E3" />
            <stop offset="42%" stop-color="#FFB14A" />
            <stop offset="100%" stop-color="#FF5B1D" />
          </linearGradient>
        </defs>
        <path d="M39 1C18.1 1 1.2 18 1.2 38.9C1.2 68.3 39 94.8 39 94.8C39 94.8 76.8 68.3 76.8 38.9C76.8 18 59.9 1 39 1Z" fill="url(#pinGradient)" />
        <circle cx="39" cy="38.5" r="15.5" fill="#FFF9EE" />
        <circle cx="39" cy="38.5" r="7" fill="#E9551B" />
      </svg>
    </span>
    <span class="${styles.pinPulse}"></span>
  `
  return element
}

export default function RiskAnalysisMapCard({
  center = DEFAULT_INCHEON_CENTER,
  radius = 500,
  riskCells = [],
  locationLabel = '분석 기준점',
  className,
}: RiskAnalysisMapCardProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const cellLayerRef = useRef<LayerGroup | null>(null)
  const radiusLayerRef = useRef<Circle | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const radiusBadgeRef = useRef<Marker | null>(null)
  const overlayGroupRef = useRef<FeatureGroup | null>(null)

  const cellPolygons = useMemo(
    () =>
      riskCells.map((cell) => ({
        ...cell,
        positions: cellToBoundary(cell.h3Id).map(([lat, lng]) => [lat, lng] as LatLngExpression),
        style: getCellStyle(cell),
      })),
    [riskCells]
  )

  useEffect(() => {
    if (!mapContainerRef.current) return

    let cancelled = false
    const container = mapContainerRef.current

    async function initMap() {
      const L = await import('leaflet')
      if (cancelled) return

      const map = L.map(container, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      })

      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
      }).addTo(map)

      L.control.zoom({ position: 'topright' }).addTo(map)
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)

      const overlayGroup = L.featureGroup().addTo(map)
      overlayGroupRef.current = overlayGroup

      const radiusLayer = L.circle([center.lat, center.lng], {
        radius,
        color: '#7AE4FF',
        weight: 2.4,
        opacity: 0.96,
        fillColor: '#0B66FF',
        fillOpacity: 0.08,
        interactive: false,
        className: styles.radiusCircle,
      }).addTo(overlayGroup)
      radiusLayerRef.current = radiusLayer

      const cellLayer = L.layerGroup().addTo(overlayGroup)
      cellLayerRef.current = cellLayer

      cellPolygons.forEach((cell) => {
        const polygon = L.polygon(cell.positions, {
          color: cell.style.color,
          weight: 0.8,
          opacity: cell.style.opacity,
          fillColor: cell.style.fillColor,
          fillOpacity: cell.style.fillOpacity,
          className: styles.h3Cell,
        }) as Polygon

        polygon.bindTooltip(getCellTooltip(cell), {
          sticky: true,
          direction: 'top',
          className: styles.leafletTooltip,
        })
        polygon.addTo(cellLayer)
      })
      radiusLayer.bringToFront()

      const pinIcon = L.divIcon({
        html: createPinElement(),
        className: styles.pinIcon,
        iconSize: [78, 96],
        iconAnchor: [39, 76],
      }) as DivIcon

      const marker = L.marker([center.lat, center.lng], { icon: pinIcon, zIndexOffset: 1000 })
        .bindTooltip('분석 기준점<br/>이곳을 중심으로 반경 500m를 분석해요', {
          direction: 'top',
          offset: [0, -78],
          className: styles.leafletTooltip,
        })
        .addTo(map)
      markerRef.current = marker

      const radiusBadgeIcon = L.divIcon({
        html: `<span class="${styles.radiusBadgeMarker}">${radius}m</span>`,
        className: styles.radiusBadgeIcon,
        iconSize: [92, 42],
        iconAnchor: [0, 21],
      }) as DivIcon

      const radiusBadge = L.marker(destinationPoint(center, radius, 45), {
        icon: radiusBadgeIcon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(map)
      radiusBadgeRef.current = radiusBadge

      map.fitBounds(getRadiusBounds(center, radius), { padding: MAP_FIT_PADDING, animate: false })
      requestAnimationFrame(() => {
        if (!cancelled && mapRef.current === map) {
          map.invalidateSize()
        }
      })
    }

    initMap()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      cellLayerRef.current = null
      radiusLayerRef.current = null
      markerRef.current = null
      radiusBadgeRef.current = null
      overlayGroupRef.current = null
    }
  }, [cellPolygons, center, radius])

  useEffect(() => {
    const map = mapRef.current
    const radiusLayer = radiusLayerRef.current
    const marker = markerRef.current
    const radiusBadge = radiusBadgeRef.current
    const cellLayer = cellLayerRef.current
    if (!map || !radiusLayer || !marker || !radiusBadge || !cellLayer) return

    radiusLayer.setLatLng([center.lat, center.lng])
    radiusLayer.setRadius(radius)
    marker.setLatLng([center.lat, center.lng])
    radiusBadge.setLatLng(destinationPoint(center, radius, 45))
    cellLayer.clearLayers()

    let cancelled = false
    let resizeFrame: number | null = null

    import('leaflet').then((L) => {
      if (cancelled || mapRef.current !== map) return
      cellPolygons.forEach((cell) => {
        const polygon = L.polygon(cell.positions, {
          color: cell.style.color,
          weight: 0.8,
          opacity: cell.style.opacity,
          fillColor: cell.style.fillColor,
          fillOpacity: cell.style.fillOpacity,
          className: styles.h3Cell,
        })
        polygon.bindTooltip(getCellTooltip(cell), {
          sticky: true,
          direction: 'top',
          className: styles.leafletTooltip,
        })
        polygon.addTo(cellLayer)
      })
      radiusLayer.bringToFront()
      map.fitBounds(getRadiusBounds(center, radius), { padding: MAP_FIT_PADDING, animate: false })
      resizeFrame = requestAnimationFrame(() => {
        if (!cancelled && mapRef.current === map) {
          map.invalidateSize()
        }
      })
    })

    return () => {
      cancelled = true
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame)
      }
    }
  }, [cellPolygons, center, radius])

  return (
    <section className={`${styles.card} ${className ?? ''}`} aria-label="상권 위험도 분석 지도">
      <div ref={mapContainerRef} className={styles.mapCanvas} />
      <div className={styles.glassOverlay} />
      <div className={styles.locationBadge} aria-label="분석 위치">
        <span className={styles.locationLabel}>분석 위치</span>
        <span className={styles.locationName}>{locationLabel}</span>
      </div>
      <aside className={styles.legend} aria-label="위험도 수준 범례">
        <h3 className={styles.legendTitle}>위험도 수준</h3>
        <div className={styles.legendScale}>
          {LEGEND_COLORS.map((color) => (
            <span key={color} className={styles.legendColor} style={{ backgroundColor: color }} />
          ))}
        </div>
        <div className={styles.legendLabels}>
          <span>위험 낮음</span>
          <span>위험 높음</span>
        </div>
      </aside>
    </section>
  )
}
