import path from 'path'
import { WORKSPACE, ensureDir, normalizeStationName, report, writeJson } from './_utils'

/**
 * 인천 지하철 역명→좌표 마스터를 OpenStreetMap(Overpass)에서 생성한다.
 * 역별 수송인원 CSV에는 좌표가 없어, 이 마스터와 역명으로 조인해 H3에 배치한다.
 * (재현성: 동일 bbox 쿼리 → 동일 결과. OSM 데이터 갱신 시점만 다름)
 */
const outputFile = path.join(WORKSPACE, 'reference', 'incheon-subway-stations.json')
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
// 인천 + 부천(7호선 인천구간 환승 범위) 포함
const BBOX = '37.30,126.35,37.65,126.95'

async function fetchOverpass(query: string): Promise<{ elements?: OverpassElement[] }> {
  let lastError: unknown
  for (const url of OVERPASS_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'OpenRisk-Incheon/0.1',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(120000),
      })
      if (!response.ok) throw new Error(`Overpass ${url} failed: ${response.status} ${response.statusText}`)
      return (await response.json()) as { elements?: OverpassElement[] }
    } catch (error) {
      lastError = error
      console.warn(`Overpass 엔드포인트 실패, 다음 시도: ${url}`)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All Overpass endpoints failed')
}

type OverpassElement = {
  id: number
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

async function main() {
  const query = `
    [out:json][timeout:90];
    (
      node["railway"="station"](${BBOX});
      node["railway"="halt"](${BBOX});
      node["station"="subway"](${BBOX});
      way["railway"="station"](${BBOX});
    );
    out center;
  `

  const data = await fetchOverpass(query)
  const byNormalized = new Map<string, { name: string; lat: number; lng: number }>()

  for (const element of data.elements ?? []) {
    const name = element.tags?.name
    if (!name || !/[가-힣]/.test(name)) continue
    const lat = element.lat ?? element.center?.lat
    const lng = element.lon ?? element.center?.lon
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const key = normalizeStationName(name)
    if (!key || byNormalized.has(key)) continue
    byNormalized.set(key, { name, lat, lng })
  }

  const stations = Array.from(byNormalized.entries())
    .map(([normalizedName, value]) => ({ normalizedName, name: value.name, lat: value.lat, lng: value.lng }))
    .sort((a, b) => a.normalizedName.localeCompare(b.normalizedName))

  ensureDir(path.dirname(outputFile))
  writeJson(outputFile, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'osm',
    dataPeriod: 'overpass-now',
    stations,
  })

  report('subway-stations-report.json', {
    status: stations.length > 0 ? 'ready' : 'blocked',
    outputFile,
    stations: stations.length,
    note: '역명→좌표 마스터(OSM). import-transit에서 역별 수송인원과 역명으로 조인',
  })
  console.log(`지하철 역 좌표 마스터 ${stations.length}개 생성`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
