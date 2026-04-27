import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse'
import iconv from 'iconv-lite'
import { latLngToCell } from 'h3-js'
import type { BusinessCategory } from '../../lib/categories'
import { INCHEON_H3_RESOLUTION } from '../../lib/incheon/constants'
import { PROCESSED_DIR, RAW_DIR, detectTextEncoding, distributionStats, ensureDir, listFilesRecursive, pickField, report, writeJson } from './_utils'

const rawStoresDir = path.join(RAW_DIR, 'stores')
const outputFile = path.join(PROCESSED_DIR, 'h3-store-counts', 'store-counts-h3.json')

const CATEGORY_MAPPING: Record<string, BusinessCategory> = {
  '카페': 'cafe',
  '커피 전문점': 'cafe',
  '커피전문점': 'cafe',
  '비알코올 음료점': 'cafe',
  '제과점': 'bakery',
  '빵/도넛': 'bakery',
  '디저트카페': 'dessert',
  '아이스크림': 'dessert',
  '케이크': 'dessert',
  '한식': 'restaurant_korean',
  '한식 일반 음식점': 'restaurant_korean',
  '백반/한정식': 'restaurant_korean',
  '국/탕/찌개류': 'restaurant_korean',
  '김밥/만두/분식': 'restaurant_korean',
  '양식': 'restaurant_western',
  '서양식 음식점업': 'restaurant_western',
  '경양식': 'restaurant_western',
  '파스타/피자': 'restaurant_western',
  '일식': 'restaurant_japanese',
  '일식 음식점업': 'restaurant_japanese',
  '일식 회/초밥': 'restaurant_japanese',
  '중식': 'restaurant_chinese',
  '중식 음식점업': 'restaurant_chinese',
  '중국집': 'restaurant_chinese',
  '치킨': 'restaurant_chicken',
  '치킨 전문점': 'restaurant_chicken',
  '피자': 'restaurant_pizza',
  '피자 전문점': 'restaurant_pizza',
  '패스트푸드': 'restaurant_fastfood',
  '햄버거': 'restaurant_fastfood',
  '요리 주점': 'bar',
  '호프/맥주': 'bar',
  '주점': 'bar',
  '편의점': 'convenience',
  '슈퍼마켓': 'mart',
  '식료품점': 'mart',
  '미용실': 'beauty',
  '남성 미용실': 'beauty',
  '네일숍': 'nail',
  '네일아트': 'nail',
  '세탁소': 'laundry',
  '셀프빨래방': 'laundry',
  '약국': 'pharmacy',
  '헬스클럽': 'gym',
  '헬스장': 'gym',
  '피트니스': 'gym',
  '입시·교과학원': 'academy',
  '외국어학원': 'academy',
  '예체능학원': 'academy',
  '기타 교육기관': 'academy',
}

function mapCategory(record: Record<string, string>) {
  const fields = [
    pickField(record, ['상권업종소분류명', '상권업종소분류', '상권업종중분류명']),
    pickField(record, ['상권업종중분류명']),
    pickField(record, ['상권업종대분류명']),
  ].filter(Boolean)

  for (const field of fields) {
    if (CATEGORY_MAPPING[field]) return CATEGORY_MAPPING[field]
    const fuzzy = Object.entries(CATEGORY_MAPPING).find(([label]) => field.includes(label) || label.includes(field))
    if (fuzzy) return fuzzy[1]
  }
  return null
}

async function processCsv(filePath: string) {
  const gridCounts: Record<string, { totalStores: number; categoryCounts: Partial<Record<BusinessCategory, number>> }> = {}
  const unmappedCategories: Record<string, number> = {}
  let processed = 0
  let mapped = 0
  let skipped = 0

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(iconv.decodeStream(detectTextEncoding(filePath)))
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true }))
      .on('data', (record: Record<string, string>) => {
        const sido = pickField(record, ['시도명', '시도', '광역시도'])
        if (sido && !sido.includes('인천')) return

        const lat = Number(pickField(record, ['위도', 'lat', 'latitude']))
        const lng = Number(pickField(record, ['경도', 'lng', 'lon', 'longitude']))
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          skipped += 1
          return
        }

        processed += 1
        const category = mapCategory(record)
        if (!category) {
          const rawCategory = pickField(record, ['상권업종소분류명', '상권업종중분류명']) || 'unknown'
          unmappedCategories[rawCategory] = (unmappedCategories[rawCategory] ?? 0) + 1
          return
        }

        mapped += 1
        const h3Id = latLngToCell(lat, lng, INCHEON_H3_RESOLUTION)
        gridCounts[h3Id] ??= { totalStores: 0, categoryCounts: {} }
        gridCounts[h3Id].totalStores += 1
        gridCounts[h3Id].categoryCounts[category] = (gridCounts[h3Id].categoryCounts[category] ?? 0) + 1
      })
      .on('error', reject)
      .on('end', resolve)
  })

  return { gridCounts, unmappedCategories, stats: { processed, mapped, skipped } }
}

async function main() {
  const allCsvFiles = listFilesRecursive(rawStoresDir).filter((file) => /\.(csv)$/i.test(file))
  const incheonCsvFiles = allCsvFiles.filter((file) => path.basename(file).includes('인천'))
  const candidates = incheonCsvFiles.length > 0 ? incheonCsvFiles : allCsvFiles
  const zipFiles = listFilesRecursive(rawStoresDir).filter((file) => /\.zip$/i.test(file))

  if (candidates.length === 0) {
    report('stores-import-report.json', {
      status: 'needs-source-file',
      message: zipFiles.length > 0 ? 'ZIP 파일을 찾았지만 CSV 추출이 필요합니다.' : '인천 소상공인 상가정보 CSV가 필요합니다.',
      zipFiles,
      expectedDir: rawStoresDir,
      outputFile,
    })
    console.log('인천 소상공인 상가정보 CSV가 아직 없습니다.')
    return
  }

  const mergedCells: Record<string, { totalStores: number; categoryCounts: Partial<Record<BusinessCategory, number>> }> = {}
  const unmappedCategories: Record<string, number> = {}
  const fileStats = []

  for (const file of candidates) {
    console.log(`상가정보 파싱: ${file}`)
    const result = await processCsv(file)
    fileStats.push({ file, ...result.stats })
    for (const [h3Id, cell] of Object.entries(result.gridCounts)) {
      mergedCells[h3Id] ??= { totalStores: 0, categoryCounts: {} }
      mergedCells[h3Id].totalStores += cell.totalStores
      for (const [category, count] of Object.entries(cell.categoryCounts)) {
        const key = category as BusinessCategory
        mergedCells[h3Id].categoryCounts[key] = (mergedCells[h3Id].categoryCounts[key] ?? 0) + (count ?? 0)
      }
    }
    for (const [category, count] of Object.entries(result.unmappedCategories)) {
      unmappedCategories[category] = (unmappedCategories[category] ?? 0) + count
    }
  }

  const categories = Array.from(new Set(Object.values(CATEGORY_MAPPING)))
  const categoryStats = Object.fromEntries(
    categories.map((category) => [
      category,
      distributionStats(Object.values(mergedCells).map((cell) => cell.categoryCounts[category] ?? 0)),
    ])
  )

  ensureDir(path.dirname(outputFile))
  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    h3Resolution: INCHEON_H3_RESOLUTION,
    sourceIds: ['store-small-business'],
    dataPeriod: 'official-file',
    cells: mergedCells,
    categoryStats,
    totalStats: distributionStats(Object.values(mergedCells).map((cell) => cell.totalStores)),
  })

  report('stores-import-report.json', {
    status: 'ready',
    inputFiles: candidates,
    outputFile,
    cells: Object.keys(mergedCells).length,
    fileStats,
    topUnmappedCategories: Object.entries(unmappedCategories).sort((a, b) => b[1] - a[1]).slice(0, 30),
  })

  console.log(`상가정보 H3 셀 ${Object.keys(mergedCells).length}개 생성`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
