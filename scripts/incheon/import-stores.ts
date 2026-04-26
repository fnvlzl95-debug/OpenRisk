import path from 'path'
import { PROCESSED_DIR, RAW_DIR, listFiles, report } from './_utils'

const rawStoresDir = path.join(RAW_DIR, 'stores')
const candidates = listFiles(rawStoresDir).filter((file) => /\.(csv|xlsx)$/i.test(file))

if (candidates.length === 0) {
  report('stores-import-report.json', {
    status: 'needs-source-file',
    message: '인천 소상공인 상가정보 CSV가 필요합니다.',
    expectedDir: rawStoresDir,
    outputDir: path.join(PROCESSED_DIR, 'h3-store-counts'),
  })
  console.log('인천 소상공인 상가정보 원본 파일이 아직 없습니다.')
  process.exit(0)
}

report('stores-import-report.json', {
  status: 'ready-for-parser',
  inputFiles: candidates,
  outputDir: path.join(PROCESSED_DIR, 'h3-store-counts'),
  nextStep: '기존 import-store-csv.ts의 업종 매핑과 H3 집계 로직을 인천 전용 출력 경로로 연결합니다.',
})

console.log(`상가정보 후보 파일 ${candidates.length}개를 확인했습니다.`)
