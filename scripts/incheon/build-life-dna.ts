import path from 'path'
import { PROCESSED_DIR, listFiles, report } from './_utils'

const inputs = {
  stores: listFiles(path.join(PROCESSED_DIR, 'h3-store-counts')).filter((file) => file.endsWith('.json')),
  transit: listFiles(path.join(PROCESSED_DIR, 'h3-transit')).filter((file) => file.endsWith('.json')),
  educationFamily: listFiles(path.join(PROCESSED_DIR, 'h3-education-family')).filter((file) => file.endsWith('.json')),
  costPressure: listFiles(path.join(PROCESSED_DIR, 'cost-pressure')).filter((file) => file.endsWith('.json')),
  mapMask: listFiles(path.join(PROCESSED_DIR, 'osm-mask')).filter((file) => file.endsWith('.json')),
  radiusStats: listFiles(path.join(PROCESSED_DIR, 'radius-stats')).filter((file) => file.endsWith('.json')),
}

const ready = Object.entries(inputs).filter(([, files]) => files.length > 0).map(([key]) => key)
const required = ['stores', 'transit', 'radiusStats']
const missing = Object.entries(inputs)
  .filter(([key, files]) => required.includes(key) && files.length === 0)
  .map(([key]) => key)
const optionalMissing = Object.entries(inputs)
  .filter(([key, files]) => !required.includes(key) && files.length === 0)
  .map(([key]) => key)

report('life-dna-build-report.json', {
  status: missing.length === 0 ? 'ready' : 'waiting-for-processed-inputs',
  ready,
  missing,
  optionalMissing,
  outputContract: {
    educationFamily: '생활권 DNA 해석 레이어',
    transitAccess: '교통 접근 기반 유입 신호',
    categoryDensity: '동종업종 밀집도',
    costPressure: '비용 압박 참고',
    radiusStats: '반경 500m 집계값 정규화 분포',
  },
})

console.log(`LifeDNA 입력 준비: ${ready.join(', ') || '없음'}`)
if (missing.length > 0) {
  console.log(`대기 중: ${missing.join(', ')}`)
}
