/**
 * H3 그리드 유틸리티 함수
 * 포인트 기반 분석을 위한 H3 헥사곤 그리드 처리
 */

import * as h3 from 'h3-js'

// H3 해상도 9: 약 350m 셀 (반경 500m 분석에 적합)
export const H3_RESOLUTION = 9

/**
 * 좌표를 H3 셀 ID로 변환
 */
export function latLngToH3(lat: number, lng: number): string {
  return h3.latLngToCell(lat, lng, H3_RESOLUTION)
}

/**
 * H3 셀 ID를 중심 좌표로 변환
 */
export function h3ToLatLng(h3Id: string): { lat: number; lng: number } {
  const [lat, lng] = h3.cellToLatLng(h3Id)
  return { lat, lng }
}

/**
 * 특정 지점 주변의 H3 셀 목록 (반경 기반)
 * @param lat 위도
 * @param lng 경도
 * @param radiusMeters 반경 (미터)
 * @returns 반경 내 포함되는 H3 셀 ID 배열
 */
export function getH3CellsInRadius(
  lat: number,
  lng: number,
  radiusMeters: number = 500
): string[] {
  const centerH3 = latLngToH3(lat, lng)

  // H3 해상도 9의 평균 엣지 길이: ~174m
  // 500m 반경 → 약 2~3링 필요
  const rings = Math.ceil(radiusMeters / 174)

  return h3.gridDisk(centerH3, rings)
}

/**
 * 두 좌표 간 거리 계산 (Haversine)
 * @returns 거리 (미터)
 */
export function getDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // 지구 반지름 (미터)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * H3 셀이 특정 반경 내에 있는지 확인
 */
export function isH3CellInRadius(
  h3Id: string,
  centerLat: number,
  centerLng: number,
  radiusMeters: number
): boolean {
  const cellCenter = h3ToLatLng(h3Id)
  const distance = getDistance(centerLat, centerLng, cellCenter.lat, cellCenter.lng)
  return distance <= radiusMeters
}

/**
 * 지역(시도) 판별
 */
export function getRegionFromCoords(lat: number, lng: number): '서울' | '경기' | '인천' | '기타' {
  // 대략적인 경계 (정확한 판별은 역지오코딩 사용)
  // 서울: 위도 37.4~37.7, 경도 126.7~127.2
  // 인천: 위도 37.3~37.6, 경도 126.3~126.8
  // 경기: 서울/인천 주변

  if (lat >= 37.4 && lat <= 37.7 && lng >= 126.8 && lng <= 127.2) {
    return '서울'
  }
  if (lat >= 37.3 && lat <= 37.6 && lng >= 126.3 && lng <= 126.8) {
    return '인천'
  }
  if (lat >= 36.9 && lat <= 38.0 && lng >= 126.3 && lng <= 127.8) {
    return '경기'
  }
  return '기타'
}

/**
 * H3 셀 경계 폴리곤 (지도 표시용)
 */
export function getH3Boundary(h3Id: string): [number, number][] {
  const boundary = h3.cellToBoundary(h3Id)
  // h3-js는 [lat, lng] 형식, 카카오맵은 [lng, lat] 필요
  return boundary.map(([lat, lng]) => [lng, lat])
}

/**
 * 여러 H3 셀의 통합 경계 (지도 표시용)
 */
export function getMultiH3Boundary(h3Ids: string[]): [number, number][][] {
  return h3Ids.map(id => getH3Boundary(id))
}
