/**
 * 소상공인 CSV 데이터를 H3 그리드별로 집계해서 DB에 업데이트
 *
 * POST /api/admin/import-stores
 * body: { region: '서울' | '경기' | '인천', dryRun?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { BusinessCategory } from '@/lib/categories'
import * as h3 from 'h3-js'
import * as fs from 'fs'
import * as path from 'path'

// CSV 상권업종소분류명 -> 우리 카테고리 매핑
const CATEGORY_MAPPING: Record<string, BusinessCategory> = {
  // 카페/베이커리
  '카페': 'cafe',
  '커피 전문점': 'cafe',
  '커피전문점': 'cafe',
  '빵/도넛': 'bakery',
  '제과점': 'bakery',
  '아이스크림': 'dessert',
  '케이크': 'dessert',
  '디저트카페': 'dessert',

  // 음식점 - 한식
  '백반/한정식': 'restaurant_korean',
  '국/탕/찌개': 'restaurant_korean',
  '국/탕/찌개류': 'restaurant_korean',
  '해물요리': 'restaurant_korean',
  '육류요리': 'restaurant_korean',
  '한식': 'restaurant_korean',
  '죽/스프': 'restaurant_korean',
  '김밥/만두/분식': 'restaurant_korean',
  '돼지고기 구이/찜': 'restaurant_korean',
  '소고기 구이/찜': 'restaurant_korean',
  '닭고기 구이/찜': 'restaurant_korean',
  '곱창/막창': 'restaurant_korean',
  '족발/보쌈': 'restaurant_korean',
  '냉면': 'restaurant_korean',
  '국밥': 'restaurant_korean',
  '삼계탕': 'restaurant_korean',
  '샤브샤브': 'restaurant_korean',
  '전/부침개': 'restaurant_korean',
  '두부요리': 'restaurant_korean',
  '오리고기 요리': 'restaurant_korean',

  // 음식점 - 양식
  '양식': 'restaurant_western',
  '경양식': 'restaurant_western',
  '이탈리아 음식': 'restaurant_western',
  '패밀리 레스토랑': 'restaurant_western',
  '스테이크': 'restaurant_western',
  '파스타/피자': 'restaurant_western',
  '브런치': 'restaurant_western',
  '샐러드 전문점': 'restaurant_western',
  '멕시칸 음식': 'restaurant_western',

  // 음식점 - 일식
  '일식 회/초밥': 'restaurant_japanese',
  '일식 튀김/꼬치': 'restaurant_japanese',
  '일식': 'restaurant_japanese',
  '라멘': 'restaurant_japanese',
  '우동/소바': 'restaurant_japanese',
  '돈카츠': 'restaurant_japanese',
  '일본식 주점': 'restaurant_japanese',

  // 음식점 - 중식
  '중식': 'restaurant_chinese',
  '중국집': 'restaurant_chinese',
  '중국음식': 'restaurant_chinese',
  '만두': 'restaurant_chinese',

  // 치킨
  '치킨': 'restaurant_chicken',
  '닭강정': 'restaurant_chicken',

  // 피자
  '피자': 'restaurant_pizza',

  // 패스트푸드
  '햄버거': 'restaurant_fastfood',
  '샌드위치': 'restaurant_fastfood',
  '패스트푸드': 'restaurant_fastfood',
  '핫도그': 'restaurant_fastfood',

  // 주점
  '요리 주점': 'bar',
  '호프/맥주': 'bar',
  '포장마차': 'bar',
  '와인바': 'bar',
  '칵테일바': 'bar',
  '주점': 'bar',
  '이자카야': 'bar',

  // 편의점/마트
  '편의점': 'convenience',
  '슈퍼마켓': 'mart',
  '식료품점': 'mart',

  // 서비스
  '미용실': 'beauty',
  '남성 미용실': 'beauty',
  '헤어샵': 'beauty',
  '네일숍': 'nail',
  '네일아트': 'nail',
  '세탁소': 'laundry',
  '셀프빨래방': 'laundry',
  '약국': 'pharmacy',

  // 기타
  '헬스클럽': 'gym',
  '헬스장': 'gym',
  '피트니스': 'gym',
  '요가/필라테스 학원': 'gym',
  '스포츠센터': 'gym',
  '입시·교과학원': 'academy',
  '외국어학원': 'academy',
  '예체능학원': 'academy',
  '직업/기술 학원': 'academy',
  '자격증 학원': 'academy',
  '운전학원': 'academy',
}

// CSV 파싱 (간단한 버전)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { region, dryRun = false } = body as { region: string; dryRun?: boolean }

    // 파일 경로
    const fileMap: Record<string, string> = {
      '서울': '소상공인시장진흥공단_상가(상권)정보_서울_202510.csv',
      '경기': '소상공인시장진흥공단_상가(상권)정보_경기_202510.csv',
      '인천': '소상공인시장진흥공단_상가(상권)정보_인천_202510.csv',
    }

    const fileName = fileMap[region]
    if (!fileName) {
      return NextResponse.json({ error: `Unknown region: ${region}` }, { status: 400 })
    }

    const filePath = path.join(process.cwd(), 'data', fileName)
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `File not found: ${filePath}` }, { status: 404 })
    }

    // CSV 읽기
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const headers = parseCSVLine(lines[0])

    // 헤더 인덱스 찾기
    const categoryIdx = headers.indexOf('상권업종소분류명')
    const latIdx = headers.indexOf('위도')
    const lngIdx = headers.indexOf('경도')

    if (categoryIdx === -1 || latIdx === -1 || lngIdx === -1) {
      return NextResponse.json({
        error: 'Required columns not found',
        headers
      }, { status: 400 })
    }

    // H3 그리드별 집계
    const gridCounts: Record<string, Record<BusinessCategory, number>> = {}
    let totalProcessed = 0
    let totalMapped = 0
    let totalSkipped = 0
    const unmappedCategories: Record<string, number> = {}

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const fields = parseCSVLine(line)
      const category = fields[categoryIdx]
      const lat = parseFloat(fields[latIdx])
      const lng = parseFloat(fields[lngIdx])

      if (isNaN(lat) || isNaN(lng)) {
        totalSkipped++
        continue
      }

      totalProcessed++

      // 카테고리 매핑
      const mappedCategory = CATEGORY_MAPPING[category]
      if (!mappedCategory) {
        unmappedCategories[category] = (unmappedCategories[category] || 0) + 1
        continue
      }

      totalMapped++

      // H3 인덱스 계산 (resolution 9)
      const h3Index = h3.latLngToCell(lat, lng, 9)

      // 그리드별 카운트
      if (!gridCounts[h3Index]) {
        gridCounts[h3Index] = {} as Record<BusinessCategory, number>
      }
      gridCounts[h3Index][mappedCategory] = (gridCounts[h3Index][mappedCategory] || 0) + 1
    }

    // 상위 미매핑 카테고리
    const topUnmapped = Object.entries(unmappedCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        region,
        stats: {
          totalLines: lines.length - 1,
          totalProcessed,
          totalMapped,
          totalSkipped,
          uniqueGrids: Object.keys(gridCounts).length,
        },
        topUnmapped,
        sampleGrids: Object.entries(gridCounts).slice(0, 5).map(([h3Id, counts]) => ({
          h3Id,
          counts,
        })),
      })
    }

    // DB 업데이트
    const supabase = getSupabase()
    let updatedCount = 0
    const insertedCount = 0
    let errorCount = 0

    const h3Ids = Object.keys(gridCounts)
    const BATCH_SIZE = 100

    for (let i = 0; i < h3Ids.length; i += BATCH_SIZE) {
      const batch = h3Ids.slice(i, i + BATCH_SIZE)

      for (const h3Id of batch) {
        const newCounts = gridCounts[h3Id]

        // 기존 레코드 조회
        const { data: existing } = await supabase
          .from('grid_store_counts')
          .select('h3_id, store_counts')
          .eq('h3_id', h3Id)
          .single()

        if (existing) {
          // 기존 데이터에 새 카운트 병합
          const mergedCounts = { ...existing.store_counts }
          for (const [cat, count] of Object.entries(newCounts)) {
            mergedCounts[cat] = count
          }

          const { error } = await supabase
            .from('grid_store_counts')
            .update({ store_counts: mergedCounts })
            .eq('h3_id', h3Id)

          if (error) {
            errorCount++
          } else {
            updatedCount++
          }
        } else {
          // 새 레코드 생성은 하지 않음 (기존 그리드만 업데이트)
          // 필요하다면 insert 로직 추가
        }
      }
    }

    return NextResponse.json({
      success: true,
      region,
      stats: {
        totalLines: lines.length - 1,
        totalProcessed,
        totalMapped,
        totalSkipped,
        uniqueGrids: h3Ids.length,
        updatedCount,
        insertedCount,
        errorCount,
      },
      topUnmapped,
    })

  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET: 현재 매핑 정보 조회
export async function GET() {
  return NextResponse.json({
    categoryMapping: CATEGORY_MAPPING,
    totalMappings: Object.keys(CATEGORY_MAPPING).length,
    categories: [...new Set(Object.values(CATEGORY_MAPPING))].sort(),
  })
}
