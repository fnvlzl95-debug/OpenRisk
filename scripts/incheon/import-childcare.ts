import path from 'path'
import { PROCESSED_DIR, RAW_DIR, listFiles, report } from './_utils'

const rawChildcareDir = path.join(RAW_DIR, 'childcare')
const files = listFiles(rawChildcareDir).filter((file) => /\.(csv|xlsx|json)$/i.test(file))

report('childcare-import-report.json', {
  status: files.length > 0 ? 'ready-for-parser' : 'needs-api-key-or-file',
  inputFiles: files,
  outputDir: path.join(PROCESSED_DIR, 'h3-education-family'),
  requiredFields: ['시설명', '위도', '경도', '정원', '현원', '입소대기', '연령별 아동 수'],
  confidenceRules: {
    high: '위도·경도 + 현원/정원 있음',
    medium: '위치 있음 + 현원/정원 없음',
    low: '행정구역 집계만 있음',
  },
})

console.log(`어린이집 원천 후보 ${files.length}개를 확인했습니다.`)
