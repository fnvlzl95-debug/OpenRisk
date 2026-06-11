import path from 'path'
import { latLngToCell } from 'h3-js'
import * as XLSX from 'xlsx'
import { INCHEON_H3_RESOLUTION } from '../../lib/incheon/constants'
import { PROCESSED_DIR, RAW_DIR, distributionStats, ensureDir, listFilesRecursive, normalizeSchoolName, pickField, readIncheonPoint, readTableRecords, report, toNumber, writeJson } from './_utils'

const rawEducationDir = path.join(RAW_DIR, 'education')
const rawChildcareDir = path.join(RAW_DIR, 'childcare')
const outputFile = path.join(PROCESSED_DIR, 'h3-education-family', 'education-family-h3.json')

type EducationCell = {
  schoolCount: number
  studentCount: number
  childcareCount: number
  childcareCapacity: number
  childcareCurrent: number
  anchorCount: number
  educationScore: number
}

function readLatLng(record: Record<string, string>) {
  const lat = toNumber(pickField(record, ['위도', 'lat', 'latitude', 'Y좌표', 'y']))
  const lng = toNumber(pickField(record, ['경도', 'lng', 'lon', 'longitude', 'X좌표', 'x']))
  return readIncheonPoint(lat, lng)
}

function isIncheonRecord(record: Record<string, string>) {
  const area = [
    pickField(record, ['시도명', '시도', '지역', '주소', '소재지도로명주소', '소재지지번주소', 'lnmadr', 'rdnmadr']),
    pickField(record, ['교육청명', '관할교육청명', 'cddcNm', 'edcSportNm']),
  ].join(' ')
  return !area || area.includes('인천')
}

function getSchoolName(record: Record<string, string>) {
  return pickField(record, ['학교명', '학교이름', 'schoolNm'])
}

function getStudentCount(record: Record<string, string>) {
  return (
    toNumber(pickField(record, ['학생수', '학생수계', '계', '총학생수'])) ||
    toNumber(pickField(record, ['남학생수'])) + toNumber(pickField(record, ['여학생수']))
  )
}

function getChildcareName(record: Record<string, string>) {
  return pickField(record, ['어린이집명', '시설명', '보육시설명', 'crname'])
}

function extractDistrict(text: string): string {
  const match = text.match(/([가-힣]+[구군])/)
  return match ? match[1] : ''
}

type StatusEntry = { name: string; district: string; students: number }

/**
 * 인천교육청 학교현황 XLSX는 첫 시트(총괄)가 집계표라 readTableRecords로는 학교별 행을 못 읽는다.
 * 초/중/고/유치원/특수학교 시트는 학교별 행(병합 헤더)이므로, 헤더에서 '학교명'/'합계'(총학생수) 열을
 * 동적으로 찾아 (학교명, 구군, 총학생수)를 추출한다.
 */
function parseSchoolStatusSheets(filePath: string): StatusEntry[] {
  const entries: StatusEntry[] = []
  if (!/\.xlsx?$/i.test(filePath)) return entries
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.readFile(filePath)
  } catch {
    return entries
  }
  for (const sheetName of workbook.SheetNames) {
    if (!/(초등학교|중학교|고등학교|유치원|특수학교)/.test(sheetName)) continue
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '' })
    let nameCol = -1
    let totalCol = -1
    let districtCol = -1
    for (let r = 0; r < Math.min(rows.length, 6); r += 1) {
      const row = rows[r] ?? []
      for (let c = 0; c < row.length; c += 1) {
        const v = String(row[c] ?? '').replace(/\s+/g, '')
        if (nameCol < 0 && v === '학교명') nameCol = c
        if (totalCol < 0 && v === '합계') totalCol = c
        if (districtCol < 0 && (v === '구군별' || v === '구·군별' || v === '구군')) districtCol = c
      }
      if (nameCol >= 0 && totalCol >= 0) break
    }
    if (nameCol < 0 || totalCol < 0) continue
    for (const row of rows) {
      const name = String(row[nameCol] ?? '').trim()
      if (!/(초등학교|중학교|고등학교|유치원|학교)$/.test(name)) continue
      const students = toNumber(String(row[totalCol] ?? ''))
      if (students <= 0) continue
      const district = districtCol >= 0 ? String(row[districtCol] ?? '').trim() : ''
      entries.push({ name, district, students })
    }
  }
  return entries
}

function cell(cells: Record<string, EducationCell>, h3Id: string) {
  cells[h3Id] ??= {
    schoolCount: 0,
    studentCount: 0,
    childcareCount: 0,
    childcareCapacity: 0,
    childcareCurrent: 0,
    anchorCount: 0,
    educationScore: 0,
  }
  return cells[h3Id]
}

async function main() {
  const educationFiles = listFilesRecursive(rawEducationDir).filter((file) => /\.(csv|xlsx?|json)$/i.test(file))
  const childcareFiles = listFilesRecursive(rawChildcareDir).filter((file) => /\.(csv|xlsx?|json)$/i.test(file))
  const allFiles = [...educationFiles, ...childcareFiles]

  if (allFiles.length === 0) {
    report('education-import-report.json', {
      status: 'needs-source-file',
      expectedDirs: [rawEducationDir, rawChildcareDir],
      outputFile,
      joinRule: '학교 위치 데이터와 학교현황은 학교명/학교급/주소 기준으로 조인합니다.',
    })
    console.log('교육·보육 원천 파일이 아직 없습니다.')
    return
  }

  // 학교현황 시트에서 (학교명, 구군, 총학생수)를 뽑아 다중키 조인 맵을 만든다.
  const studentByKey = new Map<string, number>()
  let statusRows = 0
  for (const file of educationFiles) {
    for (const entry of parseSchoolStatusSheets(file)) {
      const normalized = normalizeSchoolName(entry.name)
      if (entry.district) studentByKey.set(`${normalized}|${entry.district}`, entry.students)
      studentByKey.set(normalized, entry.students)
      statusRows += 1
    }
  }

  const fileStats: Array<Record<string, unknown>> = [{ statusEntries: statusRows }]

  const cells: Record<string, EducationCell> = {}
  let schoolRows = 0
  let childcareRows = 0
  let studentJoinHits = 0

  for (const file of educationFiles) {
    const records = await readTableRecords(file)
    for (const record of records) {
      const point = readLatLng(record)
      const name = getSchoolName(record)
      if (!point || !name || !isIncheonRecord(record)) continue
      const normalized = normalizeSchoolName(name)
      const district = extractDistrict(
        pickField(record, ['소재지도로명주소', '소재지지번주소', '주소', 'rdnmadr', 'lnmadr'])
      )
      const students =
        studentByKey.get(`${normalized}|${district}`) ?? studentByKey.get(normalized) ?? getStudentCount(record)
      if (students > 0) studentJoinHits += 1
      const h3Id = latLngToCell(point.lat, point.lng, INCHEON_H3_RESOLUTION)
      const target = cell(cells, h3Id)
      target.schoolCount += 1
      target.studentCount += students
      target.anchorCount += 1
      schoolRows += 1
    }
  }

  for (const file of childcareFiles) {
    const records = await readTableRecords(file)
    let matchedRows = 0
    for (const record of records) {
      const point = readLatLng(record)
      const name = getChildcareName(record)
      if (!point || !name || !isIncheonRecord(record)) continue
      const h3Id = latLngToCell(point.lat, point.lng, INCHEON_H3_RESOLUTION)
      const target = cell(cells, h3Id)
      target.childcareCount += 1
      target.childcareCapacity += toNumber(pickField(record, ['정원', '보육정원', '정원수']))
      target.childcareCurrent += toNumber(pickField(record, ['현원', '보육현원', '현원수']))
      target.anchorCount += 1
      childcareRows += 1
      matchedRows += 1
    }
    fileStats.push({ file, rows: records.length, childcareRows: matchedRows })
  }

  for (const target of Object.values(cells)) {
    target.educationScore =
      target.schoolCount * 18 +
      Math.log1p(target.studentCount) * 8 +
      target.childcareCount * 16 +
      Math.log1p(target.childcareCapacity) * 5
  }

  if (Object.keys(cells).length === 0) {
    report('education-import-report.json', {
      status: 'needs-coordinate-source-file',
      inputFiles: allFiles,
      outputFile,
      message: '학교/어린이집 좌표가 있는 원천 파일이 필요합니다.',
      fileStats,
    })
    console.log('교육·보육 좌표 레코드를 찾지 못했습니다.')
    return
  }

  const studentTotal = Object.values(cells).reduce((sum, item) => sum + item.studentCount, 0)
  if (studentByKey.size > 0 && studentTotal <= 0) {
    throw new Error('[DATA_QUALITY_FAIL] studentCount 합계가 0입니다. 학교현황 조인 키/시트 파싱을 확인하세요.')
  }

  ensureDir(path.dirname(outputFile))
  const sourceIds = [
    'school-location-standard',
    ...(studentTotal > 0 ? ['incheon-school-status'] : []),
    ...(childcareRows > 0 ? ['childcare-basic'] : []),
  ]

  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    h3Resolution: INCHEON_H3_RESOLUTION,
    sourceIds,
    dataPeriod: '2025-04-01',
    cells,
    educationStats: distributionStats(Object.values(cells).map((item) => item.educationScore)),
    anchorStats: distributionStats(Object.values(cells).map((item) => item.anchorCount)),
  })

  report('education-import-report.json', {
    status: 'ready',
    inputFiles: allFiles,
    outputFile,
    cells: Object.keys(cells).length,
    schoolRows,
    studentJoinHits,
    studentTotal: Math.round(studentTotal),
    statusEntries: studentByKey.size,
    childcareRows,
    fileStats,
  })

  console.log(
    `교육·가족 H3 셀 ${Object.keys(cells).length}개 생성 (학생수 조인 ${studentJoinHits}/${schoolRows}교, 학생합계 ${Math.round(studentTotal).toLocaleString('ko-KR')}명)`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
