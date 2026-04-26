import path from 'path'
import { PROCESSED_DIR, RAW_DIR, listFiles, report } from './_utils'

const rawEducationDir = path.join(RAW_DIR, 'education')
const files = listFiles(rawEducationDir).filter((file) => /\.(csv|xlsx|json)$/i.test(file))
const locationFiles = files.filter((file) => /location|위치|school/i.test(path.basename(file)))
const statusFiles = files.filter((file) => /status|현황|student|학생/i.test(path.basename(file)))

report('education-import-report.json', {
  status: locationFiles.length > 0 && statusFiles.length > 0 ? 'ready-for-join' : 'needs-source-file',
  locationFiles,
  statusFiles,
  outputDir: path.join(PROCESSED_DIR, 'h3-education-family'),
  joinRule: '학교명, 학교급, 주소, 가능하면 학교ID로 위치와 학생 규모를 조인합니다.',
  confidenceRules: {
    high: '위치 데이터 있음 + 학생수 조인 성공',
    medium: '위치 데이터 있음 + 학생수 조인 실패',
    low: '학생수 있음 + 좌표 없음',
  },
})

console.log(`교육 원천 후보 ${files.length}개를 확인했습니다.`)
