import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse'
import iconv from 'iconv-lite'
import * as XLSX from 'xlsx'

export const WORKSPACE = path.join(process.cwd(), 'data', 'openrisk-incheon')
export const MANIFEST_DIR = path.join(WORKSPACE, 'manifest')
export const RAW_DIR = path.join(WORKSPACE, 'raw')
export const PROCESSED_DIR = path.join(WORKSPACE, 'processed')
export const REPORTS_DIR = path.join(WORKSPACE, 'reports')

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).map((file) => path.join(dir, file))
}

export function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    return entry.isDirectory() ? listFilesRecursive(fullPath) : [fullPath]
  })
}

export function detectTextEncoding(filePath: string): 'utf8' | 'cp949' {
  const sample = fs.readFileSync(filePath).subarray(0, 4096)
  if (sample.length >= 3 && sample[0] === 0xef && sample[1] === 0xbb && sample[2] === 0xbf) return 'utf8'
  const decoded = sample.toString('utf8')
  const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length
  return replacementCount > 3 ? 'cp949' : 'utf8'
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function readCsvRecords(filePath: string): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const records: Record<string, string>[] = []
    const decode = iconv.decodeStream(detectTextEncoding(filePath))

    fs.createReadStream(filePath)
      .pipe(decode)
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true }))
      .on('data', (record: Record<string, string>) => records.push(record))
      .on('error', reject)
      .on('end', () => resolve(records))
  })
}

export async function readTableRecords(filePath: string): Promise<Record<string, string>[]> {
  if (/\.json$/i.test(filePath)) {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.records)) return payload.records
    return []
  }

  if (/\.xlsx?$/i.test(filePath)) {
    const workbook = XLSX.readFile(filePath, { cellDates: false })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return []
    return XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets[sheetName], { defval: '' })
  }

  return readCsvRecords(filePath)
}

export function normalizeHeader(value: string) {
  return value.replace(/\s+/g, '').replace(/[()]/g, '').toLowerCase()
}

/** 지하철 역명 정규화: 공백·괄호·말미 '역' 제거. (CSV 역명 ↔ 좌표 마스터 조인용) */
export function normalizeStationName(value: string) {
  return value
    .trim()
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .replace(/역$/, '')
    .toLowerCase()
}

/** 학교명 정규화: 학교급 접미사를 축약해 위치 데이터 ↔ 학교현황 조인 정확도를 높인다. */
export function normalizeSchoolName(value: string) {
  return value
    .trim()
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .replace(/여자고등학교$/, '여고')
    .replace(/남자고등학교$/, '남고')
    .replace(/여자중학교$/, '여중')
    .replace(/초등학교$/, '초')
    .replace(/중학교$/, '중')
    .replace(/고등학교$/, '고')
    .toLowerCase()
}

export function pickField(record: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(record)
  for (const candidate of candidates) {
    const wanted = normalizeHeader(candidate)
    const found = entries.find(([key]) => normalizeHeader(key) === wanted)
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
      return String(found[1]).trim()
    }
  }
  for (const candidate of candidates) {
    const wanted = normalizeHeader(candidate)
    const found = entries.find(([key]) => normalizeHeader(key).includes(wanted) || wanted.includes(normalizeHeader(key)))
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') {
      return String(found[1]).trim()
    }
  }
  return ''
}

// 인천 행정구역 전체 envelope(강화·옹진 섬 포함, 분석 bbox보다 넓다).
// 타 시도(예: 충남/경북의 '인천리')나 부천·서울 fringe를 import 단계에서 걸러낸다.
export const INCHEON_ADMIN_ENVELOPE = { latMin: 36.8, latMax: 38.05, lngMin: 124.5, lngMax: 127.05 }

export function inIncheonEnvelope(lat: number, lng: number): boolean {
  return (
    lat >= INCHEON_ADMIN_ENVELOPE.latMin &&
    lat <= INCHEON_ADMIN_ENVELOPE.latMax &&
    lng >= INCHEON_ADMIN_ENVELOPE.lngMin &&
    lng <= INCHEON_ADMIN_ENVELOPE.lngMax
  )
}

/**
 * 한국 좌표 정규화: 위경도 뒤바뀜(예: lat=126, lng=37) 보정 + 한반도 상·하한 범위 검증.
 * 범위를 벗어나면 null. (swap 로직은 정상 동작이며 verify-data.ts가 단위 테스트로 보호한다)
 */
export function normalizeKoreaCoordinate(lat: number, lng: number): { lat: number; lng: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  let nlat = lat
  let nlng = lng
  if (nlat > 90 && nlng < 90) {
    const t = nlat
    nlat = nlng
    nlng = t
  }
  if (nlat < 30 || nlat > 40 || nlng < 120 || nlng > 132) return null
  return { lat: nlat, lng: nlng }
}

/** 좌표 정규화 후 인천 행정 envelope 안에 있는 점만 반환한다(타 시도/뒤바뀜/쓰레기값 제거). */
export function readIncheonPoint(lat: number, lng: number): { lat: number; lng: number } | null {
  const point = normalizeKoreaCoordinate(lat, lng)
  if (!point || !inIncheonEnvelope(point.lat, point.lng)) return null
  return point
}

export function toNumber(value: unknown) {
  if (value === undefined || value === null) return 0
  const parsed = Number(String(value).replace(/[,명건원㎡%]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

// 선형 보간 분위수(R-7). ceil 방식의 상향 편향을 제거한다.
export function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * ratio
  const base = Math.floor(pos)
  const rest = pos - base
  const lower = sorted[base]
  const upper = sorted[base + 1] ?? lower
  return lower + rest * (upper - lower)
}

export function distributionStats(values: number[]) {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0)
  return {
    p50: percentile(positive, 0.5),
    p75: percentile(positive, 0.75),
    p90: percentile(positive, 0.9),
    p95: percentile(positive, 0.95),
    max: positive.length > 0 ? Math.max(...positive) : 0,
  }
}

export function requireAnyFile(label: string, candidates: string[]) {
  const existing = candidates.filter((candidate) => fs.existsSync(candidate))
  if (existing.length === 0) {
    throw new Error(`${label} 파일을 찾지 못했습니다.\n확인 경로:\n${candidates.map((item) => `- ${item}`).join('\n')}`)
  }
  return existing
}

export function report(name: string, payload: unknown) {
  writeJson(path.join(REPORTS_DIR, name), {
    updatedAt: new Date().toISOString(),
    ...payload,
  })
}
