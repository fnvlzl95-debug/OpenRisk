import path from 'path'
import { MANIFEST_DIR, readJson, report } from './_utils'

interface Source {
  sourceId: string
  name: string
  provider: string
  url: string
  status: string
}

interface BlockedDownload {
  sourceId?: string
  name?: string
  provider?: string
  url: string
  pageUrl?: string
  reason: string
  userAction?: string
  targetDir?: string
}

const sources = readJson<Source[]>(path.join(MANIFEST_DIR, 'public-data-sources.json'))
const blockedPayload = readJson<BlockedDownload[] | { blocked: BlockedDownload[] }>(path.join(MANIFEST_DIR, 'blocked-downloads.json'))
const blocked = Array.isArray(blockedPayload) ? blockedPayload : blockedPayload.blocked

console.log('\nOpenRisk Incheon public data inventory')
console.log('======================================')

for (const source of sources) {
  console.log(`[${source.status}] ${source.name} - ${source.provider}`)
  console.log(`  ${source.url}`)
}

console.log('\nUser-provided files needed')
console.log('==========================')

for (const item of blocked) {
  console.log(`- ${item.name ?? item.sourceId}: ${item.reason}`)
  console.log(`  URL: ${item.url ?? item.pageUrl}`)
  if (item.userAction || item.targetDir) {
    console.log(`  Action: ${item.userAction ?? `파일을 ${item.targetDir} 아래에 저장`}`)
  }
}

report('download-inventory-report.json', {
  sourceCount: sources.length,
  blockedCount: blocked.length,
  blocked,
})
