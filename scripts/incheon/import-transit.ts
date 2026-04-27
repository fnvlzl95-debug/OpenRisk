import path from 'path'
import { latLngToCell } from 'h3-js'
import { INCHEON_H3_RESOLUTION } from '../../lib/incheon/constants'
import { PROCESSED_DIR, RAW_DIR, distributionStats, ensureDir, listFilesRecursive, pickField, readTableRecords, report, toNumber, writeJson } from './_utils'

const rawTransitDir = path.join(RAW_DIR, 'transit')
const outputFile = path.join(PROCESSED_DIR, 'h3-transit', 'transit-h3.json')

type BusStop = {
  id: string
  name: string
  lat: number
  lng: number
}

type Ridership = {
  id: string
  name: string
  value: number
}

type TransitCell = {
  busStopCount: number
  busRidership: number
  subwayRidership: number
  accessScore: number
}

function normalizedId(value: string) {
  return value.replace(/\s+/g, '').replace(/^0+/, '')
}

function isIncheonRecord(record: Record<string, string>) {
  const sido = pickField(record, ['시도명', '시도', '지역', '관할관청', '주소'])
  return !sido || sido.includes('인천')
}

function readLatLng(record: Record<string, string>) {
  const lat = toNumber(pickField(record, ['위도', 'lat', 'latitude', 'Y좌표', 'y']))
  const lng = toNumber(pickField(record, ['경도', 'lng', 'lon', 'longitude', 'X좌표', 'x']))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat > 90 && lng < 90) return { lat: lng, lng: lat }
  if (lat < 30 || lng < 120) return null
  return { lat, lng }
}

function readBusStop(record: Record<string, string>): BusStop | null {
  const point = readLatLng(record)
  if (!point || !isIncheonRecord(record)) return null
  const id = normalizedId(pickField(record, ['정류소아이디', '정류소ID', '정류장아이디', '정류장ID', 'node_id', 'NODE_ID', '정류소번호', '정류장번호']))
  const name = pickField(record, ['정류소명', '정류장명', 'node_nm', 'NODE_NM', '명칭'])
  if (!id && !name) return null
  return { id, name, ...point }
}

function readRidership(record: Record<string, string>): Ridership | null {
  const id = normalizedId(pickField(record, ['정류소아이디', '정류소ID', '정류장아이디', '정류장ID', '정류소번호', '정류장번호']))
  const name = pickField(record, ['정류소명', '정류장명'])
  const value =
    toNumber(pickField(record, ['총승하차건수', '총승차건수', '승차인원수', '일평균승하차건수', '일평균 승하차 인원수', '일평균승차건수'])) +
    toNumber(pickField(record, ['총하차건수', '하차인원수', '일평균하차건수']))
  if ((!id && !name) || value <= 0) return null
  return { id, name, value }
}

function readSubway(record: Record<string, string>) {
  const point = readLatLng(record)
  if (!point) return null
  const value =
    toNumber(pickField(record, ['승하차총계', '합계', '수송인원', '승차총승객수', '승차인원'])) +
    toNumber(pickField(record, ['하차총승객수', '하차인원']))
  if (value <= 0) return null
  return { ...point, value }
}

async function main() {
  const files = listFilesRecursive(rawTransitDir).filter((file) => /\.(csv|xlsx)$/i.test(file))
  if (files.length === 0) {
    report('transit-import-report.json', {
      status: 'needs-source-file',
      expectedDir: rawTransitDir,
      outputFile,
      method: '버스 정류장 좌표 + 정류장 승하차 + 지하철 역별 수송인원 거리 기반 H3 집계',
    })
    console.log('교통 원천 파일이 아직 없습니다.')
    return
  }

  const stops: BusStop[] = []
  const ridership: Ridership[] = []
  const subway = []
  const fileStats = []

  for (const file of files) {
    const records = await readTableRecords(file)
    let stopCount = 0
    let ridershipCount = 0
    let subwayCount = 0

    for (const record of records) {
      const stop = readBusStop(record)
      if (stop) {
        stops.push(stop)
        stopCount += 1
      }
      const ride = readRidership(record)
      if (ride) {
        ridership.push(ride)
        ridershipCount += 1
      }
      const station = readSubway(record)
      if (station) {
        subway.push(station)
        subwayCount += 1
      }
    }

    fileStats.push({ file, rows: records.length, stopCount, ridershipCount, subwayCount })
  }

  const ridesById = new Map(ridership.filter((item) => item.id).map((item) => [item.id, item.value]))
  const ridesByName = new Map(ridership.filter((item) => item.name).map((item) => [item.name, item.value]))
  const cells: Record<string, TransitCell> = {}

  for (const stop of stops) {
    const h3Id = latLngToCell(stop.lat, stop.lng, INCHEON_H3_RESOLUTION)
    cells[h3Id] ??= { busStopCount: 0, busRidership: 0, subwayRidership: 0, accessScore: 0 }
    const rideValue = (stop.id && ridesById.get(stop.id)) || (stop.name && ridesByName.get(stop.name)) || 0
    cells[h3Id].busStopCount += 1
    cells[h3Id].busRidership += rideValue
  }

  for (const station of subway) {
    const h3Id = latLngToCell(station.lat, station.lng, INCHEON_H3_RESOLUTION)
    cells[h3Id] ??= { busStopCount: 0, busRidership: 0, subwayRidership: 0, accessScore: 0 }
    cells[h3Id].subwayRidership += station.value
  }

  for (const cell of Object.values(cells)) {
    cell.accessScore =
      cell.busStopCount * 12 +
      Math.log1p(cell.busRidership) * 10 +
      Math.log1p(cell.subwayRidership) * 14
  }

  ensureDir(path.dirname(outputFile))
  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    h3Resolution: INCHEON_H3_RESOLUTION,
    sourceIds: ['incheon-bus-stops', 'incheon-bus-ridership', 'incheon-subway-ridership'],
    dataPeriod: 'official-file',
    cells,
    accessStats: distributionStats(Object.values(cells).map((cell) => cell.accessScore)),
  })

  report('transit-import-report.json', {
    status: Object.keys(cells).length > 0 ? 'ready' : 'needs-joinable-source-file',
    inputFiles: files,
    outputFile,
    cells: Object.keys(cells).length,
    stops: stops.length,
    ridership: ridership.length,
    subway: subway.length,
    fileStats,
  })

  console.log(`교통 H3 셀 ${Object.keys(cells).length}개 생성`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
