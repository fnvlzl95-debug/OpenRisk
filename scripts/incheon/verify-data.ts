import fs from 'fs'
import path from 'path'
import { cellToLatLng } from 'h3-js'
import { INCHEON_ADMIN_ENVELOPE as INCHEON_ADMIN, PROCESSED_DIR, normalizeKoreaCoordinate } from './_utils'

/**
 * 빌드/배포 전 데이터 품질 게이트. 하나라도 실패하면 exit 1.
 * 좌표 swap 로직(normalizeKoreaCoordinate)도 단위 테스트로 보호한다.
 */
const failures: string[] = []
const ok: string[] = []

function check(label: string, condition: boolean, detail: string) {
  if (condition) ok.push(`✓ ${label}`)
  else failures.push(`✗ ${label} — ${detail}`)
}

function readJson(file: string): any {
  const p = path.join(PROCESSED_DIR, file)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function sum(cells: Record<string, any> | undefined, key: string) {
  if (!cells) return 0
  return Object.values(cells).reduce((s, c: any) => s + Number(c[key] ?? 0), 0)
}

// 1) 좌표 정규화 단위 테스트 (swap 로직 보호)
{
  const swapped = normalizeKoreaCoordinate(126.7, 37.45) // 뒤바뀐 입력
  check('coord-swap', !!swapped && Math.abs(swapped!.lat - 37.45) < 1e-9 && Math.abs(swapped!.lng - 126.7) < 1e-9, JSON.stringify(swapped))
  const normal = normalizeKoreaCoordinate(37.45, 126.7)
  check('coord-normal', !!normal && normal!.lat === 37.45 && normal!.lng === 126.7, JSON.stringify(normal))
  check('coord-reject-out-of-range', normalizeKoreaCoordinate(20, 100) === null, 'should reject far point')
  check('coord-reject-nan', normalizeKoreaCoordinate(NaN, 126.7) === null, 'should reject NaN')
}

// 2) 데이터셋 불변식
const stores = readJson('h3-store-counts/store-counts-h3.json')
const transit = readJson('h3-transit/transit-h3.json')
const education = readJson('h3-education-family/education-family-h3.json')
const radius = readJson('radius-stats/radius-stats-500m.json')

check('stores-present', !!stores, 'store-counts-h3.json missing')
check('transit-present', !!transit, 'transit-h3.json missing')
check('education-present', !!education, 'education-family-h3.json missing')
check('radius-present', !!radius, 'radius-stats missing')

if (stores) {
  check('stores-cell-count', Object.keys(stores.cells ?? {}).length >= 1000, `${Object.keys(stores.cells ?? {}).length} cells`)
  check('stores-dataPeriod', stores.dataPeriod && stores.dataPeriod !== 'official-file', `dataPeriod=${stores.dataPeriod}`)
  check('stores-sourceIds', (stores.sourceIds ?? []).length > 0, 'empty sourceIds')
}
if (transit) {
  const subwayTotal = sum(transit.cells, 'subwayRidership')
  check('transit-subway-nonzero', subwayTotal > 0, `subwayRidershipTotal=${Math.round(subwayTotal)}`)
  check('transit-dataPeriod', transit.dataPeriod && transit.dataPeriod !== 'official-file', `dataPeriod=${transit.dataPeriod}`)
}
if (education) {
  const studentTotal = sum(education.cells, 'studentCount')
  check('education-student-nonzero', studentTotal > 0, `studentCountTotal=${Math.round(studentTotal)}`)
  check('education-dataPeriod', education.dataPeriod && education.dataPeriod !== 'official-file', `dataPeriod=${education.dataPeriod}`)
  check('education-sourceIds-has-status', (education.sourceIds ?? []).includes('incheon-school-status'), `sourceIds=${JSON.stringify(education.sourceIds)}`)
}
if (radius) {
  check('radius-dataPeriod', radius.dataPeriod && radius.dataPeriod !== 'official-file', `dataPeriod=${radius.dataPeriod}`)
}

// 3) 모든 셀 중심이 인천 행정구역 envelope 안에 있는지 (좌표 오염 검출 — 섬 포함)
for (const [label, dataset] of [['stores', stores], ['transit', transit], ['education', education]] as const) {
  if (!dataset?.cells) continue
  let outOfBounds = 0
  for (const h3Id of Object.keys(dataset.cells)) {
    const [lat, lng] = cellToLatLng(h3Id)
    if (lat < INCHEON_ADMIN.latMin || lat > INCHEON_ADMIN.latMax || lng < INCHEON_ADMIN.lngMin || lng > INCHEON_ADMIN.lngMax) {
      outOfBounds += 1
    }
  }
  check(`${label}-cells-in-admin-envelope`, outOfBounds === 0, `${outOfBounds} cells out of Incheon admin envelope`)
}

console.log(ok.join('\n'))
if (failures.length > 0) {
  console.error('\n데이터 검증 실패:')
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`\n✅ 데이터 검증 통과 (${ok.length}개 항목)`)
