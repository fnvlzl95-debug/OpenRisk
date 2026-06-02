import fs from 'fs'
import path from 'path'
import { PROCESSED_DIR, ensureDir, writeJson } from './_utils'

/**
 * 처리된 데이터셋을 읽어 핵심 신호의 합계/상태를 요약한 data-health.json을 생성한다.
 * 런타임(lib/incheon/data-repository.ts)이 이를 읽어 신뢰도/degraded 표기에 사용한다.
 * 전 셀 합계가 0인 핵심 신호(지하철·학생수)는 degraded로 기록한다.
 */
const FILES = {
  stores: path.join(PROCESSED_DIR, 'h3-store-counts', 'store-counts-h3.json'),
  transit: path.join(PROCESSED_DIR, 'h3-transit', 'transit-h3.json'),
  education: path.join(PROCESSED_DIR, 'h3-education-family', 'education-family-h3.json'),
  cost: path.join(PROCESSED_DIR, 'cost-pressure', 'cost-pressure.json'),
  radiusStats: path.join(PROCESSED_DIR, 'radius-stats', 'radius-stats-500m.json'),
}
const outputFile = path.join(PROCESSED_DIR, 'data-health', 'data-health.json')

function readJsonOrNull<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function sumCells<T extends Record<string, number>>(
  cells: Record<string, T> | undefined,
  key: keyof T
): number {
  if (!cells) return 0
  let total = 0
  for (const cell of Object.values(cells)) total += Number(cell[key] ?? 0)
  return total
}

function main() {
  const stores = readJsonOrNull<{ cells?: Record<string, { totalStores: number }>; dataPeriod?: string }>(FILES.stores)
  const transit = readJsonOrNull<{ cells?: Record<string, { busStopCount: number; busRidership: number; subwayRidership: number }>; dataPeriod?: string }>(FILES.transit)
  const education = readJsonOrNull<{ cells?: Record<string, { schoolCount: number; studentCount: number; childcareCount: number }>; dataPeriod?: string }>(FILES.education)
  const cost = readJsonOrNull<{ regions?: unknown[] }>(FILES.cost)
  const radiusStats = readJsonOrNull<{ centerCellCount?: number }>(FILES.radiusStats)

  const subwayRidershipTotal = sumCells(transit?.cells, 'subwayRidership')
  const studentCountTotal = sumCells(education?.cells, 'studentCount')

  const transitIssues: string[] = []
  if (subwayRidershipTotal <= 0) transitIssues.push('SUBWAY_RIDERSHIP_TOTAL_ZERO')
  const educationIssues: string[] = []
  if (studentCountTotal <= 0) educationIssues.push('STUDENT_COUNT_TOTAL_ZERO')

  const health = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    datasets: {
      stores: {
        cells: stores?.cells ? Object.keys(stores.cells).length : 0,
        totalStores: sumCells(stores?.cells, 'totalStores'),
        dataPeriod: stores?.dataPeriod ?? null,
        status: stores ? 'ok' : 'missing',
        issues: [] as string[],
      },
      transit: {
        cells: transit?.cells ? Object.keys(transit.cells).length : 0,
        busStopCount: sumCells(transit?.cells, 'busStopCount'),
        busRidershipTotal: Math.round(sumCells(transit?.cells, 'busRidership')),
        subwayRidershipTotal: Math.round(subwayRidershipTotal),
        dataPeriod: transit?.dataPeriod ?? null,
        status: transitIssues.length > 0 ? 'degraded' : 'ok',
        issues: transitIssues,
      },
      education: {
        cells: education?.cells ? Object.keys(education.cells).length : 0,
        schoolCount: sumCells(education?.cells, 'schoolCount'),
        studentCountTotal: Math.round(studentCountTotal),
        childcareCount: sumCells(education?.cells, 'childcareCount'),
        dataPeriod: education?.dataPeriod ?? null,
        status: educationIssues.length > 0 ? 'degraded' : 'ok',
        issues: educationIssues,
      },
      cost: {
        regions: cost?.regions?.length ?? 0,
        status: cost?.regions?.length ? 'ok' : 'missing',
        issues: [] as string[],
      },
      radiusStats: {
        centerCellCount: radiusStats?.centerCellCount ?? 0,
        status: radiusStats ? 'ok' : 'missing',
        issues: [] as string[],
      },
    },
    flags: {
      subwayDegraded: subwayRidershipTotal <= 0,
      studentDegraded: studentCountTotal <= 0,
    },
  }

  ensureDir(path.dirname(outputFile))
  writeJson(outputFile, health)
  console.log(
    `데이터 건전성 요약 생성: 지하철 ${health.datasets.transit.subwayRidershipTotal.toLocaleString('ko-KR')} / 학생수 ${health.datasets.education.studentCountTotal.toLocaleString('ko-KR')}`
  )
  console.log(`degraded 플래그: ${JSON.stringify(health.flags)}`)
}

main()
