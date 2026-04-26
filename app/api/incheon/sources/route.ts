import { NextResponse } from 'next/server'
import { getIncheonPublicDataSources } from '@/lib/incheon/source-policy'

export async function GET() {
  return NextResponse.json({
    productMode: 'openrisk-incheon',
    dataPolicy: 'public-data-only',
    sources: getIncheonPublicDataSources(),
  })
}
