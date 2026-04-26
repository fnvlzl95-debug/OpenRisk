import fs from 'fs'
import path from 'path'

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

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

export function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
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
