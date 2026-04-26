import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js'
import type { RiskMapCell, RiskMapCenter } from './risk-map-types'

export const GANGNAM_TEHERAN_CENTER: RiskMapCenter = {
  lat: 37.50392,
  lng: 127.04475,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distanceMeters(a: RiskMapCenter, b: RiskMapCenter) {
  const earthRadius = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

export function createMockRiskCells(
  center: RiskMapCenter = GANGNAM_TEHERAN_CENTER,
  resolution = 10,
  ring = 7
): RiskMapCell[] {
  const centerCell = latLngToCell(center.lat, center.lng, resolution)
  const cells = gridDisk(centerCell, ring)

  return cells
    .map((h3Id) => {
      const [lat, lng] = cellToLatLng(h3Id)
      const distance = distanceMeters(center, { lat, lng })
      const radial = 1 - clamp(distance / 560, 0, 1)
      const eastBias = 1 - clamp(distanceMeters({ lat: center.lat + 0.0008, lng: center.lng + 0.001 }, { lat, lng }) / 470, 0, 1)
      const southBias = 1 - clamp(distanceMeters({ lat: center.lat - 0.0012, lng: center.lng - 0.0004 }, { lat, lng }) / 430, 0, 1)
      const score = Math.round(clamp(24 + radial * 58 + eastBias * 15 + southBias * 10, 18, 96))
      return { h3Id, score }
    })
    .filter((cell) => cell.score >= 22)
}

export const gangnamTeheranMockRiskCells = createMockRiskCells()
