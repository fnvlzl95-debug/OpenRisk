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
  name: string
  provider: string
  url: string
  reason: string
  userAction: string
}

const sources = readJson<Source[]>(path.join(MANIFEST_DIR, 'public-data-sources.json'))
const blocked = readJson<BlockedDownload[]>(path.join(MANIFEST_DIR, 'blocked-downloads.json'))

console.log('\nOpenRisk Incheon public data inventory')
console.log('======================================')

for (const source of sources) {
  console.log(`[${source.status}] ${source.name} - ${source.provider}`)
  console.log(`  ${source.url}`)
}

console.log('\nUser-provided files needed')
console.log('==========================')

for (const item of blocked) {
  console.log(`- ${item.name}: ${item.reason}`)
  console.log(`  Action: ${item.userAction}`)
}

report('download-inventory-report.json', {
  sourceCount: sources.length,
  blockedCount: blocked.length,
  blocked,
})
