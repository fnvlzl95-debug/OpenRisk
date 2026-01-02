# OpenRisk v2.0 해석 문장 다양화 시스템

## 개요

### 핵심 컨셉: "말리는 친구"
OpenRisk의 포지션은 **창업 실패를 막는 것** = 섣부른 창업을 말리는 것

- 부정적 지표: 명확히 경고 (판사처럼 선고 X, 친구처럼 말림 O)
- 긍정적 지표: 함정도 알려줌
- 나쁜 조합: 더 강하게 말림

### 톤 가이드라인

**좋은 예시:**
- "~라서 힘들 수 있어요" (현실 직시)
- "~인데 괜찮으시겠어요?" (재고 유도)
- "~때문에 쉽지 않아요" (리스크 강조)

**나쁜 예시:**
- "창업 권장하지 않습니다" (법적 책임 회피형)
- "실패합니다" (예언자형)
- 모든 걸 긍정적으로 포장 (거짓 희망)

---

## 아키텍처

```
lib/v2/interpretations/
├── index.ts           # 엔트리 포인트
├── conditions.ts      # 조건 조합 정의, 레벨 판별, 유틸리티
├── templates.ts       # 문장 템플릿 풀 (공통 + 19개 업종별)
└── generator.ts       # 조합 기반 문장 생성기
```

### 데이터 흐름

```
AllMetrics (7대 지표)
    ↓
buildDynamicVars() → 동적 변수 생성
    ↓
generateContextualExplanations() → 지표별 해석 문장
    ↓
selectPhrase() → H3 ID 해시 기반 일관된 문장 선택
    ↓
interpolate() → ${변수} 치환
    ↓
easyExplanations (7개 해석 문장)
```

---

## 조건 조합 매트릭스

### 경쟁 × 유동인구 (9가지 조합)

| 경쟁\유동 | 낮음 | 보통 | 높음 |
|----------|------|------|------|
| **낮음** | 배후수요 확인 필요 | 선점 기회 있음 | 블루오션 가능성 |
| **보통** | 안정적 운영 가능 | 검증된 시장 | 성장 잠재력 |
| **높음** | 차별화 필수 | 경쟁 대비 필요 | 체력전 예상 |

### 임대료 × 상권유형 (12가지 조합)

| 임대료\상권 | A_주거 | B_혼합 | C_상업 | D_특수 |
|------------|--------|--------|--------|--------|
| **낮음** | 안정 운영 | 비용 효율 | 희소 기회 | 시즌 대비 |
| **보통** | 적정 규모 | 균형 잡힌 | 표준 상권 | 변동성 체크 |
| **높음** | 수익성 확인 | 고정비 압박 | 고회전 필수 | 리스크 높음 |

---

## 레벨 판별 기준

### 경쟁 밀도 (sameCategory)
- `low`: 5개 이하
- `medium`: 6~15개
- `high`: 16개 이상

### 유동인구 지수 (traffic.index)
- `low`: 20 미만
- `medium`: 20~50
- `high`: 50 이상

### 임대료 (avgRent, 만원/평)
- `low`: 80만원 이하
- `medium`: 81~150만원
- `high`: 150만원 초과

### 폐업률 (closureRate, %)
- `low`: 30% 이하
- `medium`: 31~50%
- `high`: 50% 초과

---

## 템플릿 구조

### 공통 템플릿 (Template)

```typescript
interface Template {
  id: string                    // 'comp_high_traffic_low'
  conditions: ConditionSet      // 매칭 조건
  phrases: string[]             // 여러 표현 (랜덤/해시 선택)
  tone: 'positive' | 'caution' | 'warning' | 'critical'
  actionHint?: string           // 대응책 힌트
}
```

### 업종별 템플릿 (CategoryTemplateSet)

```typescript
interface CategoryTemplateSet {
  competition: { high: string[]; low: string[] }
  traffic: { high: string[]; low: string[] }
  anchor: { near: string[]; far: string[] }
  general: string[]
}
```

---

## 동적 변수

문장 내 `${변수명}` 형태로 사용됨:

| 변수 | 설명 | 예시 |
|------|------|------|
| `categoryName` | 업종명 | "카페" |
| `sameCategory` | 동종 업체 수 | 18 |
| `totalStores` | 전체 점포 수 | 45 |
| `avgRent` | 평균 임대료 | 150 |
| `closureRate` | 폐업률 | 35.5 |
| `trafficIndex` | 유동인구 지수 | 65 |
| `peakTimeLabel` | 피크 시간대 | "저녁" |
| `subwayName` | 가까운 역명 | "강남역" |
| `subwayDistance` | 역까지 거리(m) | 150 |
| `areaTypeLabel` | 상권 유형 라벨 | "상업 중심지" |

---

## 지원 업종 (19개)

### 카페/베이커리 (3개)
- `cafe` - 카페
- `bakery` - 베이커리
- `dessert` - 디저트

### 음식점 (7개)
- `restaurant_korean` - 한식
- `restaurant_western` - 양식
- `restaurant_japanese` - 일식
- `restaurant_chinese` - 중식
- `restaurant_chicken` - 치킨
- `restaurant_pizza` - 피자
- `restaurant_fastfood` - 패스트푸드

### 주점 (1개)
- `bar` - 바/술집

### 소매 (2개)
- `convenience` - 편의점
- `mart` - 슈퍼마켓

### 서비스 (4개)
- `beauty` - 미용실
- `nail` - 네일샵
- `laundry` - 세탁소
- `pharmacy` - 약국

### 기타 (2개)
- `gym` - 헬스장
- `academy` - 학원

---

## 문장 예시

### 경쟁 높음 + 유동 낮음 (최악)
```
"경쟁은 치열한데 지나다니는 사람도 적어요, 솔직히 조건이 안 좋아요"
"${sameCategory}개나 있는데 유동인구가 적어요, 다른 곳도 살펴보시는 게 좋겠어요"
```

### 업종별 (카페)
```
경쟁 높음:
"카페가 ${sameCategory}개나 있어요, 시그니처 메뉴 없으면 묻혀요"

경쟁 낮음:
"카페가 적어서 선점 효과를 기대할 수 있어요"
```

### 앵커 (역세권)
```
"${subwayName} ${subwayDistance}m로 유입이 안정적이에요"
"단, 역세권은 임대료와 경쟁도 높다는 점 기억하세요"
```

---

## 일관성 보장

H3 ID 해시를 사용하여 같은 위치에서는 항상 같은 문장이 선택됨:

```typescript
function selectPhrase(phrases: string[], h3Id?: string): string {
  if (phrases.length === 0) return ''
  if (phrases.length === 1) return phrases[0]

  const index = h3Id
    ? hashString(h3Id) % phrases.length
    : Math.floor(Math.random() * phrases.length)

  return phrases[index]
}
```

---

## 사용법

### riskEngine.ts에서 호출

```typescript
import {
  generateContextualExplanations,
  generateSummary,
  generateTopFactors,
  buildDynamicVars,
  type AllMetrics,
} from './interpretations'

// 메트릭스 구조 변환
const allMetrics: AllMetrics = {
  competition: metrics.competition,
  traffic: metrics.traffic,
  cost: metrics.cost,
  survival: metrics.survival,
  anchors: metrics.anchors,
  areaType: currentAreaType,
  category,
}

// 해석 문장 생성
const easyExplanations = generateContextualExplanations({
  metrics: allMetrics,
  categoryName,
  categoryKey: category,
  h3Id,
})
```

---

## 향후 확장

1. **더 많은 조합 템플릿** - 3개 이상 지표 조합
2. **시간대별 템플릿** - 아침/점심/저녁 피크에 따른 분기
3. **트렌드 템플릿** - 점포 수 증감 추세 반영
4. **A/B 테스트** - 문장 효과 측정 및 최적화
