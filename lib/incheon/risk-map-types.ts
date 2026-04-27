export type RiskMapCenter = {
  lat: number
  lng: number
}

export type RiskMapCell = {
  h3Id: string
  score: number | null
  status?: 'data' | 'masked' | 'no_data'
  sourceIds?: string[]
  confidence?: 'high' | 'medium' | 'low'
  method?: 'actual' | 'estimated'
  reason?: string
}
