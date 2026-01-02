/**
 * 문장 템플릿 풀
 *
 * "말리는 친구" 톤:
 * - 부정적 지표: 명확히 경고 (현실 직시)
 * - 긍정적 지표: 함정도 알려줌
 * - 나쁜 조합: 더 강하게 말림
 */

import type { Template } from './conditions'
import type { BusinessCategory } from '../../categories'

// 업종 템플릿 키 타입
export type CategoryKey = BusinessCategory

// 업종별 템플릿 구조
export interface CategoryTemplateSet {
  competition: { high: string[]; low: string[] }
  traffic: { high: string[]; low: string[] }
  anchor: { near: string[]; far: string[] }
  general: string[]
}

// ===== 경쟁 관련 템플릿 =====

export const competitionTemplates: Template[] = [
  // 경쟁 높음 + 유동 높음
  {
    id: 'comp_high_traffic_high',
    conditions: { competition: 'high', traffic: 'high' },
    phrases: [
      '손님은 많은데 ${sameCategory}개 가게가 나눠 가져요, 체력전이 될 수 있어요',
      '유동은 좋지만 ${sameCategory}개 업체와 경쟁해야 해요, 확실한 차별점이 필요해요',
      '상권이 활발한 만큼 경쟁도 치열해요, 뚜렷한 강점 없으면 버티기 힘들어요',
    ],
    tone: 'warning',
    actionHint: '시그니처 메뉴나 독특한 컨셉으로 차별화하세요',
  },
  // 경쟁 높음 + 유동 낮음 (최악)
  {
    id: 'comp_high_traffic_low',
    conditions: { competition: 'high', traffic: 'low' },
    phrases: [
      '경쟁은 치열한데 지나다니는 사람도 적어요, 솔직히 조건이 안 좋아요',
      '${sameCategory}개나 있는데 유동인구가 적어요, 다른 곳도 살펴보시는 게 좋겠어요',
      '이미 포화 상태인데 손님도 많지 않아요, 쉽지 않을 거예요',
    ],
    tone: 'critical',
    actionHint: '다른 입지를 먼저 검토해보세요',
  },
  // 경쟁 높음 + 유동 보통
  {
    id: 'comp_high_traffic_medium',
    conditions: { competition: 'high', traffic: 'medium' },
    phrases: [
      '${sameCategory}개 업체가 경쟁 중이에요, 평범하면 묻히기 쉬워요',
      '경쟁이 치열한 편이에요, 가격이나 서비스로 차별화가 필요해요',
      '비슷한 가게가 많아서 단골 확보 전략이 중요해요',
    ],
    tone: 'warning',
  },
  // 경쟁 낮음 + 유동 높음 (좋지만 함정 있음)
  {
    id: 'comp_low_traffic_high',
    conditions: { competition: 'low', traffic: 'high' },
    phrases: [
      '유동인구 대비 경쟁이 적어요, 기회일 수 있지만 왜 없는지 확인해보세요',
      '선점 효과를 기대할 수 있어요, 다만 수요가 실제로 있는지 검증이 필요해요',
      '블루오션처럼 보이지만, 이 업종 수요가 있는 동네인지 확인하세요',
    ],
    tone: 'caution',
  },
  // 경쟁 낮음 + 유동 낮음
  {
    id: 'comp_low_traffic_low',
    conditions: { competition: 'low', traffic: 'low' },
    phrases: [
      '경쟁도 적지만 유동인구도 적어요, 배후 주거 수요에 의존해야 해요',
      '조용한 동네예요, 단골 위주 운영이 될 가능성이 높아요',
      '지나다니는 사람이 적어서 배달이나 예약제 위주가 될 수 있어요',
    ],
    tone: 'caution',
  },
  // 경쟁 보통
  {
    id: 'comp_medium',
    conditions: { competition: 'medium' },
    phrases: [
      '적정 수준의 경쟁이에요, 시장이 검증된 지역이라고 볼 수 있어요',
      '경쟁은 있지만 과열 상태는 아니에요',
      '비슷한 가게가 몇 개 있어서 가격 경쟁력을 미리 계산해보세요',
    ],
    tone: 'caution',
  },
]

// ===== 유동인구 관련 템플릿 =====

export const trafficTemplates: Template[] = [
  // 유동 낮음
  {
    id: 'traffic_low',
    conditions: { traffic: 'low' },
    phrases: [
      '지나다니는 사람이 많지 않아요, 배달에 의존해야 할 수 있어요',
      '유동인구가 적은 편이에요, 주변 주거 수요를 확인해보세요',
      '워킹 손님보다 목적형 방문에 기대야 해요',
    ],
    tone: 'warning',
  },
  // 유동 높음 + 저녁 피크
  {
    id: 'traffic_high_night',
    conditions: { traffic: 'high', peakTime: 'night' },
    phrases: [
      '저녁 시간대 유동이 많아요, 퇴근 후 수요를 노릴 수 있어요',
      '${peakTimeLabel} 시간대가 피크예요, 저녁형 업종에 유리해요',
      '야간 유동이 강해요, 다만 낮 장사는 약할 수 있어요',
    ],
    tone: 'positive',
  },
  // 유동 높음 + 아침 피크
  {
    id: 'traffic_high_morning',
    conditions: { traffic: 'high', peakTime: 'morning' },
    phrases: [
      '아침 출근 수요가 강해요, 테이크아웃이나 간편식이 유리해요',
      '출근길 유동이 많아요, 빠른 회전이 중요한 업종에 적합해요',
      '아침에 붐비고 낮에는 한산할 수 있어요, 시간대별 전략이 필요해요',
    ],
    tone: 'positive',
  },
  // 유동 높음 (일반)
  {
    id: 'traffic_high',
    conditions: { traffic: 'high' },
    phrases: [
      '유동은 많지만 그 사람들이 내 가게에 올 이유를 만들어야 해요',
      '지나다니는 사람은 많아요, 눈에 띄는 간판이나 외관이 중요해요',
      '유동인구는 충분해요, 다만 경쟁 상황도 함께 봐야 해요',
    ],
    tone: 'positive',
  },
]

// ===== 임대료 관련 템플릿 =====

export const costTemplates: Template[] = [
  // 임대료 높음 + 상업지
  {
    id: 'cost_high_commercial',
    conditions: { cost: 'high', areaType: 'C_상업' },
    phrases: [
      '평당 ${avgRent}만원대로 높아요, 10평 기준 월 ${rentMonthly10}만원 이상이에요',
      '고정비 압박이 클 거예요, 고회전 전략이 필수예요',
      '상업지라 비싸요, 작은 평수나 테이크아웃형을 고려해보세요',
    ],
    tone: 'warning',
    actionHint: '평수를 줄이거나 테이크아웃 위주로 검토하세요',
  },
  // 임대료 높음 (일반)
  {
    id: 'cost_high',
    conditions: { cost: 'high' },
    phrases: [
      '평당 ${avgRent}만원대로 높은 편이에요, 월 고정비를 꼼꼼히 계산해보세요',
      '비용 부담이 클 수 있어요, 예상 매출과 비교해보세요',
      '평당 ${avgRent}만원이면 10평 기준 월 ${rentMonthly10}만원이에요',
    ],
    tone: 'warning',
  },
  // 임대료 낮음
  {
    id: 'cost_low',
    conditions: { cost: 'low' },
    phrases: [
      '임대료가 저렴해서 초기 부담이 적어요',
      '고정비가 낮아서 안정적인 운영이 가능해요',
      '비용 측면에서는 괜찮아요, 다만 왜 저렴한지 이유를 확인해보세요',
    ],
    tone: 'positive',
  },
]

// ===== 생존율 관련 템플릿 =====

export const survivalTemplates: Template[] = [
  // 폐업률 높음 (50% 이상)
  {
    id: 'survival_high',
    conditions: { survival: 'high' },
    phrases: [
      '1년 안에 절반 가까이 문 닫는 동네예요, 쉽지 않아요',
      '폐업률이 높은 편이에요, 운영 난이도가 높다고 보셔야 해요',
      '많이 문 닫는 지역이에요, 확실한 준비 없으면 힘들 수 있어요',
    ],
    tone: 'critical',
  },
  // 폐업률 보통
  {
    id: 'survival_medium',
    conditions: { survival: 'medium' },
    phrases: [
      '폐업률은 평균 수준이에요, 일반적인 창업 리스크예요',
      '점포 증감이 크게 없는 안정적인 상권이에요',
      '특별히 위험하진 않지만 방심은 금물이에요',
    ],
    tone: 'caution',
  },
  // 폐업률 낮음
  {
    id: 'survival_low',
    conditions: { survival: 'low' },
    phrases: [
      '폐업률이 낮아서 상권이 안정적이에요',
      '오래 버티는 가게가 많아요, 단골 문화가 있는 동네예요',
      '생존율이 괜찮은 편이에요, 다만 진입 장벽도 있을 수 있어요',
    ],
    tone: 'positive',
  },
]

// ===== 앵커 시설 관련 템플릿 =====

export const anchorTemplates: Template[] = [
  // 역세권 (100m 이내)
  {
    id: 'anchor_subway_close',
    conditions: { hasSubway: true },
    phrases: [
      '${subwayName}역 ${subwayDistance}m 역세권이에요, 유입은 좋지만 임대료와 경쟁도 높아요',
      '역세권 핵심 입지예요, 다만 그만큼 비용도 높다는 점 고려하세요',
      '역에서 가까워서 유동은 확실해요, 권리금도 높을 거예요',
    ],
    tone: 'caution',
  },
  // 앵커 없음
  {
    id: 'anchor_none',
    conditions: { hasSubway: false },
    phrases: [
      '주요 앵커 시설이 없어요, 자체 집객력이 필요해요',
      '역이나 대형마트가 없어서 목적형 방문에 의존해야 해요',
      '유입 시설이 없어서 마케팅이 더 중요해요',
    ],
    tone: 'warning',
  },
]

// ===== 상권 유형 관련 템플릿 =====

export const areaTypeTemplates: Template[] = [
  {
    id: 'area_residential',
    conditions: { areaType: 'A_주거' },
    phrases: [
      '주거 밀집 지역이라 단골 위주 안정적인 운영이 가능해요',
      '동네 상권이에요, 주민 수요에 맞춘 메뉴/서비스가 중요해요',
      '조용한 주거지예요, 화려한 것보다 편안한 분위기가 맞아요',
    ],
    tone: 'positive',
  },
  {
    id: 'area_commercial',
    conditions: { areaType: 'C_상업' },
    phrases: [
      '상업 중심지라 유입은 좋지만 경쟁과 임대료도 높아요',
      '핫플레이스예요, 트렌드에 민감하고 빠르게 바뀌는 동네예요',
      '상권이 활발해요, 다만 체력전이 될 수 있어요',
    ],
    tone: 'caution',
  },
  {
    id: 'area_mixed',
    conditions: { areaType: 'B_혼합' },
    phrases: [
      '직주 혼합 지역이에요, 시간대별 고객층이 달라요',
      '출근 시간, 점심, 저녁 각각 다른 손님이 와요',
      '다양한 수요가 있어요, 시간대별 전략이 필요해요',
    ],
    tone: 'caution',
  },
  {
    id: 'area_special',
    conditions: { areaType: 'D_특수' },
    phrases: [
      '특수 상권이라 시즌이나 이벤트 의존도가 높을 수 있어요',
      '관광지/유흥가 특성이에요, 평일과 주말 차이가 클 수 있어요',
      '특색 있는 상권이지만 변동성도 커요',
    ],
    tone: 'warning',
  },
]

// ===== 조합 템플릿 (나쁜 조합일 때 강하게) =====

export const combinationTemplates: Template[] = [
  // 최악 조합: 경쟁 높음 + 임대료 높음 + 유동 낮음
  {
    id: 'worst_combination',
    conditions: { competition: 'high', cost: 'high', traffic: 'low' },
    phrases: [
      '솔직히 말씀드리면, 여기는 조건이 많이 안 좋아요. 경쟁은 치열한데 유동인구는 적고 임대료까지 높아요. 정말 확실한 자신이 있지 않으면 다른 곳을 살펴보세요.',
      '힘든 조건이에요. ${sameCategory}개나 경쟁하는데 손님도 적고 비용도 높아요. 다시 한번 생각해보시는 게 좋겠어요.',
    ],
    tone: 'critical',
    actionHint: '다른 입지를 먼저 검토하세요',
  },
  // 고비용 고경쟁
  {
    id: 'high_cost_high_comp',
    conditions: { competition: 'high', cost: 'high' },
    phrases: [
      '경쟁도 치열하고 임대료도 높아요, 이중 부담이에요',
      '비용도 높은데 경쟁자도 많아요, 수익 내기 쉽지 않아요',
    ],
    tone: 'critical',
  },
]

// ===== 업종별 특화 템플릿 =====

export const categoryTemplates: Partial<Record<CategoryKey, CategoryTemplateSet>> = {
  // ===== 카페/베이커리 =====
  cafe: {
    competition: {
      high: [
        '카페가 ${sameCategory}개나 있어요, 시그니처 메뉴 없으면 묻혀요',
        '카페 포화 상태예요, SNS 마케팅이나 특색 있는 인테리어가 필수예요',
        '주변 카페가 많아요, 왜 여기 와야 하는지 이유를 만들어야 해요',
      ],
      low: [
        '카페가 적어서 선점 효과를 기대할 수 있어요',
        '카페 공백 지역이에요, 기본기만 갖춰도 수요 확보 가능성 있어요',
      ],
    },
    traffic: {
      high: [
        '유동인구가 많아서 테이크아웃 수요를 노릴 수 있어요',
        '지나다니는 사람이 많아요, 눈에 띄는 외관이 중요해요',
      ],
      low: [
        '유동이 적어서 단골 위주가 될 거예요, 동네 카페 컨셉이 맞아요',
        '지나다니는 사람이 적어요, 주거 배후 수요에 의존해야 해요',
      ],
    },
    anchor: {
      near: ['역 근처라 출퇴근 테이크아웃 수요가 있어요'],
      far: ['역에서 멀어서 목적형 카페로 가야 해요, 분위기나 메뉴로 승부하세요'],
    },
    general: [
      '카페는 진입장벽이 낮아서 경쟁이 치열해요',
      '커피 맛만으론 차별화가 안 돼요, 공간이나 경험을 팔아야 해요',
    ],
  },

  bakery: {
    competition: {
      high: [
        '빵집이 ${sameCategory}개나 있어요, 특색 있는 빵이 필요해요',
        '베이커리 경쟁이 있어요, 시그니처 빵으로 차별화하세요',
      ],
      low: [
        '빵집이 적어요, 동네 빵집으로 자리잡을 기회예요',
        '베이커리 공백 지역이에요',
      ],
    },
    traffic: {
      high: ['아침 출근길 손님을 노릴 수 있어요'],
      low: ['주거 배후 수요로 안정적인 운영이 가능해요'],
    },
    anchor: {
      near: ['역 근처라 출근길 빵 수요가 있어요'],
      far: ['맛있으면 찾아오는 동네 빵집이 될 수 있어요'],
    },
    general: ['새벽 작업 체력 소모가 커요, 생산량 관리가 중요해요'],
  },

  dessert: {
    competition: {
      high: [
        '디저트 가게가 많아요, 트렌드에 민감한 업종이라 빠르게 바뀌어요',
        '디저트는 유행을 타요, ${sameCategory}개 경쟁 중인데 차별화가 필요해요',
      ],
      low: ['디저트 가게가 적어요, 수요가 있는지 먼저 확인해보세요'],
    },
    traffic: {
      high: ['젊은 유동인구가 많으면 디저트 수요도 높아요'],
      low: ['디저트는 충동구매가 많아서 유동 적으면 힘들 수 있어요'],
    },
    anchor: {
      near: ['역세권이라 퇴근 후 디저트 수요가 있어요'],
      far: ['목적형 방문이 필요해요, SNS 마케팅이 중요해요'],
    },
    general: ['디저트는 트렌드 수명이 짧아요, 메뉴 개발이 계속 필요해요'],
  },

  // ===== 음식점 =====
  restaurant_korean: {
    competition: {
      high: [
        '한식당이 ${sameCategory}개나 있어요, 가격이나 맛으로 승부해야 해요',
        '한식은 보편적이라 경쟁이 치열해요, 전문성이 필요해요',
      ],
      low: ['한식당이 적어요, 기본만 해도 수요가 있을 거예요'],
    },
    traffic: {
      high: ['점심 직장인 수요를 노릴 수 있어요'],
      low: ['배달에 의존해야 할 수 있어요'],
    },
    anchor: {
      near: ['오피스 상권이라 점심 특선 수요가 있어요'],
      far: ['단골 위주 동네 식당이 될 거예요'],
    },
    general: ['한식은 손이 많이 가요, 인건비와 식재료비 관리가 중요해요'],
  },

  restaurant_western: {
    competition: {
      high: ['양식당 경쟁이 있어요, 가격대나 분위기로 차별화하세요'],
      low: ['양식당이 적어요, 수요가 있는 동네인지 확인하세요'],
    },
    traffic: {
      high: ['데이트 수요나 모임 수요를 노릴 수 있어요'],
      low: ['예약제 레스토랑으로 운영하는 게 맞을 수 있어요'],
    },
    anchor: {
      near: ['접근성이 좋아서 회식이나 모임 수요가 있어요'],
      far: ['맛집으로 입소문 나면 찾아오는 수요가 있어요'],
    },
    general: ['양식은 객단가가 중요해요, 분위기 투자도 필요해요'],
  },

  restaurant_japanese: {
    competition: {
      high: ['일식당이 ${sameCategory}개 있어요, 전문성이 중요해요'],
      low: ['일식당이 적어요, 수요가 있으면 기회예요'],
    },
    traffic: {
      high: ['직장인 점심 수요를 노릴 수 있어요'],
      low: ['저녁 술자리 수요에 집중해야 할 수 있어요'],
    },
    anchor: {
      near: ['역 근처라 퇴근 후 술자리 수요가 있어요'],
      far: ['맛집으로 인정받으면 멀어도 찾아와요'],
    },
    general: ['일식은 식재료비가 높아요, 원가 관리가 중요해요'],
  },

  restaurant_chinese: {
    competition: {
      high: ['중식당이 ${sameCategory}개 있어요, 배달 경쟁도 치열해요'],
      low: ['중식당이 적어요, 배달 수요가 있으면 기회예요'],
    },
    traffic: {
      high: ['점심 수요가 많을 거예요'],
      low: ['배달 위주로 운영하게 될 거예요'],
    },
    anchor: {
      near: ['오피스 점심 수요가 있어요'],
      far: ['배달 반경이 중요해요'],
    },
    general: ['중식은 배달 비중이 높아요, 포장 품질 관리가 중요해요'],
  },

  restaurant_chicken: {
    competition: {
      high: [
        '치킨집이 ${sameCategory}개나 있어요, 가장 경쟁 치열한 업종이에요',
        '치킨은 프랜차이즈 경쟁이 심해요, 가격 경쟁력이 없으면 힘들어요',
      ],
      low: ['치킨집이 적어요, 드문 경우예요 수요가 있을 거예요'],
    },
    traffic: {
      high: ['배달보다 홀 손님도 노릴 수 있어요'],
      low: ['배달 100% 전략으로 가야 해요'],
    },
    anchor: {
      near: ['역 근처라 퇴근 후 치맥 수요가 있어요'],
      far: ['배달 반경이 중요해요, 배민 순위가 매출을 좌우해요'],
    },
    general: ['치킨은 마진이 박해요, 본사 로열티까지 고려하세요'],
  },

  restaurant_pizza: {
    competition: {
      high: ['피자집 경쟁이 있어요, 대형 프랜차이즈와 싸워야 해요'],
      low: ['피자집이 적어요, 배달 수요가 있으면 기회예요'],
    },
    traffic: {
      high: ['테이크아웃 수요도 노릴 수 있어요'],
      low: ['배달 위주로 운영하게 될 거예요'],
    },
    anchor: {
      near: ['오피스 회식 수요가 있을 수 있어요'],
      far: ['배달 반경 내 가구 수가 중요해요'],
    },
    general: ['피자는 저녁-야식 수요가 대부분이에요, 점심이 약해요'],
  },

  restaurant_fastfood: {
    competition: {
      high: ['패스트푸드 경쟁이 있어요, 대형 브랜드와 경쟁해야 해요'],
      low: ['패스트푸드가 적어요, 빠른 회전이 가능하면 기회예요'],
    },
    traffic: {
      high: ['유동인구가 많아서 회전이 빠를 거예요'],
      low: ['유동 적으면 패스트푸드 수요도 적어요'],
    },
    anchor: {
      near: ['역 앞이라 빠른 한 끼 수요가 있어요'],
      far: ['배달 위주가 될 거예요'],
    },
    general: ['패스트푸드는 속도가 생명이에요, 동선 최적화가 중요해요'],
  },

  // ===== 주점 =====
  bar: {
    competition: {
      high: ['술집이 ${sameCategory}개 있어요, 분위기나 컨셉 차별화가 필요해요'],
      low: ['술집이 적어요, 수요가 있는 동네인지 확인하세요'],
    },
    traffic: {
      high: ['저녁 유동이 많으면 유리해요'],
      low: ['목적형 방문을 유도해야 해요, 단골 확보가 중요해요'],
    },
    anchor: {
      near: ['역세권이라 퇴근 후 술자리 수요가 있어요'],
      far: ['숨은 맛집/분위기 컨셉으로 가야 해요'],
    },
    general: ['술집은 야간 영업이라 체력 소모가 커요, 인건비도 고려하세요'],
  },

  // ===== 소매 =====
  convenience: {
    competition: {
      high: ['편의점이 ${sameCategory}개 있어요, 본사 영업권 확인하세요'],
      low: ['편의점이 적어요, 가맹 조건 꼼꼼히 확인하세요'],
    },
    traffic: {
      high: ['유동인구 많으면 매출이 나와요'],
      low: ['주거 배후 수요에 의존해야 해요'],
    },
    anchor: {
      near: ['역 근처라 출퇴근 수요가 꾸준해요'],
      far: ['24시간 인건비 대비 매출이 나올지 계산하세요'],
    },
    general: ['편의점은 본사가 수익을 가져가요, 실 수령액을 계산하세요'],
  },

  mart: {
    competition: {
      high: ['슈퍼마켓 경쟁이 있어요, 가격 경쟁력이 필요해요'],
      low: ['슈퍼마켓이 적어요, 주거 배후가 있으면 기회예요'],
    },
    traffic: {
      high: ['지나가다 들르는 손님이 있을 거예요'],
      low: ['단골 위주 동네 슈퍼가 될 거예요'],
    },
    anchor: {
      near: ['대형마트 근처면 오히려 불리할 수 있어요'],
      far: ['동네 슈퍼로 자리잡을 수 있어요'],
    },
    general: ['슈퍼마켓은 마진이 낮아요, 회전이 생명이에요'],
  },

  // ===== 서비스 =====
  beauty: {
    competition: {
      high: ['미용실이 ${sameCategory}개 있어요, 단골 확보가 중요해요'],
      low: ['미용실이 적어요, 동네 미용실로 자리잡을 기회예요'],
    },
    traffic: {
      high: ['워킹 손님도 있지만 예약제가 기본이에요'],
      low: ['단골 위주 운영이 될 거예요'],
    },
    anchor: {
      near: ['접근성이 좋아서 신규 손님 유입이 쉬워요'],
      far: ['실력으로 입소문 나면 찾아와요'],
    },
    general: ['미용실은 기술력이 전부예요, 단골 관리가 매출을 좌우해요'],
  },

  nail: {
    competition: {
      high: ['네일샵이 ${sameCategory}개 있어요, 디자인 실력이 차별점이에요'],
      low: ['네일샵이 적어요, 수요가 있으면 기회예요'],
    },
    traffic: {
      high: ['젊은 여성 유동이 많으면 유리해요'],
      low: ['단골 예약제로 운영하게 될 거예요'],
    },
    anchor: {
      near: ['쇼핑 동선에 있으면 충동 방문도 있어요'],
      far: ['SNS 마케팅이 중요해요'],
    },
    general: ['네일샵은 트렌드가 빨리 바뀌어요, 디자인 공부가 계속 필요해요'],
  },

  laundry: {
    competition: {
      high: ['세탁소 경쟁이 있어요, 서비스 품질로 차별화하세요'],
      low: ['세탁소가 적어요, 주거 배후가 있으면 안정적이에요'],
    },
    traffic: {
      high: ['유동보다 주거 배후가 중요해요'],
      low: ['동네 세탁소로 안정적인 운영이 가능해요'],
    },
    anchor: {
      near: ['역보다 아파트 근처가 더 중요해요'],
      far: ['배후 주거 수요가 핵심이에요'],
    },
    general: ['세탁소는 안정적이지만 성장성은 낮아요, 꾸준함이 장점이에요'],
  },

  pharmacy: {
    competition: {
      high: ['약국이 ${sameCategory}개 있어요, 병원 근처가 아니면 힘들어요'],
      low: ['약국이 적어요, 면허가 있으면 좋은 기회예요'],
    },
    traffic: {
      high: ['병원가 근처면 수요가 안정적이에요'],
      low: ['동네 약국으로 단골 수요가 있어요'],
    },
    anchor: {
      near: ['병원이나 클리닉 근처가 핵심이에요'],
      far: ['동네 처방전 수요에 의존해야 해요'],
    },
    general: ['약국은 진입장벽이 높아서 안정적이에요, 면허가 핵심이에요'],
  },

  // ===== 기타 =====
  gym: {
    competition: {
      high: ['헬스장이 ${sameCategory}개 있어요, 가격이나 시설로 차별화하세요'],
      low: ['헬스장이 적어요, 주거 배후가 있으면 기회예요'],
    },
    traffic: {
      high: ['오피스 직장인 수요를 노릴 수 있어요'],
      low: ['주거 배후 회원이 핵심이에요'],
    },
    anchor: {
      near: ['역 근처라 퇴근 후 운동 수요가 있어요'],
      far: ['주거지 근처가 더 중요해요, 동네 헬스장이 되세요'],
    },
    general: ['헬스장은 초기 투자가 커요, 회원 유지율이 수익을 결정해요'],
  },

  academy: {
    competition: {
      high: ['학원이 ${sameCategory}개 있어요, 전문 과목으로 차별화하세요'],
      low: ['학원이 적어요, 학생 수요가 있는지 확인하세요'],
    },
    traffic: {
      high: ['유동보다 학교 근처가 더 중요해요'],
      low: ['배후 학생 수가 핵심이에요'],
    },
    anchor: {
      near: ['역보다 학교 근처가 더 중요해요'],
      far: ['학교 밀집 지역인지 확인하세요'],
    },
    general: ['학원은 입소문이 전부예요, 실력으로 결과를 내야 해요'],
  },
}

// ===== 전체 템플릿 목록 =====

export const allTemplates: Template[] = [
  ...competitionTemplates,
  ...trafficTemplates,
  ...costTemplates,
  ...survivalTemplates,
  ...anchorTemplates,
  ...areaTypeTemplates,
  ...combinationTemplates,
]
