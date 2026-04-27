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

export function toNumber(value: unknown) {
  if (value === undefined || value === null) return 0
  const parsed = Number(String(value).replace(/[,명건원㎡%]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
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
