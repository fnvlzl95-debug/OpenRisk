import path from 'path'
import { PROCESSED_DIR, RAW_DIR, listFiles, report } from './_utils'

const rawCostDir = path.join(RAW_DIR, 'rent-vacancy')
const rawFiles = listFiles(rawCostDir).filter((file) => /\.(csv|xlsx)$/i.test(file))
const localRent = path.join(process.cwd(), 'data', 'rent', 'commercial_rent_2025Q3.xlsx')
const localCandidates = listFiles(path.dirname(localRent)).includes(localRent) ? [localRent] : []

report('rent-vacancy-import-report.json', {
  status: rawFiles.length > 0 || localCandidates.length > 0 ? 'local-candidates-found' : 'needs-source-file',
  rawFiles,
  localCandidates,
  outputDir: path.join(PROCESSED_DIR, 'cost-pressure'),
  missingPolicy: '비용 데이터가 없으면 기본값을 쓰지 않고 cost 지표를 점수에서 제외합니다.',
})

console.log(`비용 원천 후보: raw ${rawFiles.length}개, local ${localCandidates.length}개`)
