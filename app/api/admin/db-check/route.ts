/**
 * DB 데이터 확인 및 패치 API
 * GET: 현재 DB 데이터 상태 확인
 * POST: 누락된 카테고리 데이터 추가 및 weekend_ratio 수정
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { BUSINESS_CATEGORIES, BusinessCategory } from '@/lib/categories'

// DB에 있어야 하는 모든 카테고리 키
const ALL_CATEGORIES = Object.keys(BUSINESS_CATEGORIES) as BusinessCategory[]

export async function GET() {
  try {
    const supabase = getSupabase()

    // 1. grid_store_counts 테이블에서 store_counts 필드의 카테고리 확인
    const { data: storeData, error: storeError } = await supabase
      .from('grid_store_counts')
      .select('h3_id, store_counts, region')
      .limit(100)

    if (storeError) {
      return NextResponse.json({ error: storeError.message }, { status: 500 })
    }

    // 2. 어떤 카테고리들이 존재하는지 확인
    const existingCategories = new Set<string>()
    const sampleStoreCounts: Record<string, number>[] = []

    for (const row of storeData || []) {
      const counts = row.store_counts || {}
      Object.keys(counts).forEach(key => existingCategories.add(key))
      if (sampleStoreCounts.length < 5) {
        sampleStoreCounts.push(counts)
      }
    }

    // 3. 누락된 카테고리 확인
    const missingCategories = ALL_CATEGORIES.filter(cat => !existingCategories.has(cat))

    // 4. grid_traffic 테이블에서 weekend_ratio 확인
    const { data: trafficData, error: trafficError } = await supabase
      .from('grid_traffic')
      .select('h3_id, weekend_ratio, traffic_estimated, traffic_morning, traffic_day, traffic_night')
      .limit(50)

    if (trafficError) {
      return NextResponse.json({ error: trafficError.message }, { status: 500 })
    }

    // 5. weekend_ratio 분포 확인
    const weekendRatioDistribution: Record<string, number> = {}
    let invalidWeekendRatioCount = 0

    for (const row of trafficData || []) {
      const ratio = row.weekend_ratio
      const key = ratio === null ? 'null' : String(ratio)
      weekendRatioDistribution[key] = (weekendRatioDistribution[key] || 0) + 1

      // 1이상이면 잘못된 데이터
      if (ratio !== null && ratio >= 1) {
        invalidWeekendRatioCount++
      }
    }

    // 6. 전체 레코드 수
    const { count: storeCount } = await supabase
      .from('grid_store_counts')
      .select('*', { count: 'exact', head: true })

    const { count: trafficCount } = await supabase
      .from('grid_traffic')
      .select('*', { count: 'exact', head: true })

    // 7. traffic_estimated 통계 (분포 확인용)
    // 0이 아닌 데이터만 조회하여 실제 분포 파악
    const { data: trafficStats } = await supabase
      .from('grid_traffic')
      .select('traffic_estimated')
      .gt('traffic_estimated', 0)
      .order('traffic_estimated', { ascending: true })
      .limit(10000)

    let trafficDistribution = {
      min: 0,
      max: 0,
      p20: 0,  // 하위 20%
      p50: 0,  // 중간값
      p80: 0,  // 상위 20%
      nonZeroCount: 0,
      zeroCount: 0,
    }

    if (trafficStats && trafficStats.length > 0) {
      const values = trafficStats.map(r => r.traffic_estimated || 0)
      const nonZero = values.filter(v => v > 0)

      trafficDistribution = {
        min: Math.min(...values),
        max: Math.max(...values),
        p20: values[Math.floor(values.length * 0.2)] || 0,
        p50: values[Math.floor(values.length * 0.5)] || 0,
        p80: values[Math.floor(values.length * 0.8)] || 0,
        nonZeroCount: nonZero.length,
        zeroCount: values.length - nonZero.length,
      }
    }

    return NextResponse.json({
      summary: {
        totalStoreRecords: storeCount,
        totalTrafficRecords: trafficCount,
      },
      storeCategories: {
        existing: Array.from(existingCategories).sort(),
        missing: missingCategories,
        allRequired: ALL_CATEGORIES,
        sampleData: sampleStoreCounts.slice(0, 3),
      },
      trafficData: {
        weekendRatioDistribution,
        invalidWeekendRatioCount,
        distribution: trafficDistribution,
        sampleData: (trafficData || []).slice(0, 5).map(r => ({
          h3_id: r.h3_id,
          weekend_ratio: r.weekend_ratio,
          traffic_estimated: r.traffic_estimated,
        })),
      },
      recommendations: {
        needsCategoryPatch: missingCategories.length > 0,
        needsWeekendRatioPatch: invalidWeekendRatioCount > 0,
      }
    })
  } catch (error) {
    console.error('DB check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: 데이터 패치 실행
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, offset = 0, limit = 5000 } = body

    const supabase = getSupabase()
    const results: Record<string, unknown> = {}

    // 1. 누락된 카테고리 초기화 (0으로 채우기)
    if (action === 'patch_categories' || action === 'patch_all') {
      // 페이지네이션으로 레코드 가져오기
      const { data: allStores, error } = await supabase
        .from('grid_store_counts')
        .select('h3_id, store_counts')
        .range(offset, offset + limit - 1)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      let updatedCount = 0
      const updates: Array<{ h3_id: string; store_counts: Record<string, number> }> = []

      for (const row of allStores || []) {
        const counts = row.store_counts || {}
        let needsUpdate = false
        const newCounts = { ...counts }

        // 누락된 카테고리를 0으로 초기화
        for (const cat of ALL_CATEGORIES) {
          if (!(cat in newCounts)) {
            newCounts[cat] = 0
            needsUpdate = true
          }
        }

        if (needsUpdate) {
          updates.push({ h3_id: row.h3_id, store_counts: newCounts })
          updatedCount++
        }
      }

      // 배치 업데이트 (100개씩 병렬 처리)
      const BATCH_SIZE = 100
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(update =>
            supabase
              .from('grid_store_counts')
              .update({ store_counts: update.store_counts })
              .eq('h3_id', update.h3_id)
          )
        )
      }

      results.categoryPatch = {
        totalRecords: allStores?.length || 0,
        updatedRecords: updatedCount,
        offset,
        nextOffset: (allStores?.length || 0) === limit ? offset + limit : null,
        status: 'completed'
      }
    }

    // 2. weekend_ratio 수정 (1 이상인 값을 적절한 값으로 변환)
    if (action === 'patch_weekend_ratio' || action === 'patch_all') {
      // 잘못된 weekend_ratio 레코드 찾기 (페이지네이션)
      const { data: invalidRatios, error } = await supabase
        .from('grid_traffic')
        .select('h3_id, weekend_ratio, traffic_morning, traffic_day, traffic_night')
        .gte('weekend_ratio', 1)
        .range(offset, offset + limit - 1)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const updates: Array<{ h3_id: string; weekend_ratio: number }> = []

      for (const row of invalidRatios || []) {
        // 시간대별 패턴을 기반으로 weekend_ratio 추정
        // 야간 비중이 높으면 주말 비중도 높을 가능성
        const morning = row.traffic_morning || 33
        const day = row.traffic_day || 34
        const night = row.traffic_night || 33

        // 야간 비중 기반 추정 (33% 기준, 40% 이상이면 주말 비중 높음)
        let estimatedRatio = 0.3 // 기본값
        if (night > 40) {
          estimatedRatio = 0.4 + (night - 40) * 0.01 // 야간형은 주말 비중 높음
        } else if (morning > 40) {
          estimatedRatio = 0.25 // 출근형은 주말 비중 낮음
        }

        // 0.2 ~ 0.6 범위로 제한
        estimatedRatio = Math.max(0.2, Math.min(0.6, estimatedRatio))
        updates.push({ h3_id: row.h3_id, weekend_ratio: estimatedRatio })
      }

      // 배치 업데이트 (100개씩 병렬 처리)
      let updatedCount = 0
      const BATCH_SIZE = 100
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map(update =>
            supabase
              .from('grid_traffic')
              .update({ weekend_ratio: update.weekend_ratio })
              .eq('h3_id', update.h3_id)
          )
        )
        updatedCount += results.filter(r => !r.error).length
      }

      results.weekendRatioPatch = {
        invalidRecords: invalidRatios?.length || 0,
        updatedRecords: updatedCount,
        offset,
        nextOffset: (invalidRatios?.length || 0) === limit ? offset + limit : null,
        status: 'completed'
      }
    }

    return NextResponse.json({
      success: true,
      action,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('DB patch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
