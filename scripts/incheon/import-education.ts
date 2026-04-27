import path from 'path'
import { latLngToCell } from 'h3-js'
import { INCHEON_H3_RESOLUTION } from '../../lib/incheon/constants'
import { PROCESSED_DIR, RAW_DIR, distributionStats, ensureDir, listFilesRecursive, pickField, readTableRecords, report, toNumber, writeJson } from './_utils'

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
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 30 || lng < 120) return null
  return { lat, lng }
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

  const studentByName = new Map<string, number>()
  const fileStats = []

  for (const file of educationFiles) {
    const records = await readTableRecords(file)
    let statusRows = 0
    for (const record of records) {
      const name = getSchoolName(record)
      const students = getStudentCount(record)
      if (name && students > 0) {
        studentByName.set(name, students)
        statusRows += 1
      }
    }
    fileStats.push({ file, rows: records.length, statusRows })
  }

  const cells: Record<string, EducationCell> = {}
  let schoolRows = 0
  let childcareRows = 0

  for (const file of educationFiles) {
    const records = await readTableRecords(file)
    for (const record of records) {
      const point = readLatLng(record)
      const name = getSchoolName(record)
      if (!point || !name || !isIncheonRecord(record)) continue
      const h3Id = latLngToCell(point.lat, point.lng, INCHEON_H3_RESOLUTION)
      const target = cell(cells, h3Id)
      target.schoolCount += 1
      target.studentCount += studentByName.get(name) ?? getStudentCount(record)
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

  ensureDir(path.dirname(outputFile))
  const sourceIds = [
    'school-location-standard',
    ...(studentByName.size > 0 ? ['incheon-school-status'] : []),
    ...(childcareRows > 0 ? ['childcare-basic'] : []),
  ]

  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    h3Resolution: INCHEON_H3_RESOLUTION,
    sourceIds,
    dataPeriod: 'official-file',
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
    childcareRows,
    fileStats,
  })

  console.log(`교육·가족 H3 셀 ${Object.keys(cells).length}개 생성`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
