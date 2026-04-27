import { NextResponse } from 'next/server'
import { getIncheonDatasetStatus } from '@/lib/incheon/data-repository'
import { getIncheonPublicDataSources } from '@/lib/incheon/source-policy'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    productMode: 'openrisk-incheon',
    dataPolicy: 'public-data-only',
    datasetStatus: getIncheonDatasetStatus(),
    sources: getIncheonPublicDataSources(),
  })
}
