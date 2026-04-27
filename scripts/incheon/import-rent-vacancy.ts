import path from 'path'
import { PROCESSED_DIR, RAW_DIR, ensureDir, listFilesRecursive, pickField, readJson, readTableRecords, report, toNumber, writeJson } from './_utils'

const rawCostDir = path.join(RAW_DIR, 'rent-vacancy')
const outputFile = path.join(PROCESSED_DIR, 'cost-pressure', 'cost-pressure.json')

type CostRegionDraft = {
  regionName: string
  rentPerSquareMeter?: number
  vacancyRate?: number
  rentPeriod?: string
  vacancyPeriod?: string
}

type RoneRawStat = {
  sourceId?: string
  label?: string
  data?: Array<Record<string, unknown>>
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

function percentileRank(value: number | undefined, values: number[]) {
  if (!value || values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const lowerOrEqual = sorted.filter((item) => item <= value).length
  return clamp((lowerOrEqual / sorted.length) * 100)
}

function scoreCost(region: CostRegionDraft, allRegions: CostRegionDraft[]) {
  const rentValues = allRegions.map((item) => item.rentPerSquareMeter).filter((value): value is number => Boolean(value))
  const vacancyValues = allRegions.map((item) => item.vacancyRate).filter((value): value is number => Boolean(value))
  const rentScore = percentileRank(region.rentPerSquareMeter, rentValues)
  const vacancyScore = percentileRank(region.vacancyRate, vacancyValues)
  if (region.rentPerSquareMeter && region.vacancyRate) return Math.round(clamp(rentScore * 0.55 + vacancyScore * 0.45))
  if (region.rentPerSquareMeter) return Math.round(rentScore)
  if (region.vacancyRate) return Math.round(vacancyScore)
  return 0
}

function latestRoneValue(record: Record<string, unknown>) {
  const columns = Object.keys(record)
    .map((key) => {
      const match = key.match(/^COL_(\d{4})(\d{2})\d+OD$/)
      if (!match) return null
      const year = Number(match[1])
      const quarter = Number(match[2])
      return {
        key,
        sortKey: year * 10 + quarter,
        period: `${year}Q${quarter}`,
      }
    })
    .filter((item): item is { key: string; sortKey: number; period: string } => Boolean(item))
    .sort((a, b) => b.sortKey - a.sortKey)

  for (const column of columns) {
    const value = toNumber(record[column.key])
    if (value || String(record[column.key] ?? '').trim() === '0.0') {
      return { value, period: column.period }
    }
  }
  return { value: undefined, period: undefined }
}

function roneRegionName(record: Record<string, unknown>) {
  const c1 = String(record.CATE1 ?? '').trim()
  const c2 = String(record.CATE2 ?? '').trim()
  const c3 = String(record.CATE3 ?? '').trim()
  if (c1 !== '인천' && c2 !== '인천' && c3 !== '인천') return ''
  if (c3 && c3 !== c1) return c3
  if (c2 && c2 !== c1) return c2
  return c1 || c2 || c3
}

function mergeRegion(regions: Map<string, CostRegionDraft>, name: string) {
  const region = regions.get(name) ?? { regionName: name }
  regions.set(name, region)
  return region
}

function applyRoneFile(file: string, regions: Map<string, CostRegionDraft>) {
  const payload = readJson<RoneRawStat>(file)
  const rows = Array.isArray(payload.data) ? payload.data : []
  const sourceText = `${payload.sourceId ?? ''} ${payload.label ?? ''} ${path.basename(file)}`
  const isRent = payload.sourceId === 'reb-small-rent' || /임대료|rent/i.test(sourceText)
  const isVacancy = payload.sourceId === 'reb-small-vacancy' || /공실|vacancy/i.test(sourceText)
  let matched = 0

  for (const record of rows) {
    const regionName = roneRegionName(record)
    if (!regionName) continue
    const latest = latestRoneValue(record)
    if (!latest.value && latest.value !== 0) continue
    const region = mergeRegion(regions, regionName)
    if (isRent) {
      region.rentPerSquareMeter = latest.value
      region.rentPeriod = latest.period
      matched += 1
    }
    if (isVacancy) {
      region.vacancyRate = latest.value
      region.vacancyPeriod = latest.period
      matched += 1
    }
  }

  return { file, rows: rows.length, matched, parser: 'rone-json' }
}

async function main() {
  const files = listFilesRecursive(rawCostDir).filter((file) => /\.(csv|xlsx|json)$/i.test(file))
  if (files.length === 0) {
    report('rent-vacancy-import-report.json', {
      status: 'needs-source-file',
      rawFiles: [],
      outputFile,
      missingPolicy: '비용 데이터가 없으면 기본값을 쓰지 않고 cost 지표를 점수에서 제외합니다.',
    })
    console.log('비용 원천 후보가 없습니다.')
    return
  }

  const regionDrafts = new Map<string, CostRegionDraft>()
  const fileStats = []

  for (const file of files) {
    if (/\.json$/i.test(file)) {
      fileStats.push(applyRoneFile(file, regionDrafts))
      continue
    }

    const records = await readTableRecords(file)
    let matched = 0
    const fileName = path.basename(file)
    const isRentFile = /임대료|rent/i.test(fileName)
    const isVacancyFile = /공실|vacancy/i.test(fileName)

    for (const record of records) {
      const regionName = pickField(record, ['지역', '지역명', '상권', '권역', '시도', '시군구']) || '인천'
      if (!regionName.includes('인천')) continue
      const rentPerSquareMeter =
        toNumber(pickField(record, ['임대료', '㎡당임대료', '제곱미터당임대료', '월세', '평균임대료'])) || undefined
      const vacancyRate = toNumber(pickField(record, ['공실률', '공실율', 'vacancy'])) || undefined
      if (!rentPerSquareMeter && !vacancyRate) continue
      matched += 1
      const region = mergeRegion(regionDrafts, regionName)
      if (rentPerSquareMeter || isRentFile) region.rentPerSquareMeter = rentPerSquareMeter
      if (vacancyRate || isVacancyFile) region.vacancyRate = vacancyRate
    }
    fileStats.push({ file, rows: records.length, matched, parser: 'table' })
  }

  const regions = Array.from(regionDrafts.values())
    .filter((region) => region.rentPerSquareMeter || region.vacancyRate)
    .map((region) => ({
      ...region,
      costScore: scoreCost(region, Array.from(regionDrafts.values())),
      confidence: region.rentPerSquareMeter !== undefined && region.vacancyRate !== undefined ? 'high' : 'medium',
    }))
    .sort((a, b) => {
      if (a.regionName === '인천') return -1
      if (b.regionName === '인천') return 1
      return a.regionName.localeCompare(b.regionName, 'ko-KR')
    })

  if (regions.length === 0) {
    report('rent-vacancy-import-report.json', {
      status: 'needs-readable-fields',
      inputFiles: files,
      outputFile,
      fileStats,
      missingPolicy: '파싱 가능한 비용 데이터가 없으므로 cost 지표를 점수에서 제외합니다.',
    })
    console.log('파싱 가능한 비용 레코드를 찾지 못했습니다.')
    return
  }

  ensureDir(path.dirname(outputFile))
  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceIds: ['reb-small-rent', 'reb-small-vacancy'],
    dataPeriod: regions[0]?.rentPeriod || regions[0]?.vacancyPeriod || 'official-file',
    unit: {
      rentPerSquareMeter: '천원/㎡',
      vacancyRate: '%',
    },
    regions,
  })

  report('rent-vacancy-import-report.json', {
    status: 'ready',
    inputFiles: files,
    outputFile,
    regions: regions.length,
    fileStats,
  })

  console.log(`비용 권역 ${regions.length}개 생성`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
