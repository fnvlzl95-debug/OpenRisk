import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization for Supabase client
let supabaseInstance: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }

  supabaseInstance = createClient(url, key)
  return supabaseInstance
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 1) {
    return NextResponse.json([])
  }

  try {
    const supabase = getSupabase()

    // 상권명 검색
    const { data: areas, error } = await supabase
      .from('trade_areas')
      .select('id, name, district')
      .or(`name.ilike.%${q}%,district.ilike.%${q}%`)
      .order('name')
      .limit(8)

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json([])
    }

    const results = (areas || []).map(area => ({
      id: area.id,
      name: area.name,
      district: area.district,
      display: `${area.name} (${area.district})`
    }))

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json([])
  }
}
