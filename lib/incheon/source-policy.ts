import { INCHEON_PUBLIC_DATA_SOURCES } from './constants'
import type { IncheonDataSource, IncheonMetricSourceRef } from './types'

export function getIncheonPublicDataSources(): IncheonDataSource[] {
  return INCHEON_PUBLIC_DATA_SOURCES
}

export function getIncheonSource(sourceId: string): IncheonDataSource {
  const source = INCHEON_PUBLIC_DATA_SOURCES.find((item) => item.sourceId === sourceId)
  if (!source) {
    throw new Error(`Unknown Incheon public data source: ${sourceId}`)
  }
  return source
}

export function sourceRefs(sourceIds: string[]): IncheonMetricSourceRef[] {
  return sourceIds.map((sourceId) => {
    const source = getIncheonSource(sourceId)
    return {
      sourceId: source.sourceId,
      name: source.name,
      provider: source.provider,
    }
  })
}

export function assertPublicDataOnlySources(sources: IncheonDataSource[]) {
  const blocked = sources.filter((source) => !source.costFree || source.provider.includes('Kakao') || source.provider.includes('OpenAI'))
  if (blocked.length > 0) {
    throw new Error(`OpenRisk Incheon sources must remain public-data-only: ${blocked.map((s) => s.sourceId).join(', ')}`)
  }
}
