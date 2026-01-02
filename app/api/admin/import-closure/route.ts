/**
 * 폐업률 데이터를 DB에 업로드
 *
 * POST /api/admin/import-closure
 * body: { dryRun?: boolean }
 *
 * closure_update.json 파일을 읽어서 grid_store_counts 테이블 업데이트
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

interface ClosureData {
  h3_id: string
  closure_count: number
  opening_count: number
  prev_period_count: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { dryRun = false } = body as { dryRun?: boolean }

    // closure_update.json 파일 읽기
    const filePath = path.join(process.cwd(), 'data', 'closure_update.json')
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `File not found: ${filePath}` },
        { status: 404 }
      )
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    const closureData: ClosureData[] = JSON.parse(content)

    console.log(`Loaded ${closureData.length} closure records`)

    if (dryRun) {
      // 샘플 데이터 반환
      const sample = closureData.slice(0, 10)
      const stats = {
        totalRecords: closureData.length,
        totalClosed: closureData.reduce((sum, d) => sum + d.closure_count, 0),
        totalOpened: closureData.reduce((sum, d) => sum + d.opening_count, 0),
        avgClosureRate:
          closureData.reduce(
            (sum, d) =>
              sum +
              (d.prev_period_count > 0
                ? d.closure_count / d.prev_period_count
                : 0),
            0
          ) / closureData.length,
      }

      return NextResponse.json({
        dryRun: true,
        stats,
        sample,
      })
    }

    // DB 업데이트
    const supabase = getSupabase()
    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0
    const errors: string[] = []

    const BATCH_SIZE = 100

    for (let i = 0; i < closureData.length; i += BATCH_SIZE) {
      const batch = closureData.slice(i, i + BATCH_SIZE)

      // 배치 upsert
      const upsertData = batch.map((d) => ({
        h3_id: d.h3_id,
        closure_count: d.closure_count,
        opening_count: d.opening_count,
        prev_period_count: d.prev_period_count,
      }))

      // 먼저 기존 레코드가 있는지 확인
      const h3Ids = batch.map((d) => d.h3_id)
      const { data: existingRecords } = await supabase
        .from('grid_store_counts')
        .select('h3_id')
        .in('h3_id', h3Ids)

      const existingIds = new Set(existingRecords?.map((r) => r.h3_id) || [])

      // 기존 레코드만 업데이트 (새 레코드는 생성하지 않음)
      for (const d of batch) {
        if (existingIds.has(d.h3_id)) {
          const { error } = await supabase
            .from('grid_store_counts')
            .update({
              closure_count: d.closure_count,
              opening_count: d.opening_count,
              prev_period_count: d.prev_period_count,
            })
            .eq('h3_id', d.h3_id)

          if (error) {
            errorCount++
            if (errors.length < 10) {
              errors.push(`Update ${d.h3_id}: ${error.message}`)
            }
          } else {
            updatedCount++
          }
        } else {
          // 기존 레코드가 없는 H3는 스킵 (점포 데이터 없이 폐업률만 있는 경우)
          skippedCount++
        }
      }

      // 진행률 로그
      if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= closureData.length) {
        console.log(
          `Progress: ${Math.min(i + BATCH_SIZE, closureData.length)}/${closureData.length}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRecords: closureData.length,
        updatedCount,
        skippedCount,
        errorCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Import closure error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET: 현재 폐업률 데이터 상태 확인
export async function GET() {
  try {
    const supabase = getSupabase()

    // closure_count가 있는 레코드 수 확인
    const { count: withClosure } = await supabase
      .from('grid_store_counts')
      .select('*', { count: 'exact', head: true })
      .gt('closure_count', 0)

    // 전체 레코드 수
    const { count: total } = await supabase
      .from('grid_store_counts')
      .select('*', { count: 'exact', head: true })

    // 샘플 데이터
    const { data: sample } = await supabase
      .from('grid_store_counts')
      .select('h3_id, closure_count, opening_count, prev_period_count')
      .gt('closure_count', 0)
      .limit(5)

    return NextResponse.json({
      stats: {
        totalRecords: total,
        withClosureData: withClosure,
      },
      sample,
    })
  } catch (error) {
    console.error('Get closure stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
