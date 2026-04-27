import path from 'path'
import { PROCESSED_DIR, ensureDir, report, writeJson } from './_utils'

const outputFile = path.join(PROCESSED_DIR, 'osm-mask', 'noncommercial-polygons.json')

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter'
const INCHEON_BBOX = '37.30,126.35,37.65,126.95'

type OverpassElement = {
  id: number
  type: string
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

function bbox(coords: Array<[number, number]>): [number, number, number, number] {
  const lngs = coords.map(([lng]) => lng)
  const lats = coords.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

async function main() {
  const query = `
    [out:json][timeout:90];
    (
      way["leisure"~"park|garden|nature_reserve|pitch|playground"](${INCHEON_BBOX});
      way["natural"~"water|wood|wetland|grassland"](${INCHEON_BBOX});
      way["landuse"~"forest|grass|meadow|recreation_ground"](${INCHEON_BBOX});
      way["waterway"](${INCHEON_BBOX});
    );
    out geom;
  `

  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'OpenRisk-Incheon/0.1',
      },
      body: new URLSearchParams({ data: query }),
    })
    if (!response.ok) {
      throw new Error(`Overpass API failed: ${response.status} ${response.statusText}`)
    }
    const data = (await response.json()) as { elements?: OverpassElement[] }
    const polygons =
      data.elements
        ?.filter((element) => element.geometry && element.geometry.length >= 4)
        .map((element) => {
          const coordinates = element.geometry!.map((point) => [point.lon, point.lat] as [number, number])
          return {
            id: `${element.type}/${element.id}`,
            source: 'osm' as const,
            tags: element.tags ?? {},
            bbox: bbox(coordinates),
            coordinates,
          }
        }) ?? []

    ensureDir(path.dirname(outputFile))
    writeJson(outputFile, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sourceIds: ['osm-noncommercial-mask'],
      dataPeriod: 'overpass-now',
      polygons,
    })

    report('osm-mask-import-report.json', {
      status: 'ready',
      outputFile,
      polygons: polygons.length,
      policy: '점수 산식에는 포함하지 않고 지도 비상권 셀 마스킹에만 사용합니다.',
    })
    console.log(`OSM 마스크 폴리곤 ${polygons.length}개 생성`)
  } catch (error) {
    report('osm-mask-import-report.json', {
      status: 'blocked',
      outputFile,
      reason: error instanceof Error ? error.message : 'unknown error',
      policy: 'OSM 마스크가 없어도 API는 점수를 계산하지만 공원·수면 보정은 제한됩니다.',
    })
    console.warn('OSM 마스크 수집 실패')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
