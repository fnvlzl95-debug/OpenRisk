import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 1) {
    return NextResponse.json([])
  }

  try {
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
