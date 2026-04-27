import path from 'path'
import { PROCESSED_DIR, RAW_DIR, listFilesRecursive, report } from './_utils'

const rawChildcareDir = path.join(RAW_DIR, 'childcare')

const files = listFilesRecursive(rawChildcareDir).filter((file) => /\.(csv|xlsx|json|xml)$/i.test(file))

report('childcare-import-report.json', {
  status: files.length > 0 ? 'raw-files-found' : 'needs-api-key-or-file',
  inputFiles: files,
  outputDir: path.join(PROCESSED_DIR, 'h3-education-family'),
  nextStep: 'scripts/incheon/import-education.ts가 어린이집 CSV/XLSX를 학교 데이터와 함께 H3 교육·가족 지표로 통합합니다.',
  apiKeyPolicy: 'DATA_GO_KR_SERVICE_KEY는 로컬 환경변수로만 사용하고 커밋하지 않습니다.',
  manualSource: {
    sourceId: 'childcare-basic',
    url: 'https://www.data.go.kr/data/15101154/openapi.do',
    expectedDir: rawChildcareDir,
    expectedFields: ['어린이집명/시설명', '위도', '경도', '정원', '현원'],
  },
})

console.log(`어린이집 원천 후보 ${files.length}개를 확인했습니다. H3 통합은 import-education.ts에서 수행합니다.`)
