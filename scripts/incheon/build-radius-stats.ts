import path from 'path'
import { cellToLatLng, gridDisk } from 'h3-js'
import { CATEGORY_LIST, type BusinessCategory } from '../../lib/categories'
import { INCHEON_H3_RESOLUTION, INCHEON_RADIUS_METERS } from '../../lib/incheon/constants'
import type {
  EducationFamilyH3Dataset,
  RadiusStatsDataset,
  StoreH3Dataset,
  TransitH3Dataset,
} from '../../lib/incheon/dataset-types'
import { PROCESSED_DIR, distributionStats, readJson, report, writeJson } from './_utils'

const inputFiles = {
  stores: path.join(PROCESSED_DIR, 'h3-store-counts', 'store-counts-h3.json'),
  transit: path.join(PROCESSED_DIR, 'h3-transit', 'transit-h3.json'),
  educationFamily: path.join(PROCESSED_DIR, 'h3-education-family', 'education-family-h3.json'),
}

const outputFile = path.join(PROCESSED_DIR, 'radius-stats', 'radius-stats-500m.json')
const categories = CATEGORY_LIST.map((item) => item.key)

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

function main() {
  const stores = readJson<StoreH3Dataset>(inputFiles.stores)
  const transit = readJson<TransitH3Dataset>(inputFiles.transit)
  const educationFamily = readJson<EducationFamilyH3Dataset>(inputFiles.educationFamily)
  const centerCellIds = unique([
    ...Object.keys(stores.cells),
    ...Object.keys(transit.cells),
    ...Object.keys(educationFamily.cells),
  ])

  const latLngCache = new Map<string, { lat: number; lng: number }>()
  const getCenter = (h3Id: string) => {
    const cached = latLngCache.get(h3Id)
    if (cached) return cached
    const [lat, lng] = cellToLatLng(h3Id)
    const value = { lat, lng }
    latLngCache.set(h3Id, value)
    return value
  }

  const categoryValues: Partial<Record<BusinessCategory, number[]>> = Object.fromEntries(
    categories.map((category) => [category, []])
  )
  const totalStoreValues: number[] = []
  const transitAccessValues: number[] = []
  const educationValues: number[] = []
  const anchorValues: number[] = []

  centerCellIds.forEach((centerId, index) => {
    if (index > 0 && index % 1500 === 0) {
      console.log(`반경 통계 계산 중: ${index.toLocaleString('ko-KR')} / ${centerCellIds.length.toLocaleString('ko-KR')}`)
    }

    const center = getCenter(centerId)
    const categoryTotals: Partial<Record<BusinessCategory, number>> = {}
    let totalStores = 0
    let transitAccess = 0
    let educationScore = 0
    let anchorScore = 0

    for (const h3Id of gridDisk(centerId, 9)) {
      const point = getCenter(h3Id)
      const distance = distanceMeters(center, point)
      if (distance > INCHEON_RADIUS_METERS + 120) continue

      const weight = Math.exp(-0.5 * (distance / 360) ** 2)
      const storeCell = stores.cells[h3Id]
      if (storeCell) {
        totalStores += storeCell.totalStores * weight
        for (const [category, count] of Object.entries(storeCell.categoryCounts)) {
          const key = category as BusinessCategory
          categoryTotals[key] = (categoryTotals[key] ?? 0) + (count ?? 0) * weight
        }
      }

      const transitCell = transit.cells[h3Id]
      if (transitCell) {
        transitAccess += transitCell.accessScore * weight
        anchorScore += transitCell.busStopCount * weight
      }

      const educationCell = educationFamily.cells[h3Id]
      if (educationCell) {
        educationScore += educationCell.educationScore * weight
        anchorScore += educationCell.anchorCount * weight
      }
    }

    totalStoreValues.push(totalStores)
    transitAccessValues.push(transitAccess)
    educationValues.push(educationScore)
    anchorValues.push(anchorScore)

    for (const category of categories) {
      categoryValues[category]?.push(categoryTotals[category] ?? 0)
    }
  })

  const output: RadiusStatsDataset = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    h3Resolution: INCHEON_H3_RESOLUTION,
    radiusMeters: INCHEON_RADIUS_METERS,
    method: 'distance_decay_radius',
    centerCellCount: centerCellIds.length,
    sourceIds: unique([...stores.sourceIds, ...transit.sourceIds, ...educationFamily.sourceIds]),
    dataPeriod: 'official-file',
    storeCategoryStats: Object.fromEntries(
      categories.map((category) => [category, distributionStats(categoryValues[category] ?? [])])
    ),
    totalStoreStats: distributionStats(totalStoreValues),
    transitAccessStats: distributionStats(transitAccessValues),
    educationStats: distributionStats(educationValues),
    anchorStats: distributionStats(anchorValues),
  }

  writeJson(outputFile, output)
  report('radius-stats-report.json', {
    status: 'ready',
    outputFile,
    centerCellCount: centerCellIds.length,
    radiusMeters: INCHEON_RADIUS_METERS,
    h3Resolution: INCHEON_H3_RESOLUTION,
  })
  console.log(`반경 500m 분포 통계 생성: ${outputFile}`)
}

main()
