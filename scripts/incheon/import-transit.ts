import fs from 'fs'
import path from 'path'
import { latLngToCell } from 'h3-js'
import { INCHEON_H3_RESOLUTION } from '../../lib/incheon/constants'
import { PROCESSED_DIR, RAW_DIR, WORKSPACE, distributionStats, ensureDir, listFilesRecursive, normalizeStationName, pickField, readIncheonPoint, readTableRecords, report, toNumber, writeJson } from './_utils'

const rawTransitDir = path.join(RAW_DIR, 'transit')
const outputFile = path.join(PROCESSED_DIR, 'h3-transit', 'transit-h3.json')
const subwayMasterFile = path.join(WORKSPACE, 'reference', 'incheon-subway-stations.json')

type SubwayStationMaster = {
  stations: Array<{ normalizedName: string; name: string; lat: number; lng: number }>
}

function loadSubwayMaster(): Map<string, { lat: number; lng: number }> {
  const map = new Map<string, { lat: number; lng: number }>()
  if (!fs.existsSync(subwayMasterFile)) return map
  const master = JSON.parse(fs.readFileSync(subwayMasterFile, 'utf8')) as SubwayStationMaster
  for (const station of master.stations ?? []) {
    map.set(station.normalizedName, { lat: station.lat, lng: station.lng })
  }
  return map
}

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
  return readIncheonPoint(lat, lng)
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

// 역별 수송인원 CSV는 좌표가 없고 역명 기준이다. 역명/기간/수송인원만 읽어 좌표 마스터와 조인한다.
function readSubwayRow(record: Record<string, string>): { name: string; period: string; value: number } | null {
  // 역명만 사용한다(정류장명은 버스 정류장이라 제외). 버스 파일과 섞이지 않게 한다.
  const name = pickField(record, ['역명', '역사명', '지하철역', '전철역'])
  if (!name) return null
  const value =
    toNumber(pickField(record, ['수송인원', '승하차총계', '합계', '수송인원수'])) ||
    toNumber(pickField(record, ['승차인원', '승차총승객수'])) + toNumber(pickField(record, ['하차인원', '하차총승객수']))
  if (value <= 0) return null
  const year = pickField(record, ['연도', '년도', '기준연도'])
  const month = pickField(record, ['월', '기준월'])
  return { name, period: `${year}-${month}`, value }
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
  const subwayRows: Array<{ name: string; period: string; value: number }> = []
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
      const srow = readSubwayRow(record)
      if (srow) {
        subwayRows.push(srow)
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

  // 지하철: 역명 기준으로 월별 수송인원을 모아 월평균을 내고, 좌표 마스터와 조인해 H3에 배치
  const subwayMaster = loadSubwayMaster()
  const byStation = new Map<string, { sum: number; months: Set<string> }>()
  for (const row of subwayRows) {
    const key = normalizeStationName(row.name)
    const agg = byStation.get(key) ?? { sum: 0, months: new Set<string>() }
    agg.sum += row.value
    agg.months.add(row.period)
    byStation.set(key, agg)
  }
  let subwayMatched = 0
  const subwayUnmatched: string[] = []
  for (const [key, agg] of byStation) {
    const coord = subwayMaster.get(key)
    if (!coord) {
      subwayUnmatched.push(key)
      continue
    }
    const monthlyAvg = agg.sum / Math.max(1, agg.months.size)
    const h3Id = latLngToCell(coord.lat, coord.lng, INCHEON_H3_RESOLUTION)
    cells[h3Id] ??= { busStopCount: 0, busRidership: 0, subwayRidership: 0, accessScore: 0 }
    cells[h3Id].subwayRidership += monthlyAvg
    subwayMatched += 1
  }

  for (const cell of Object.values(cells)) {
    cell.accessScore =
      cell.busStopCount * 12 +
      Math.log1p(cell.busRidership) * 10 +
      Math.log1p(cell.subwayRidership) * 14
  }

  const subwayRidershipTotal = Object.values(cells).reduce((sum, cell) => sum + cell.subwayRidership, 0)
  if (subwayMaster.size === 0) {
    console.warn('⚠️ 지하철 역 좌표 마스터가 없습니다. `npm run incheon:data:subway-master`를 먼저 실행하세요.')
  } else if (subwayRidershipTotal <= 0) {
    throw new Error('[DATA_QUALITY_FAIL] subwayRidership 합계가 0입니다. 역명 조인 또는 원천 형식을 확인하세요.')
  }

  ensureDir(path.dirname(outputFile))
  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    h3Resolution: INCHEON_H3_RESOLUTION,
    sourceIds: ['incheon-bus-stops', 'incheon-bus-ridership', 'incheon-subway-ridership'],
    dataPeriod: '2024-월평균(역별 수송인원)',
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
    subwayStations: byStation.size,
    subwayMatched,
    subwayUnmatched,
    subwayMasterStations: subwayMaster.size,
    subwayRidershipTotal: Math.round(subwayRidershipTotal),
    fileStats,
  })

  console.log(
    `교통 H3 셀 ${Object.keys(cells).length}개 생성 (지하철 ${subwayMatched}/${byStation.size}역 매칭, 미매칭 ${subwayUnmatched.length})`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
