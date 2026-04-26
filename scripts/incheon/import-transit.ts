import path from 'path'
import { PROCESSED_DIR, RAW_DIR, listFiles, report } from './_utils'

const rawTransitDir = path.join(RAW_DIR, 'transit')
const rawFiles = listFiles(rawTransitDir).filter((file) => /\.(csv|xlsx)$/i.test(file))
const localCandidates = [
  path.join(process.cwd(), 'data', 'bus', 'incheon', 'ridership_2025.csv'),
  path.join(process.cwd(), 'data', 'subway', 'incheon', 'stations.csv'),
]

const existingLocal = localCandidates.filter((file) => listFiles(path.dirname(file)).includes(file))

report('transit-import-report.json', {
  status: rawFiles.length > 0 || existingLocal.length > 0 ? 'local-candidates-found' : 'needs-source-file',
  rawFiles,
  localCandidates: existingLocal,
  outputDir: path.join(PROCESSED_DIR, 'h3-transit'),
  method: '버스 승하차 거리감쇠 + 지하철 수송인원 거리감쇠 + 반경 내 정류장 수',
})

console.log(`교통 원천 후보: raw ${rawFiles.length}개, local ${existingLocal.length}개`)
