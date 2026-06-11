import fs from 'fs'
import crypto from 'crypto'
import path from 'path'
import { MANIFEST_DIR, RAW_DIR, ensureDir, listFilesRecursive, writeJson } from './_utils'

/**
 * 원천 파일 매니페스트(sha256 + 크기 + 추정 기준일)를 생성해 재현성을 확보한다.
 * 동일 원천 + 동일 스크립트 → 동일 산출물임을 검증하는 기준이 된다.
 */
const outputFile = path.join(MANIFEST_DIR, 'raw-file-manifest.json')

function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    fs.createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}

function guessBaseDate(name: string): string | null {
  const ymd = name.match(/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/)
  if (ymd && Number(ymd[2]) <= 12 && Number(ymd[3]) <= 31) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  const ym = name.match(/(\d{4})(\d{2})(?!\d)/)
  if (ym && Number(ym[2]) <= 12) return `${ym[1]}-${ym[2]}`
  const q = name.match(/(\d{4})[ ]?Q?([1-4])분기|（?(\d{4})Q([1-4])）?/i)
  if (q) return q[1] ? `${q[1]}Q${q[2]}` : `${q[3]}Q${q[4]}`
  const y = name.match(/(20\d{2})/)
  return y ? y[1] : null
}

async function main() {
  const files = listFilesRecursive(RAW_DIR).filter((file) => !/[\\/]\.gitkeep$/.test(file))
  const entries = []
  for (const file of files) {
    const stat = fs.statSync(file)
    const rel = path.relative(RAW_DIR, file).replace(/\\/g, '/')
    process.stdout.write(`해싱: ${rel} (${(stat.size / 1e6).toFixed(1)}MB)\n`)
    entries.push({
      path: rel,
      bytes: stat.size,
      sha256: await sha256(file),
      officialBaseDate: guessBaseDate(path.basename(file)),
    })
  }
  entries.sort((a, b) => a.path.localeCompare(b.path))

  ensureDir(MANIFEST_DIR)
  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    fileCount: entries.length,
    files: entries,
  })
  console.log(`원천 매니페스트 생성: ${entries.length}개 파일`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
