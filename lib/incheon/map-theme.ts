/**
 * 인천 지도 디자인 토큰.
 * 위험도 색 램프·베이스맵 타일·시그니처 색을 한 곳에서 관리한다.
 * 셀 색(riskColor)과 범례 그라데이션(riskRampGradient)이 항상 같은 램프에서 파생되므로 어긋나지 않는다.
 */

// 위험도 색 램프 — 낮음(파랑) → 높음(빨강). 이 배열이 단일 소스.
export const RISK_RAMP = ['#2D8CFF', '#20C7E8', '#6FCA72', '#F6D84A', '#FF8A1F', '#FF5B1D', '#FF3F3F'] as const

// 각 램프 색의 점수 하한
const RISK_THRESHOLDS = [0, 28, 40, 52, 62, 74, 86]

/** 위험도 점수(0~100) → 색 */
export function riskColor(score: number): string {
  let color: string = RISK_RAMP[0]
  for (let i = 0; i < RISK_THRESHOLDS.length; i += 1) {
    if (score >= RISK_THRESHOLDS[i]) color = RISK_RAMP[i]
  }
  return color
}

/** 범례용 CSS 그라데이션 문자열(셀 색과 동일 램프에서 생성) */
export function riskRampGradient(): string {
  const stops = RISK_RAMP.map((color, index) => `${color} ${Math.round((index / (RISK_RAMP.length - 1)) * 100)}%`).join(', ')
  return `linear-gradient(90deg, ${stops})`
}

/**
 * 브랜드 다크 베이스맵 — CARTO Dark Matter(키 불필요).
 * 무채색에 가까운 다크 네이비라 위에 얹는 히트맵이 또렷하게 읽힌다.
 * base(라벨 없음) 위에 labels(옅게)를 깔아 구·동/주요 도로 방향감만 제공한다.
 */
export const MAP_TILES = {
  base: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  labels: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    opacity: 0.5,
  },
} as const

// 시그니처 반경 링 색
export const RING_COLOR = '#35D7FF'
