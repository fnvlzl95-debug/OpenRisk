/**
 * 업종 카테고리 정의
 * 사용자가 필수로 선택해야 하는 업종 목록
 */

// 카카오 API 카테고리 코드
export type KakaoCategoryCode =
  | 'FD6' // 음식점
  | 'CE7' // 카페
  | 'CS2' // 편의점
  | 'MT1' // 대형마트
  | 'PM9' // 약국
  | 'AC5' // 학원
  | 'HP8' // 병원
  | 'BK9' // 은행

// 업종 카테고리 정의
export interface CategoryInfo {
  name: string
  kakaoCode: KakaoCategoryCode
  keywords: readonly string[]
  // 업종별 리스크 가중치
  weights: {
    readonly competition: number  // 경쟁 밀도
    readonly cost: number         // 임대료 부담
    readonly survival: number     // 폐업 위험
    readonly traffic: number      // 유동인구
    readonly anchor: number       // 앵커 시설
  }
}

export const BUSINESS_CATEGORIES = {
  // ===== 음식점 =====
  restaurant_korean: {
    name: '한식',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['한식', '한정식', '백반', '찌개', '국밥'],
    weights: { competition: 0.30, cost: 0.30, survival: 0.20, traffic: 0.15, anchor: 0.05 }
  },
  restaurant_western: {
    name: '양식',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['양식', '파스타', '스테이크', '피자', '브런치'],
    weights: { competition: 0.25, cost: 0.25, survival: 0.20, traffic: 0.25, anchor: 0.05 }
  },
  restaurant_japanese: {
    name: '일식',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['일식', '초밥', '라멘', '우동', '돈카츠'],
    weights: { competition: 0.30, cost: 0.25, survival: 0.20, traffic: 0.20, anchor: 0.05 }
  },
  restaurant_chinese: {
    name: '중식',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['중식', '중국집', '짜장', '짬뽕'],
    weights: { competition: 0.25, cost: 0.25, survival: 0.20, traffic: 0.15, anchor: 0.15 }
  },
  restaurant_chicken: {
    name: '치킨',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['치킨', '통닭', '프라이드'],
    weights: { competition: 0.35, cost: 0.25, survival: 0.25, traffic: 0.10, anchor: 0.05 }
  },
  restaurant_pizza: {
    name: '피자',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['피자'],
    weights: { competition: 0.35, cost: 0.25, survival: 0.25, traffic: 0.10, anchor: 0.05 }
  },
  restaurant_fastfood: {
    name: '패스트푸드',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['햄버거', '버거', '패스트푸드'],
    weights: { competition: 0.30, cost: 0.20, survival: 0.20, traffic: 0.25, anchor: 0.05 }
  },

  // ===== 카페/베이커리 =====
  cafe: {
    name: '카페',
    kakaoCode: 'CE7' as KakaoCategoryCode,
    keywords: ['카페', '커피', '커피숍', '에스프레소'],
    weights: { competition: 0.35, cost: 0.20, survival: 0.20, traffic: 0.20, anchor: 0.05 }
  },
  bakery: {
    name: '베이커리',
    kakaoCode: 'CE7' as KakaoCategoryCode,
    keywords: ['빵', '베이커리', '제과', '빵집'],
    weights: { competition: 0.30, cost: 0.25, survival: 0.20, traffic: 0.20, anchor: 0.05 }
  },
  dessert: {
    name: '디저트',
    kakaoCode: 'CE7' as KakaoCategoryCode,
    keywords: ['디저트', '케이크', '아이스크림', '마카롱'],
    weights: { competition: 0.30, cost: 0.20, survival: 0.25, traffic: 0.20, anchor: 0.05 }
  },

  // ===== 주점 =====
  bar: {
    name: '술집/바',
    kakaoCode: 'FD6' as KakaoCategoryCode,
    keywords: ['술집', '바', '호프', '포차', '이자카야'],
    weights: { competition: 0.25, cost: 0.25, survival: 0.25, traffic: 0.20, anchor: 0.05 }
  },

  // ===== 소매 =====
  convenience: {
    name: '편의점',
    kakaoCode: 'CS2' as KakaoCategoryCode,
    keywords: ['편의점', 'GS25', 'CU', '세븐일레븐', '이마트24'],
    weights: { competition: 0.15, cost: 0.20, survival: 0.15, traffic: 0.25, anchor: 0.25 }
  },
  mart: {
    name: '슈퍼마켓',
    kakaoCode: 'MT1' as KakaoCategoryCode,
    keywords: ['마트', '슈퍼', '슈퍼마켓'],
    weights: { competition: 0.20, cost: 0.25, survival: 0.20, traffic: 0.15, anchor: 0.20 }
  },

  // ===== 서비스 =====
  beauty: {
    name: '미용실',
    kakaoCode: 'CS2' as KakaoCategoryCode,
    keywords: ['미용실', '헤어샵', '헤어살롱', '미용'],
    weights: { competition: 0.25, cost: 0.25, survival: 0.20, traffic: 0.15, anchor: 0.15 }
  },
  nail: {
    name: '네일샵',
    kakaoCode: 'CS2' as KakaoCategoryCode,
    keywords: ['네일', '네일샵', '네일아트'],
    weights: { competition: 0.30, cost: 0.25, survival: 0.25, traffic: 0.15, anchor: 0.05 }
  },
  laundry: {
    name: '세탁소',
    kakaoCode: 'CS2' as KakaoCategoryCode,
    keywords: ['세탁', '세탁소', '빨래'],
    weights: { competition: 0.20, cost: 0.20, survival: 0.15, traffic: 0.15, anchor: 0.30 }
  },
  pharmacy: {
    name: '약국',
    kakaoCode: 'PM9' as KakaoCategoryCode,
    keywords: ['약국'],
    weights: { competition: 0.15, cost: 0.25, survival: 0.10, traffic: 0.20, anchor: 0.30 }
  },

  // ===== 기타 =====
  gym: {
    name: '헬스장',
    kakaoCode: 'CS2' as KakaoCategoryCode,
    keywords: ['헬스', '피트니스', 'PT', '헬스장'],
    weights: { competition: 0.25, cost: 0.30, survival: 0.20, traffic: 0.10, anchor: 0.15 }
  },
  academy: {
    name: '학원',
    kakaoCode: 'AC5' as KakaoCategoryCode,
    keywords: ['학원', '교습소', '과외'],
    weights: { competition: 0.25, cost: 0.25, survival: 0.20, traffic: 0.10, anchor: 0.20 }
  },
} as const

export type BusinessCategory = keyof typeof BUSINESS_CATEGORIES

// 카테고리 목록 (UI 선택용)
export const CATEGORY_LIST: { key: BusinessCategory; name: string; group: string }[] = [
  // 음식점
  { key: 'restaurant_korean', name: '한식', group: '음식점' },
  { key: 'restaurant_western', name: '양식', group: '음식점' },
  { key: 'restaurant_japanese', name: '일식', group: '음식점' },
  { key: 'restaurant_chinese', name: '중식', group: '음식점' },
  { key: 'restaurant_chicken', name: '치킨', group: '음식점' },
  { key: 'restaurant_pizza', name: '피자', group: '음식점' },
  { key: 'restaurant_fastfood', name: '패스트푸드', group: '음식점' },
  // 카페/베이커리
  { key: 'cafe', name: '카페', group: '카페/베이커리' },
  { key: 'bakery', name: '베이커리', group: '카페/베이커리' },
  { key: 'dessert', name: '디저트', group: '카페/베이커리' },
  // 주점
  { key: 'bar', name: '술집/바', group: '주점' },
  // 소매
  { key: 'convenience', name: '편의점', group: '소매' },
  { key: 'mart', name: '슈퍼마켓', group: '소매' },
  // 서비스
  { key: 'beauty', name: '미용실', group: '서비스' },
  { key: 'nail', name: '네일샵', group: '서비스' },
  { key: 'laundry', name: '세탁소', group: '서비스' },
  { key: 'pharmacy', name: '약국', group: '서비스' },
  // 기타
  { key: 'gym', name: '헬스장', group: '기타' },
  { key: 'academy', name: '학원', group: '기타' },
]

// 그룹별 카테고리 (UI 드롭다운용)
export const CATEGORY_GROUPS = [
  '음식점',
  '카페/베이커리',
  '주점',
  '소매',
  '서비스',
  '기타',
] as const

/**
 * 카테고리 정보 조회
 */
export function getCategoryInfo(category: BusinessCategory): CategoryInfo {
  return BUSINESS_CATEGORIES[category]
}

/**
 * 카테고리 이름 조회
 */
export function getCategoryName(category: BusinessCategory): string {
  return BUSINESS_CATEGORIES[category].name
}

/**
 * 카테고리별 가중치 조회
 */
export function getCategoryWeights(category: BusinessCategory): CategoryInfo['weights'] {
  return BUSINESS_CATEGORIES[category].weights
}
