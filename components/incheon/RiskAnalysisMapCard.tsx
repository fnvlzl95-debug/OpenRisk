'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cellToBoundary, cellToLatLng } from 'h3-js'
import styles from './RiskAnalysisMapCard.module.css'
import { MAP_TILES, RING_COLOR, riskColor, riskRampGradient } from '@/lib/incheon/map-theme'
import type { RiskMapCell, RiskMapCenter } from '@/lib/incheon/risk-map-types'
import type {
  Circle,
  DivIcon,
  FeatureGroup,
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

const DEFAULT_INCHEON_CENTER: RiskMapCenter = { lat: 37.3897, lng: 126.6454 }
const MAP_FIT_PADDING: [number, number] = [28, 28]
const MAX_RADIUS_FOCUS_ZOOM = 16
function getRiskColor(score: number) {
  return riskColor(score)
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

function distanceMeters(a: RiskMapCenter, b: RiskMapCenter) {
  const earthRadius = 6371000
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function getCellCenter(h3Id: string): RiskMapCenter {
  const [lat, lng] = cellToLatLng(h3Id)
  return { lat, lng }
}

function fitMapToRadius(map: LeafletMap, radiusLayer: Circle) {
  map.fitBounds(radiusLayer.getBounds().pad(0.18), {
    padding: MAP_FIT_PADDING,
    animate: false,
  })
  map.setZoom(Math.min(MAX_RADIUS_FOCUS_ZOOM, map.getZoom() + 1), { animate: false })
}

function getCellStyle(cell: RiskMapCell, distanceFromCenter: number, radius: number) {
  if (cell.status === 'masked') {
    return {
      color: '#496173',
      fillColor: '#102C42',
      fillOpacity: 0.26,
      opacity: 0.34,
      weight: 0.8,
    }
  }
  if (cell.status === 'no_data' || cell.score === null) {
    return {
      color: '#335066',
      fillColor: '#0A2035',
      fillOpacity: 0.2,
      opacity: 0.24,
      weight: 0.75,
    }
  }
  const proximity = Math.max(0, 1 - distanceFromCenter / (radius * 1.2))
  const heat = cell.score / 100
  const edgeColor = cell.score >= 62 ? '#FFC25B' : cell.score >= 38 ? '#73D8C8' : '#4DB9FF'
  return {
    color: edgeColor,
    fillColor: getRiskColor(cell.score),
    fillOpacity: Math.min(0.58, 0.16 + heat * 0.28 + proximity ** 1.35 * 0.12),
    opacity: Math.min(0.68, 0.3 + heat * 0.2 + proximity * 0.14),
    weight: 0.82,
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
      <svg viewBox="0 0 64 82" aria-hidden="true">
        <defs>
          <linearGradient id="incheonRiskPinGradient" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="#FFB35B" />
            <stop offset="46%" stop-color="#FF7A2A" />
            <stop offset="100%" stop-color="#F0521A" />
          </linearGradient>
        </defs>
        <path d="M32 1.5C15.2 1.5 1.6 15.1 1.6 31.9C1.6 55.4 32 79.8 32 79.8C32 79.8 62.4 55.4 62.4 31.9C62.4 15.1 48.8 1.5 32 1.5Z" fill="url(#incheonRiskPinGradient)" stroke="#FFF8EC" stroke-width="3" />
        <circle cx="32" cy="31.6" r="12.4" fill="#FFF9EF" />
        <circle cx="32" cy="31.6" r="5.2" fill="#FF6D24" />
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
      riskCells.map((cell) => {
        const cellCenter = getCellCenter(cell.h3Id)
        return {
          ...cell,
          positions: cellToBoundary(cell.h3Id).map(([lat, lng]) => [lat, lng] as LatLngExpression),
          style: getCellStyle(cell, distanceMeters(center, cellCenter), radius),
        }
      }),
    [center, radius, riskCells]
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

      L.tileLayer(MAP_TILES.base.url, {
        maxZoom: MAP_TILES.base.maxZoom,
        subdomains: MAP_TILES.base.subdomains,
        attribution: MAP_TILES.base.attribution,
      }).addTo(map)

      // 방향감용 옅은 라벨(구·동/주요 도로). 히트맵 아래에 깔려 부드럽게 비친다.
      L.tileLayer(MAP_TILES.labels.url, {
        maxZoom: MAP_TILES.labels.maxZoom,
        subdomains: MAP_TILES.labels.subdomains,
        opacity: MAP_TILES.labels.opacity,
      }).addTo(map)

      L.control.zoom({ position: 'topright' }).addTo(map)
      L.control.scale({ position: 'bottomleft', metric: true, imperial: false, maxWidth: 120 }).addTo(map)
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map)

      const overlayGroup = L.featureGroup().addTo(map)
      overlayGroupRef.current = overlayGroup

      const radiusLayer = L.circle([center.lat, center.lng], {
        radius,
        color: RING_COLOR,
        weight: 2.1,
        opacity: 0.96,
        fillColor: '#0E95FF',
        fillOpacity: 0.055,
        interactive: false,
        className: styles.radiusCircle,
      }).addTo(overlayGroup)
      radiusLayerRef.current = radiusLayer

      const cellLayer = L.layerGroup().addTo(overlayGroup)
      cellLayerRef.current = cellLayer

      cellPolygons.forEach((cell) => {
        const polygon = L.polygon(cell.positions, {
          color: cell.style.color,
          weight: cell.style.weight,
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
        iconSize: [70, 88],
        iconAnchor: [35, 71],
      }) as DivIcon

      const marker = L.marker([center.lat, center.lng], { icon: pinIcon, zIndexOffset: 1000 })
        .bindTooltip(`${locationLabel}<br/>이곳을 중심으로 반경 500m를 분석해요`, {
          direction: 'top',
          offset: [0, -72],
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

      fitMapToRadius(map, radiusLayer)
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
    // locationLabel은 마운트 시 1회만 툴팁에 반영하면 충분(셀/중심/반경 변경 시에만 재초기화)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          weight: cell.style.weight,
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
      fitMapToRadius(map, radiusLayer)
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
      <div className={styles.terrainOverlay} />
      <div className={styles.glassOverlay} />
      <aside className={styles.legend} aria-label="위험도 수준 범례">
        <h3 className={styles.legendTitle}>위험도 수준</h3>
        <div className={styles.legendScale} style={{ background: riskRampGradient() }} />
        <div className={styles.legendLabels}>
          <span>낮음</span>
          <span>높음</span>
        </div>
      </aside>
    </section>
  )
}
