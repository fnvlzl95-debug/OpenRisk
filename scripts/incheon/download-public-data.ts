import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { MANIFEST_DIR, RAW_DIR, ensureDir, writeJson } from './_utils'

type FileDataSource = {
  sourceId: string
  label: string
  pageUrl: string
  targetDir: string
  required: boolean
}

type RoneStatSource = {
  sourceId: string
  label: string
  statblId: string
  pageUrl: string
  targetDir: string
  required: boolean
}

const SOURCES: FileDataSource[] = [
  {
    sourceId: 'store-small-business',
    label: '소상공인시장진흥공단_상가정보',
    pageUrl: 'https://www.data.go.kr/data/15083033/fileData.do',
    targetDir: path.join(RAW_DIR, 'stores'),
    required: true,
  },
  {
    sourceId: 'incheon-bus-stops',
    label: '인천광역시_시내버스_정류소_현황',
    pageUrl: 'https://www.data.go.kr/data/15074309/fileData.do',
    targetDir: path.join(RAW_DIR, 'transit', 'bus-stops'),
    required: true,
  },
  {
    sourceId: 'national-bus-stops',
    label: '국토교통부_전국_버스정류장_위치정보',
    pageUrl: 'https://www.data.go.kr/data/15067528/fileData.do',
    targetDir: path.join(RAW_DIR, 'transit', 'national-bus-stops'),
    required: false,
  },
  {
    sourceId: 'incheon-bus-ridership',
    label: '인천광역시_정류장별_이용승객_현황',
    pageUrl: 'https://www.data.go.kr/data/15048264/fileData.do',
    targetDir: path.join(RAW_DIR, 'transit', 'bus-ridership'),
    required: true,
  },
  {
    sourceId: 'incheon-subway-ridership',
    label: '인천교통공사_역별_수송인원_현황',
    pageUrl: 'https://www.data.go.kr/data/15060441/fileData.do',
    targetDir: path.join(RAW_DIR, 'transit', 'subway-ridership'),
    required: false,
  },
  {
    sourceId: 'incheon-school-status',
    label: '인천광역시교육청_학교현황',
    pageUrl: 'https://www.data.go.kr/data/15004947/fileData.do',
    targetDir: path.join(RAW_DIR, 'education', 'school-status'),
    required: true,
  },
  {
    sourceId: 'resident-age-admin-dong',
    label: '행정안전부_행정동_성별_연령별_주민등록_인구수',
    pageUrl: 'https://www.data.go.kr/data/15097972/fileData.do',
    targetDir: path.join(RAW_DIR, 'population'),
    required: false,
  },
  {
    sourceId: 'admin-boundaries',
    label: '국가데이터처_SGIS_행정구역_통계_및_경계',
    pageUrl: 'https://www.data.go.kr/data/15129688/fileData.do',
    targetDir: path.join(RAW_DIR, 'boundaries'),
    required: false,
  },
]

const RONE_COST_SOURCES: RoneStatSource[] = [
  {
    sourceId: 'reb-small-rent',
    label: '한국부동산원_RONE_소규모상가_임대료',
    statblId: 'T248223134698125',
    pageUrl: 'https://www.reb.or.kr/r-one/portal/stat/easyStatPage/T248223134698125.do',
    targetDir: path.join(RAW_DIR, 'rent-vacancy'),
    required: false,
  },
  {
    sourceId: 'reb-small-vacancy',
    label: '한국부동산원_RONE_소규모상가_공실률',
    statblId: 'T241833134686576',
    pageUrl: 'https://www.reb.or.kr/r-one/portal/stat/easyStatPage/T241833134686576.do',
    targetDir: path.join(RAW_DIR, 'rent-vacancy'),
    required: false,
  },
]

function todayStamp() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function existingLocalFileStatus(args: { sourceId: string; pageUrl: string; targetDir: string }) {
  ensureDir(args.targetDir)
  const existing = fs.readdirSync(args.targetDir).filter((file) => file !== '.gitkeep')
  if (existing.length === 0) return null
  const filePath = path.join(args.targetDir, existing[0])
  return {
    sourceId: args.sourceId,
    status: 'skipped-existing',
    pageUrl: args.pageUrl,
    downloadUrl: null,
    filePath,
    bytes: fs.statSync(filePath).size,
  }
}

function extensionFromHeaders(headers: Headers, fallback = 'dat') {
  const disposition = headers.get('content-disposition') ?? ''
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)
  const filename = filenameMatch?.[1] ?? ''
  const extension = path.extname(filename).replace('.', '').toLowerCase()
  if (extension) return extension
  const type = headers.get('content-type') ?? ''
  if (type.includes('csv')) return 'csv'
  if (type.includes('zip')) return 'zip'
  if (type.includes('excel') || type.includes('spreadsheet')) return 'xlsx'
  return fallback
}

async function findDownloadUrl(pageUrl: string) {
  const response = await fetch(pageUrl)
  if (!response.ok) {
    throw new Error(`페이지 접근 실패: ${response.status} ${response.statusText}`)
  }
  const html = await response.text()
  const contentUrl = html.match(/"contentUrl"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\u0026/g, '&')
  if (contentUrl) return contentUrl

  const atchFileId = html.match(/atchFileId=([^&"]+)/)?.[1]
  const fileDetailSn = html.match(/fileDetailSn=([^&"]+)/)?.[1] ?? '1'
  if (atchFileId) {
    return `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=${atchFileId}&fileDetailSn=${fileDetailSn}&insertDataPrcus=N`
  }

  throw new Error('다운로드 URL을 찾지 못했습니다.')
}

async function downloadSource(source: FileDataSource) {
  ensureDir(source.targetDir)
  const existing = existingLocalFileStatus(source)
  if (existing) return existing

  const downloadUrl = await findDownloadUrl(source.pageUrl)
  const response = await fetch(downloadUrl)
  if (!response.ok || !response.body) {
    throw new Error(`파일 다운로드 실패: ${response.status} ${response.statusText}`)
  }

  const extension = extensionFromHeaders(response.headers)
  const filePath = path.join(source.targetDir, `${todayStamp()}_${source.label}.${extension}`)
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath))

  return {
    sourceId: source.sourceId,
    status: 'downloaded',
    pageUrl: source.pageUrl,
    downloadUrl,
    filePath,
    bytes: fs.statSync(filePath).size,
  }
}

async function downloadStandardOpenApiJson(args: {
  sourceId: string
  label: string
  endpoint: string
  targetDir: string
  serviceKey: string
}) {
  ensureDir(args.targetDir)
  const existing = fs.readdirSync(args.targetDir).filter((file) => file !== '.gitkeep')
  if (existing.length > 0) {
    const filePath = path.join(args.targetDir, existing[0])
    return {
      sourceId: args.sourceId,
      status: 'skipped-existing',
      pageUrl: args.endpoint,
      downloadUrl: null,
      filePath,
      bytes: fs.statSync(filePath).size,
    }
  }

  const allRows = []
  let pageNo = 1
  const numOfRows = 500
  let totalCount = Number.POSITIVE_INFINITY

  while ((pageNo - 1) * numOfRows < totalCount) {
    const url = new URL(args.endpoint)
    url.searchParams.set('ServiceKey', args.serviceKey)
    url.searchParams.set('pageNo', String(pageNo))
    url.searchParams.set('numOfRows', String(numOfRows))
    url.searchParams.set('type', 'json')
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`공공데이터 OpenAPI 실패: ${response.status} ${response.statusText}`)
    }
    const payload = await response.json() as {
      response?: {
        header?: { resultCode?: string; resultMsg?: string }
        body?: { items?: unknown[] | { item?: unknown[] }; totalCount?: number }
      }
    }
    const header = payload.response?.header
    if (header?.resultCode && header.resultCode !== '00') {
      throw new Error(`공공데이터 OpenAPI 실패: ${header.resultCode} ${header.resultMsg ?? ''}`.trim())
    }
    const items = payload.response?.body?.items
    const rows = Array.isArray(items) ? items : Array.isArray(items?.item) ? items.item : []
    allRows.push(...rows)
    totalCount = Number(payload.response?.body?.totalCount ?? allRows.length)
    if (rows.length === 0) break
    pageNo += 1
  }

  const filePath = path.join(args.targetDir, `${todayStamp()}_${args.label}.json`)
  fs.writeFileSync(filePath, `${JSON.stringify({ data: allRows }, null, 2)}\n`, 'utf8')
  return {
    sourceId: args.sourceId,
    status: 'downloaded',
    pageUrl: args.endpoint,
    downloadUrl: args.endpoint,
    filePath,
    bytes: fs.statSync(filePath).size,
  }
}

async function postRoneJson<T>(url: string, body: string, referer: string): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': 'https://www.reb.or.kr',
      'Referer': referer,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  })
  if (!response.ok) {
    throw new Error(`R-ONE 요청 실패: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

async function downloadRoneStatJson(source: RoneStatSource) {
  ensureDir(source.targetDir)
  const existing = fs.readdirSync(source.targetDir).filter((file) => file.includes(source.sourceId) && file.endsWith('.json'))
  if (existing.length > 0) {
    const filePath = path.join(source.targetDir, existing[0])
    return {
      sourceId: source.sourceId,
      status: 'skipped-existing',
      pageUrl: source.pageUrl,
      downloadUrl: source.pageUrl,
      filePath,
      bytes: fs.statSync(filePath).size,
    }
  }

  const pageResponse = await fetch(source.pageUrl)
  if (!pageResponse.ok) {
    throw new Error(`R-ONE 페이지 접근 실패: ${pageResponse.status} ${pageResponse.statusText}`)
  }
  const html = await pageResponse.text()
  const firParam = html.match(/id="firParam"[^>]*value="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&')
  if (!firParam) {
    throw new Error('R-ONE 기본 조회 파라미터를 찾지 못했습니다.')
  }
  const body = `${firParam}&searchType=S`
  const target = await postRoneJson<{
    data?: { Cols?: unknown[]; Text?: unknown[]; statCond?: unknown }
  }>('https://www.reb.or.kr/r-one/portal/stat/statTargetItmList.do', body, source.pageUrl)
  const preview = await postRoneJson<{ DATA?: unknown[] }>(
    'https://www.reb.or.kr/r-one/portal/stat/sttsDataPreviewList.do',
    body,
    source.pageUrl
  )
  const rows = Array.isArray(preview.DATA) ? preview.DATA : []
  if (rows.length === 0) {
    throw new Error('R-ONE 표 데이터가 비어 있습니다.')
  }

  const filePath = path.join(source.targetDir, `${todayStamp()}_${source.sourceId}_${source.label}.json`)
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        sourceId: source.sourceId,
        label: source.label,
        statblId: source.statblId,
        pageUrl: source.pageUrl,
        downloadedAt: new Date().toISOString(),
        requestParams: firParam,
        columns: target.data?.Cols ?? [],
        headerText: target.data?.Text ?? [],
        statCond: target.data?.statCond ?? null,
        data: rows,
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  return {
    sourceId: source.sourceId,
    status: 'downloaded',
    pageUrl: source.pageUrl,
    downloadUrl: 'https://www.reb.or.kr/r-one/portal/stat/sttsDataPreviewList.do',
    filePath,
    bytes: fs.statSync(filePath).size,
  }
}

async function main() {
  const downloaded = []
  const blocked = []

  for (const source of SOURCES) {
    try {
      console.log(`다운로드: ${source.sourceId}`)
      downloaded.push(await downloadSource(source))
    } catch (error) {
      blocked.push({
        sourceId: source.sourceId,
        required: source.required,
        pageUrl: source.pageUrl,
        targetDir: source.targetDir,
        reason: error instanceof Error ? error.message : 'unknown error',
      })
      console.warn(`실패: ${source.sourceId}`)
    }
  }

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY
  const schoolLocationTarget = path.join(RAW_DIR, 'education', 'school-location')
  const childcareTarget = path.join(RAW_DIR, 'childcare')
  const existingSchoolLocation = existingLocalFileStatus({
    sourceId: 'school-location-standard',
    pageUrl: 'https://www.data.go.kr/data/15021148/standard.do',
    targetDir: schoolLocationTarget,
  })
  const existingChildcare = existingLocalFileStatus({
    sourceId: 'childcare-basic',
    pageUrl: 'https://www.data.go.kr/data/15101154/openapi.do',
    targetDir: childcareTarget,
  })

  if (!serviceKey) {
    if (existingSchoolLocation) downloaded.push(existingSchoolLocation)
    else {
      blocked.push({
        sourceId: 'school-location-standard',
        required: true,
        pageUrl: 'https://www.data.go.kr/data/15021148/standard.do',
        targetDir: schoolLocationTarget,
        reason: 'DATA_GO_KR_SERVICE_KEY 환경변수가 없어 전국초중등학교위치표준데이터 API 수집을 건너뜁니다.',
      })
    }
    if (existingChildcare) downloaded.push(existingChildcare)
    else {
      blocked.push({
        sourceId: 'childcare-basic',
        required: true,
        pageUrl: 'https://www.data.go.kr/data/15101154/openapi.do',
        targetDir: childcareTarget,
        reason: 'DATA_GO_KR_SERVICE_KEY 환경변수가 없어 어린이집 OpenAPI 자동 수집을 건너뜁니다.',
      })
    }
  } else {
    if (existingSchoolLocation) downloaded.push(existingSchoolLocation)
    else {
      try {
        console.log('다운로드: school-location-standard')
        downloaded.push(await downloadStandardOpenApiJson({
          sourceId: 'school-location-standard',
          label: '전국초중등학교위치표준데이터',
          endpoint: 'https://api.data.go.kr/openapi/tn_pubr_public_elesch_mskul_lc_api',
          targetDir: schoolLocationTarget,
          serviceKey,
        }))
      } catch (error) {
        blocked.push({
          sourceId: 'school-location-standard',
          required: true,
          pageUrl: 'https://www.data.go.kr/data/15021148/standard.do',
          targetDir: schoolLocationTarget,
          reason: error instanceof Error ? error.message : 'unknown error',
        })
      }
    }
    if (existingChildcare) downloaded.push(existingChildcare)
    else {
      blocked.push({
        sourceId: 'childcare-basic',
        required: true,
        pageUrl: 'https://www.data.go.kr/data/15101154/openapi.do',
        targetDir: childcareTarget,
        reason: '어린이집 OpenAPI는 별도 호출 파라미터 확인이 필요합니다. CSV/XLSX 추출본을 raw/childcare에 두면 import-education.ts가 반영합니다.',
      })
    }
  }

  for (const source of RONE_COST_SOURCES) {
    try {
      console.log(`다운로드: ${source.sourceId}`)
      downloaded.push(await downloadRoneStatJson(source))
    } catch (error) {
      blocked.push({
        sourceId: source.sourceId,
        required: source.required,
        pageUrl: source.pageUrl,
        targetDir: source.targetDir,
        reason: error instanceof Error ? error.message : 'unknown error',
      })
      console.warn(`실패: ${source.sourceId}`)
    }
  }

  writeJson(path.join(MANIFEST_DIR, 'download-status.json'), {
    updatedAt: new Date().toISOString(),
    downloaded,
    blocked,
  })
  writeJson(path.join(MANIFEST_DIR, 'blocked-downloads.json'), {
    updatedAt: new Date().toISOString(),
    blocked,
  })

  console.log(`완료: downloaded ${downloaded.length}, blocked ${blocked.length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
