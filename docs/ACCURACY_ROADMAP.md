# OpenRisk 정확도 개선 로드맵

> 작성일: 2024-12-30
> 버전: 1.0
> 목적: 상권 리스크 판별 정확도를 체계적으로 개선하기 위한 전략 및 구현 가이드

---

## 목차

1. [현재 상태 분석](#1-현재-상태-분석)
2. [핵심 문제 정의](#2-핵심-문제-정의)
3. [해결 방향: 2단 레이어 판별](#3-해결-방향-2단-레이어-판별)
4. [경계 밖 문제 해결 방안](#4-경계-밖-문제-해결-방안)
5. [정확도를 올리는 핵심 지표](#5-정확도를-올리는-핵심-지표)
6. [구현 로드맵](#6-구현-로드맵)
7. [Phase 2 상세 설계](#7-phase-2-상세-설계)
8. [Phase 3 상세 설계](#8-phase-3-상세-설계)
9. [Phase 4 상세 설계](#9-phase-4-상세-설계)
10. [데이터 요구사항](#10-데이터-요구사항)
11. [의사결정 포인트](#11-의사결정-포인트)
12. [성공 지표](#12-성공-지표)

---

## 1. 현재 상태 분석

### 1.1 기존 계획 (PLAN_V1.md)에서 의도한 설계

#### 등급 체계

| 등급 | 이름 | 난이도 | 핵심 테마 |
|------|------|--------|----------|
| A | 주거 (Safe Zone) | ★☆☆☆☆ | 생활 밀착, 안정성, 반복 소비 |
| B | 혼합 (Gray Zone) | ★★★☆☆ | 시간차 공격 전략, 착시 주의 |
| C | 상업 (High Risk) | ★★★★★ | 속도전, 비용 압박, 트렌드 함정 |
| D | 특수 (Special) | 측정불가 | 고립, 조건부, 특수 목적 |

#### 원래 설계된 8개 지표

| 지표 | 변수명 | 설명 | 범위 |
|------|--------|------|------|
| 주거지수 | `resident_index` | 해당 상권 내 거주 인구 밀도 | 0~1 |
| 직장지수 | `worker_index` | 해당 상권 내 직장인 밀도 | 0~1 |
| 유동지수 | `traffic_index` | 유동인구 규모 (만 단위 정규화) | 0~1 |
| 시간대 편차 | `daypart_variance` | 시간대별 유동인구 분산 정도 | 0~1 |
| 주말 비율 | `weekend_ratio` | 주말 유동인구 / 전체 유동인구 | 0~1 |
| 경쟁 밀도 | `competition_density` | 동일 업종 점포 밀집도 | 0~1 |
| 개폐업 변동 | `open_close_churn` | (개업 + 폐업) / 전체 점포수 | 0~1 |
| 비용 압박 | `cost_proxy` | 임대료/권리금 추정 프록시 | 0~1 |

#### 원래 등급 산출 공식

```
A_score = resident × 0.4 + (1 - daypart_variance) × 0.3 + (1 - cost_proxy) × 0.3
B_score = mix(resident, worker) × 0.4 + daypart_variance × 0.3 + weekday_weekend_gap × 0.3
C_score = traffic × 0.3 + competition × 0.3 + churn × 0.2 + cost_proxy × 0.2
D_score = special_flag (병원/대학/산단/관광 의존도)

최종 등급 = argmax(A_score, B_score, C_score, D_score)
신뢰도 = sigmoid(top_score - second_score)
```

### 1.2 현재 구현 상태

#### 사용 중인 지표 (3개만)

| 지표 | 현재 사용 | 비고 |
|------|----------|------|
| `traffic_index` | ✅ | 유동인구 |
| `daypart_variance` | ✅ | 시간대 편차 |
| `weekend_ratio` | ✅ | 주말 비율 |
| `resident_index` | ❌ | DB에 있으나 미사용 |
| `worker_index` | ❌ | DB에 있으나 미사용 |
| `competition_density` | ❌ | DB 컬럼 있음, 데이터 없음 |
| `open_close_churn` | ❌ | DB 컬럼 있음, 데이터 없음 |
| `cost_proxy` | ❌ | DB 컬럼 있음, 데이터 없음 |

#### 현재 등급 로직 (gradeEngine.ts:36~74)

```typescript
export function calculateGrade(metrics: GradeInput): GradeResult {
  const { traffic_index, daypart_variance, weekend_ratio } = metrics

  // 정규화 (0~1 스케일)
  const trafficScore = Math.min(traffic_index / 1000, 1)
  const varianceScore = daypart_variance
  const weekendScore = weekend_ratio

  // 등급 결정 로직 - 단순 임계값 기반
  let grade: Grade
  let confidence: number

  // A등급: 유동인구 적고 편차 낮음 (주거형)
  if (trafficScore < 0.2 && varianceScore < 0.3) {
    grade = 'A'
    confidence = 0.8 + (1 - trafficScore) * 0.1
  }
  // B등급: 중간 수준 (혼합형)
  else if (trafficScore < 0.5 && varianceScore < 0.5) {
    grade = 'B'
    confidence = 0.7 + (0.5 - trafficScore) * 0.2
  }
  // C등급: 유동인구 많거나 편차 높음 (상업형)
  else if (trafficScore >= 0.5 || varianceScore >= 0.5) {
    grade = 'C'
    confidence = 0.65 + trafficScore * 0.2
  }
  // D등급: 분류 불가 (특수형)
  else {
    grade = 'D'
    confidence = 0.6
  }

  return { grade, confidence, reasons }
}
```

**문제점:**
- 3개 지표만으로 4개 등급을 구분하는 것은 신뢰도가 낮음
- 폐업률(churn), 경쟁밀도(competition), 비용압박(cost)이 없어 "폐업 리스크" 판단 불가
- 단순 임계값 기반이라 경계 케이스에서 오판 발생

#### 현재 위치 매칭 로직

```typescript
// app/api/analyze/route.ts
async function findAreaByPoint(lat: number, lng: number) {
  const { data } = await supabase.rpc('find_area_by_point', {
    p_lat: lat,
    p_lng: lng
  })
  // 폴리곤 포함 → 없으면 nearest fallback (거리 제한 없음!)
  return data[0]
}
```

**문제점:**
- nearest fallback에 거리 제한이 없음
- 상권에서 1km 떨어져도 그 상권 데이터를 사용
- 사용자에게 "이건 근처 상권 기준" 안내 없음

---

## 2. 핵심 문제 정의

### 2.1 "정확하게 판별"을 가로막는 구조적 한계

#### 문제 1: 상권 단위 평균값의 한계

```
예시: 홍대 상권

홍대입구역 바로 앞 (메인 상권)
├─ 유동인구: 매우 높음
├─ 임대료: 매우 높음
├─ 경쟁: 치열
└─ 리스크: 매우 높음

홍대입구역에서 500m 떨어진 골목
├─ 유동인구: 중간
├─ 임대료: 중간
├─ 경쟁: 보통
└─ 리스크: 중간

→ 둘 다 "홍대 상권"으로 같은 등급을 받으면 오판
→ "골목 한 블록 차이"를 상권 평균값으로는 담을 수 없음
```

#### 문제 2: 폴리곤 커버리지 밖

```
┌─────────────────────────────────────┐
│         홍대 상권 폴리곤              │
│    ┌───────────────────┐            │
│    │                   │            │
│    │   폴리곤 내부      │            │
│    │   (데이터 있음)    │  ← IN      │
│    │                   │            │
│    └───────────────────┘            │
│                                     │
│              ●                      │ ← 사용자가 찍은 핀
│           (폴리곤 밖)                │    (OUTSIDE)
│                                     │
└─────────────────────────────────────┘

현재: 폴리곤 밖이면 가장 가까운 상권 데이터를 사용 (nearest)
문제: 거리가 1km여도 그 데이터를 쓰면 의미 없음
```

#### 문제 3: 폐업 = 복합 결과

```
폐업에 영향을 미치는 변수들:

1. 상권 특성 (우리가 분석하는 것)
   - 유동인구, 경쟁, 임대료, 변동성

2. 업종 특성 (업종별로 다름)
   - 카페 vs 술집 vs 음식점 폐업률 다름
   - 같은 상권이라도 업종에 따라 리스크 다름

3. 운영 역량 (측정 불가)
   - 마케팅, 서비스, 자금력, 경험

4. 외부 요인 (예측 불가)
   - 경기, 계절, 트렌드, 코로나 같은 이벤트

→ "폐업률" 하나로 모든 걸 설명하면 오판
→ 업종별로, 기간별로, 기준선 대비로 봐야 함
```

### 2.2 사용자가 겪는 실제 문제

| 상황 | 현재 결과 | 문제점 |
|------|----------|--------|
| "홍대 검색했는데, 내 자리는 홍대 상권 경계 밖" | 홍대 데이터로 C등급 | 실제 리스크와 다를 수 있음 |
| "C등급이라는데, 왜 C인지?" | 유동인구 높음, 시간대 편차 높음 | 폐업률/경쟁/비용 근거 없음 |
| "이 자리에서 카페 하면 될까?" | 등급만 나옴 | 업종별 분석 불가 |
| "내 자리가 상권 어디쯤이야?" | 상권명만 나옴 | 상권 내 위치(메인/외곽) 안내 없음 |

---

## 3. 해결 방향: 2단 레이어 판별

### 3.1 설계 철학

> **"등급 하나로 모든 걸 맞추려 하지 말고,**
> **등급(큰 구조) + 반경(내 자리)로 정확도를 만든다"**

기존 접근: `지점 → 상권 매칭 → 상권 등급 → 끝`

새로운 접근:
```
지점 → 상권 매칭 → 상권 등급 (Lv3.5: 큰 구조)
  ↓
지점 → 반경 집계 → 내 자리 신호 (Lv4: 디테일)
  ↓
종합 리포트 (등급 + 신호 + 주의사항)
```

### 3.2 레이어 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer A: Macro (Lv3.5) - 상권 단위                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  목적: "이 지역의 기본 체질(DNA)"을 파악                                   │
│                                                                         │
│  데이터 단위: 상권 폴리곤 (서울시 공식 상권 경계)                           │
│                                                                         │
│  판정 결과: A/B/C/D 등급                                                 │
│    - A_주거: 안정적, 생활밀착, 반복소비                                    │
│    - B_혼합: 시간차 전략 필요, 착시 주의                                   │
│    - C_상업: 고위험/고수익, 비용압박, 트렌드 민감                           │
│    - D_특수: 특정 시설 의존, 일반 이론 불가                                │
│                                                                         │
│  사용 지표 (8개):                                                        │
│    1. resident_index     (주거지수)                                      │
│    2. worker_index       (직장지수)                                      │
│    3. traffic_index      (유동지수)                                      │
│    4. daypart_variance   (시간대 편차)                                   │
│    5. weekend_ratio      (주말 비율)                                     │
│    6. competition_density (경쟁 밀도)                                    │
│    7. open_close_churn   (개폐업 변동)                                   │
│    8. cost_proxy         (비용 압박)                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Layer B: Micro (Lv4) - 핀 기준 반경                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  목적: "내 자리의 디테일"을 파악                                           │
│                                                                         │
│  데이터 단위: 핀 기준 반경 200~500m                                       │
│                                                                         │
│  판정 결과: 신호(Signal) 집합                                            │
│    - 업종 구성 (밥/술/카페/기타 비율)                                      │
│    - 동일 업종 경쟁 밀도                                                  │
│    - 주야 성격 (MEAL / ALCOHOL / MIXED)                                  │
│    - 앵커 존재 (역/대학/병원/관광지)                                       │
│    - 광고 의존 신호 (ALI / ADI / MCP)                                     │
│    - 관광 의존 신호 (TDI)                                                │
│                                                                         │
│  사용 데이터:                                                            │
│    - 점포 위치/업종 (소상공인시장진흥공단)                                  │
│    - POI (역, 대학, 병원, 관광지)                                         │
│    - 업종별 폐업 통계                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  Output: 종합 리포트                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 등급 (Lv3.5)                                                        │
│     "이 지역은 C_상업 등급입니다 (신뢰도 78%)"                             │
│                                                                         │
│  2. 위치 상태                                                            │
│     "상권 내부입니다" / "상권에서 320m 거리입니다 (참고용)"                  │
│                                                                         │
│  3. 핵심 해석 (UX Copy)                                                  │
│     "사람은 많지만, 그만큼 경쟁자가 많고 월세가 높습니다"                    │
│                                                                         │
│  4. 등급 근거 (상위 3개 지표)                                             │
│     - 경쟁 밀도: 88% (높음)                                              │
│     - 개폐업 변동: 72% (높음)                                             │
│     - 비용 압박: 65% (높음)                                              │
│                                                                         │
│  5. 내 자리 신호 (Lv4)                                                   │
│     - "이 반경 500m 내 카페 12개, 경쟁 밀도 상위 20%"                      │
│     - "야간 유동이 많아 술집/바 업종 유리"                                  │
│     - "홍대입구역(앵커)에서 200m, 유입 기대 가능"                           │
│                                                                         │
│  6. 추천 액션 / 주의 리스크                                               │
│     - 액션: "최소 6개월 고정비 버틸 자금 확보"                              │
│     - 리스크: "트렌드 변화 민감, 마케팅 경쟁 심화"                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 레이어별 역할 분담

| 질문 | 담당 레이어 | 답변 형태 |
|------|------------|----------|
| "이 지역이 안전해?" | Lv3.5 (등급) | "A등급 - 주거형 Safe Zone" |
| "왜 위험해?" | Lv3.5 (근거) | "경쟁밀도 88%, 변동성 72%" |
| "내 자리는 괜찮아?" | Lv4 (반경) | "반경 300m 카페 8개, 경쟁 과밀" |
| "카페 해도 될까?" | Lv4 (업종) | "이 상권 카페 폐업률 서울 평균 대비 1.3배" |
| "어떤 업종이 좋아?" | Lv4 (신호) | "야간 유동 많아 술집 유리" |

---

## 4. 경계 밖 문제 해결 방안

### 4.1 현재 문제

```typescript
// 현재 로직 (find_area_by_point RPC)
1. ST_Contains(polygon, point) → 폴리곤 내부면 해당 상권 반환
2. 없으면 → ST_Distance 최소인 nearest 상권 반환 (거리 제한 없음!)

문제:
- nearest 상권이 1km 떨어져도 그 데이터를 사용
- 사용자는 "내 위치의 데이터"라고 착각
- 신뢰도 하락
```

### 4.2 해결책 1: 위치 상태 분류 (IN/NEAR/OUTSIDE)

```typescript
type LocationStatus = 'IN' | 'NEAR' | 'OUTSIDE'

interface LocationInfo {
  status: LocationStatus
  areaId: string
  areaName: string
  distance?: number  // NEAR/OUTSIDE일 때 거리(m)
  confidenceNote: string
}

// 판정 로직
function classifyLocation(point: Point, areas: TradeArea[]): LocationInfo {
  // 1. 폴리곤 내부 검사
  const containingArea = areas.find(a => ST_Contains(a.polygon, point))
  if (containingArea) {
    return {
      status: 'IN',
      areaId: containingArea.id,
      areaName: containingArea.name,
      confidenceNote: '상권 내부에 위치합니다.'
    }
  }

  // 2. 가장 가까운 상권 찾기
  const nearest = findNearestArea(point, areas)
  const distance = ST_Distance(nearest.polygon, point)

  // 3. 거리에 따른 분류
  if (distance <= 500) {
    return {
      status: 'NEAR',
      areaId: nearest.id,
      areaName: nearest.name,
      distance: Math.round(distance),
      confidenceNote: `${nearest.name} 상권에서 ${Math.round(distance)}m 거리입니다. 참고용 데이터입니다.`
    }
  } else {
    return {
      status: 'OUTSIDE',
      areaId: nearest.id,
      areaName: nearest.name,
      distance: Math.round(distance),
      confidenceNote: `가장 가까운 상권(${nearest.name})에서 ${Math.round(distance)}m 떨어져 있습니다. 분석 정확도가 낮습니다.`
    }
  }
}
```

#### UI 표시 예시

```
┌─────────────────────────────────────────────────────────────┐
│ IN (상권 내부)                                               │
├─────────────────────────────────────────────────────────────┤
│ 📍 홍대입구역 인근                                           │
│ ✅ 상권 내부에 위치합니다                                     │
│                                                             │
│ 등급: C_상업 (신뢰도 78%)                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ NEAR (상권 인접)                                             │
├─────────────────────────────────────────────────────────────┤
│ 📍 홍대입구역 인근에서 320m                                   │
│ ⚠️ 상권 경계 밖입니다. 참고용 데이터입니다.                   │
│                                                             │
│ 등급: C_상업 (신뢰도 65% - 거리 보정)                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ OUTSIDE (상권 외부)                                          │
├─────────────────────────────────────────────────────────────┤
│ 📍 가장 가까운 상권: 홍대입구역 인근 (850m)                   │
│ ❌ 분석 가능한 상권 범위 밖입니다.                            │
│                                                             │
│ 이 지역은 등록된 상권 데이터가 없습니다.                      │
│ 주변 상권 참고: 홍대입구역 인근 (C_상업)                      │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 해결책 2: Blending (다중 상권 거리 가중 평균)

#### 원리

```
핀 주변의 여러 상권을 가져와서,
거리가 가까울수록 가중치를 높게 주어 평균 산출

예시:
- 상권 A: 200m (가중치 0.5)
- 상권 B: 400m (가중치 0.25)
- 상권 C: 800m (가중치 0.125)

blended_metrics = A × 0.5 + B × 0.25 + C × 0.125 (정규화)
```

#### 구현

```typescript
interface BlendedMetrics {
  traffic_index: number
  daypart_variance: number
  weekend_ratio: number
  competition_density: number
  open_close_churn: number
  cost_proxy: number
  blend_confidence: number  // 혼합 신뢰도
  contributing_areas: {
    areaId: string
    areaName: string
    distance: number
    weight: number
  }[]
}

async function getBlendedMetrics(
  lat: number,
  lng: number,
  maxDistance: number = 1000,  // 최대 탐색 거리(m)
  maxAreas: number = 5         // 최대 상권 수
): Promise<BlendedMetrics> {
  // 1. 주변 상권 조회 (거리순)
  const nearbyAreas = await supabase.rpc('find_nearby_areas', {
    p_lat: lat,
    p_lng: lng,
    p_max_distance: maxDistance,
    p_limit: maxAreas
  })

  if (!nearbyAreas || nearbyAreas.length === 0) {
    throw new Error('주변에 분석 가능한 상권이 없습니다.')
  }

  // 2. 거리 기반 가중치 계산 (역제곱 방식)
  const weights = nearbyAreas.map(area => ({
    ...area,
    weight: 1 / Math.pow(area.distance + 1, 2)  // +1은 0 방지
  }))

  // 3. 가중치 정규화
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const normalizedWeights = weights.map(w => ({
    ...w,
    weight: w.weight / totalWeight
  }))

  // 4. 각 상권의 metrics 조회
  const metricsPromises = normalizedWeights.map(async (w) => {
    const { data } = await supabase
      .from('area_metrics')
      .select('*')
      .eq('area_id', w.areaId)
      .order('period', { ascending: false })
      .limit(1)
      .single()
    return { ...w, metrics: data }
  })
  const areasWithMetrics = await Promise.all(metricsPromises)

  // 5. 가중 평균 계산
  const blended = {
    traffic_index: 0,
    daypart_variance: 0,
    weekend_ratio: 0,
    competition_density: 0,
    open_close_churn: 0,
    cost_proxy: 0
  }

  for (const area of areasWithMetrics) {
    if (!area.metrics) continue
    blended.traffic_index += (area.metrics.traffic_index || 0) * area.weight
    blended.daypart_variance += (area.metrics.daypart_variance || 0) * area.weight
    blended.weekend_ratio += (area.metrics.weekend_ratio || 0) * area.weight
    blended.competition_density += (area.metrics.competition_density || 0) * area.weight
    blended.open_close_churn += (area.metrics.open_close_churn || 0) * area.weight
    blended.cost_proxy += (area.metrics.cost_proxy || 0) * area.weight
  }

  // 6. 혼합 신뢰도 계산 (가장 가까운 상권 비중 기반)
  const topWeight = normalizedWeights[0]?.weight || 0
  const blend_confidence = Math.min(topWeight * 1.5, 0.95)  // 최대 95%

  return {
    ...blended,
    blend_confidence,
    contributing_areas: normalizedWeights.map(w => ({
      areaId: w.areaId,
      areaName: w.areaName,
      distance: w.distance,
      weight: w.weight
    }))
  }
}
```

#### SQL 함수 (find_nearby_areas)

```sql
CREATE OR REPLACE FUNCTION find_nearby_areas(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_max_distance DOUBLE PRECISION DEFAULT 1000,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  area_id TEXT,
  area_name TEXT,
  district TEXT,
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ta.id AS area_id,
    ta.name AS area_name,
    ta.district,
    ST_Distance(
      ta.polygon::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance
  FROM trade_areas ta
  WHERE ST_DWithin(
    ta.polygon::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_max_distance
  )
  ORDER BY distance
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### 4.4 해결책 3: Grid 기반 지표 (최종 해결책)

#### 원리

```
서울 전체를 250m × 250m (또는 500m) 격자로 쪼개고,
각 격자에 대해 지표를 미리 집계해둠

→ 어떤 지점이든 해당 격자의 데이터로 판별 가능
→ 폴리곤 커버리지 빈틈 문제가 구조적으로 해결됨
```

#### 테이블 설계

```sql
-- 격자 셀
CREATE TABLE grid_cells (
  id TEXT PRIMARY KEY,                    -- "grid_37.556_126.923"
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  cell_size INTEGER NOT NULL,             -- 250 or 500 (meters)
  geometry GEOMETRY(POLYGON, 4326) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX grid_cells_geom_idx ON grid_cells USING GIST(geometry);

-- 격자별 지표
CREATE TABLE grid_metrics (
  id SERIAL PRIMARY KEY,
  grid_id TEXT REFERENCES grid_cells(id),
  period TEXT NOT NULL,                   -- "2024-12"

  -- 기본 지표
  store_count INTEGER,                    -- 총 점포 수
  resident_count INTEGER,                 -- 거주 인구
  worker_count INTEGER,                   -- 직장인 수
  traffic_index REAL,                     -- 유동인구 지수

  -- 업종별 점포 수
  store_food INTEGER,                     -- 음식점
  store_cafe INTEGER,                     -- 카페
  store_bar INTEGER,                      -- 술집
  store_retail INTEGER,                   -- 소매
  store_service INTEGER,                  -- 서비스

  -- 폐업 지표
  closure_count INTEGER,                  -- 폐업 점포 수
  closure_rate REAL,                      -- 폐업률
  closure_food REAL,                      -- 음식점 폐업률
  closure_cafe REAL,                      -- 카페 폐업률
  closure_bar REAL,                       -- 술집 폐업률

  -- 경쟁/비용
  competition_density REAL,               -- 경쟁 밀도
  churn_rate REAL,                        -- 변동률
  rent_proxy REAL,                        -- 임대료 프록시

  -- 시간대/요일
  daypart_variance REAL,
  weekend_ratio REAL,

  UNIQUE(grid_id, period)
);

CREATE INDEX grid_metrics_grid_idx ON grid_metrics(grid_id);
CREATE INDEX grid_metrics_period_idx ON grid_metrics(period);
```

#### 격자 생성 쿼리

```sql
-- 서울 영역을 250m 격자로 생성
INSERT INTO grid_cells (id, center_lat, center_lng, cell_size, geometry)
SELECT
  'grid_' || ROUND(lat::numeric, 4) || '_' || ROUND(lng::numeric, 4),
  lat,
  lng,
  250,
  ST_SetSRID(ST_MakeEnvelope(
    lng - 0.00125,  -- 약 125m (위도 37도 기준)
    lat - 0.00112,  -- 약 125m
    lng + 0.00125,
    lat + 0.00112
  ), 4326)
FROM generate_series(37.42, 37.70, 0.00225) AS lat,  -- 서울 위도 범위
     generate_series(126.76, 127.18, 0.0025) AS lng; -- 서울 경도 범위
```

#### 격자 기반 조회

```typescript
async function getGridMetrics(lat: number, lng: number) {
  const { data } = await supabase.rpc('find_grid_by_point', {
    p_lat: lat,
    p_lng: lng
  })

  if (!data) {
    return null  // 서울 외 지역
  }

  const { data: metrics } = await supabase
    .from('grid_metrics')
    .select('*')
    .eq('grid_id', data.id)
    .order('period', { ascending: false })
    .limit(1)
    .single()

  return metrics
}
```

---

## 5. 정확도를 올리는 핵심 지표

### 5.1 폐업 방지 관점에서 가장 강한 시그널

| 순위 | 지표 | 설명 | 왜 중요한가 |
|------|------|------|------------|
| 1 | **업종별 폐업률** | 최근 3~6개월 동일 업종 폐업률 | "이 상권에서 카페가 얼마나 망했나"가 가장 직접적 |
| 2 | **변동성 (churn)** | (개업 + 폐업) / 점포수 | 높으면 "빨리 바뀌는 동네" = 불안정 |
| 3 | **비용 압박 (cost_proxy)** | 임대료 추정 지표 | 매출 대비 고정비가 높으면 버티기 어려움 |
| 4 | **경쟁 밀도** | 동일 업종 점포 / 전체 점포 | 같은 업종이 많으면 파이 쪼개기 |
| 5 | **광고 의존 신호** | 술/관광지 + 경쟁 과밀 + churn 상승 | 광고 안 하면 노출 자체가 안 됨 |

### 5.2 업종별 기준선 대비

#### 왜 필요한가

```
절대값만으로는 판단이 어려움:

"이 상권 카페 폐업률 15%"
→ 이게 높은 건가? 낮은 건가?

기준선 대비:
"서울 전체 카페 평균 폐업률: 12%"
→ 이 상권은 1.25배 높음 = 위험 신호
```

#### 구현

```typescript
interface IndustryBenchmark {
  industry: string         // "cafe", "restaurant", "bar"
  seoulAverage: number     // 서울 전체 평균
  gradeAAverage: number    // A등급 상권 평균
  gradeBAverage: number    // B등급 상권 평균
  gradeCAverage: number    // C등급 상권 평균
}

interface IndustryComparison {
  industry: string
  localRate: number        // 이 상권/반경의 값
  seoulAverage: number     // 서울 평균
  ratio: number            // localRate / seoulAverage
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
  description: string
}

function compareToBaseline(
  localRate: number,
  benchmark: IndustryBenchmark
): IndustryComparison {
  const ratio = localRate / benchmark.seoulAverage

  let riskLevel: IndustryComparison['riskLevel']
  let description: string

  if (ratio < 0.8) {
    riskLevel = 'LOW'
    description = `서울 평균보다 ${Math.round((1 - ratio) * 100)}% 낮음 (안정적)`
  } else if (ratio < 1.0) {
    riskLevel = 'MEDIUM'
    description = '서울 평균 수준'
  } else if (ratio < 1.3) {
    riskLevel = 'HIGH'
    description = `서울 평균보다 ${Math.round((ratio - 1) * 100)}% 높음 (주의)`
  } else {
    riskLevel = 'VERY_HIGH'
    description = `서울 평균보다 ${Math.round((ratio - 1) * 100)}% 높음 (위험)`
  }

  return {
    industry: benchmark.industry,
    localRate,
    seoulAverage: benchmark.seoulAverage,
    ratio,
    riskLevel,
    description
  }
}
```

### 5.3 표본 보정 (스무딩)

#### 왜 필요한가

```
반경 300m에 술집이 6개뿐인데 1개가 폐업했다면:
폐업률 = 1/6 = 16.7%

이게 진짜 위험한 건가?
→ 표본이 너무 작아서 1개 차이로 크게 요동침
→ "우연"인지 "구조적 문제"인지 구분 불가
```

#### 해결: 베이지안 스무딩

```typescript
/**
 * 베이지안 스무딩을 적용한 폐업률 계산
 *
 * 원리: 표본이 작을수록 서울 평균(prior)에 가깝게 조정
 *
 * @param localClosures - 해당 지역 폐업 수
 * @param localTotal - 해당 지역 전체 점포 수
 * @param baselineRate - 서울 전체 평균 폐업률
 * @param smoothingFactor - 스무딩 강도 (기본 10)
 */
function getSmoothedRate(
  localClosures: number,
  localTotal: number,
  baselineRate: number,
  smoothingFactor: number = 10
): {
  rawRate: number
  smoothedRate: number
  confidence: number
  note: string
} {
  const rawRate = localTotal > 0 ? localClosures / localTotal : 0

  // 베이지안 스무딩: (실제값 × n + 기준값 × k) / (n + k)
  const smoothedRate = (localClosures + baselineRate * smoothingFactor)
                     / (localTotal + smoothingFactor)

  // 신뢰도: 표본이 클수록 높음
  const confidence = Math.min(localTotal / (localTotal + smoothingFactor), 0.95)

  let note: string
  if (localTotal < 5) {
    note = '표본이 매우 적어 서울 평균 기준으로 보정되었습니다.'
  } else if (localTotal < 15) {
    note = '표본이 적어 일부 보정이 적용되었습니다.'
  } else {
    note = '충분한 표본으로 신뢰할 수 있는 데이터입니다.'
  }

  return {
    rawRate,
    smoothedRate,
    confidence,
    note
  }
}

// 사용 예시
const result = getSmoothedRate(1, 6, 0.12, 10)
// {
//   rawRate: 0.167,        // 원본: 16.7%
//   smoothedRate: 0.138,   // 보정: 13.8% (서울 평균 12%에 가깝게 조정)
//   confidence: 0.375,     // 신뢰도: 37.5% (표본 작음)
//   note: '표본이 매우 적어 서울 평균 기준으로 보정되었습니다.'
// }
```

---

## 6. 구현 로드맵

### 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 2: 가성비 최상 (1주일)                                            │
│  ├─ 8지표 룰 복원 (churn, competition, cost)                            │
│  ├─ IN/NEAR/OUTSIDE 상태 분류                                           │
│  └─ Blending (선택적)                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 3: Micro 레이어 (2~3주)                                          │
│  ├─ 핀 반경 Lv4 신호                                                    │
│  ├─ 업종별 기준선 대비                                                  │
│  └─ 표본 보정                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  Phase 4: Grid 고도화 (확장 시)                                          │
│  ├─ Grid 테이블 생성                                                    │
│  ├─ 주기적 ETL                                                          │
│  └─ Grid 기반 API                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 의존 관계

```
Phase 2 (기반)
    │
    ├── 8지표 데이터 적재 ──────────────────┐
    │                                       │
    ├── IN/NEAR/OUTSIDE ───┐               │
    │                       ↓               ↓
    └── Blending ───────> Phase 3 (Lv4) > Phase 4 (Grid)
```

---

## 7. Phase 2 상세 설계

### 7.1 목표

- 등급 신뢰도 향상 (3지표 → 8지표)
- 경계 밖 오해 방지 (IN/NEAR/OUTSIDE)
- nearest 억지 완화 (Blending)

### 7.2 작업 목록

| # | 작업 | 상세 | 예상 시간 |
|---|------|------|----------|
| 1 | 데이터 적재 | churn, competition, cost_proxy 데이터 DB 적재 | 2~4시간 |
| 2 | 등급 공식 수정 | gradeEngine.ts에 8지표 공식 적용 | 2~3시간 |
| 3 | 위치 상태 분류 | find_area_by_point 수정 + LocationStatus 반환 | 2~3시간 |
| 4 | API 응답 수정 | analyze/route.ts에 locationStatus 추가 | 1~2시간 |
| 5 | UI 업데이트 | 위치 상태별 안내 메시지 표시 | 2~3시간 |
| 6 | (선택) Blending | Blending 로직 구현 + API 연동 | 4~6시간 |

### 7.3 등급 공식 수정

#### 기존 코드

```typescript
// lib/engine/gradeEngine.ts (현재)
export function calculateGrade(metrics: GradeInput): GradeResult {
  // 3개 지표만 사용
  const { traffic_index, daypart_variance, weekend_ratio } = metrics
  // ... 단순 임계값 로직
}
```

#### 수정된 코드

```typescript
// lib/engine/gradeEngine.ts (수정)
export interface GradeInput {
  // 기존
  traffic_index: number
  daypart_variance: number
  weekend_ratio: number
  // 추가
  resident_index: number
  worker_index: number
  competition_density: number
  open_close_churn: number
  cost_proxy: number
}

export function calculateGrade(metrics: GradeInput): GradeResult {
  const {
    traffic_index,
    daypart_variance,
    weekend_ratio,
    resident_index,
    worker_index,
    competition_density,
    open_close_churn,
    cost_proxy
  } = metrics

  // 정규화 (0~1)
  const traffic = Math.min(traffic_index / 1000, 1)
  const variance = daypart_variance
  const weekend = weekend_ratio
  const resident = resident_index
  const worker = worker_index
  const competition = competition_density
  const churn = open_close_churn
  const cost = cost_proxy

  // 각 등급별 점수 계산
  const A_score = resident * 0.4 + (1 - variance) * 0.3 + (1 - cost) * 0.3
  const B_score = ((resident + worker) / 2) * 0.4 + variance * 0.3 + Math.abs(weekend - 0.5) * 0.3
  const C_score = traffic * 0.3 + competition * 0.3 + churn * 0.2 + cost * 0.2

  // D등급은 특수 조건으로 판정 (Phase 3에서 앵커 감지 후 적용)
  const D_score = 0

  // 최고 점수 등급 선택
  const scores = { A: A_score, B: B_score, C: C_score, D: D_score }
  const sortedGrades = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)

  const [topGrade, topScore] = sortedGrades[0]
  const [, secondScore] = sortedGrades[1]

  // 신뢰도 = 1등과 2등 점수 차이 기반
  const scoreDiff = topScore - secondScore
  const confidence = sigmoid(scoreDiff * 5)  // 5는 스케일 조정 상수

  // 근거 추출 (상위 3개 기여 지표)
  const reasons = extractTopReasons(metrics, topGrade as Grade)

  return {
    grade: topGrade as Grade,
    confidence,
    reasons
  }
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function extractTopReasons(metrics: GradeInput, grade: Grade): GradeReason[] {
  // 등급별 주요 지표와 기여도 계산
  const contributions: { key: string; value: number; contribution: number; label: string }[] = []

  if (grade === 'A') {
    contributions.push(
      { key: 'resident', value: metrics.resident_index, contribution: metrics.resident_index * 0.4, label: '주거 인구' },
      { key: 'variance', value: metrics.daypart_variance, contribution: (1 - metrics.daypart_variance) * 0.3, label: '시간대 안정성' },
      { key: 'cost', value: metrics.cost_proxy, contribution: (1 - metrics.cost_proxy) * 0.3, label: '비용 부담 낮음' }
    )
  } else if (grade === 'C') {
    contributions.push(
      { key: 'traffic', value: metrics.traffic_index / 1000, contribution: (metrics.traffic_index / 1000) * 0.3, label: '유동인구' },
      { key: 'competition', value: metrics.competition_density, contribution: metrics.competition_density * 0.3, label: '경쟁 밀도' },
      { key: 'churn', value: metrics.open_close_churn, contribution: metrics.open_close_churn * 0.2, label: '개폐업 변동' },
      { key: 'cost', value: metrics.cost_proxy, contribution: metrics.cost_proxy * 0.2, label: '비용 압박' }
    )
  }
  // B, D도 유사하게 추가

  return contributions
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map(({ key, value, label }) => ({ key, value, label }))
}
```

### 7.4 API 응답 수정

#### 현재 응답

```typescript
{
  area: { id, name, district, center, polygon },
  rawMetrics: { ... },
  lv3_5: { grade, gradeName, subTitle, difficulty, confidence, reasons, coreCopy, actions, risks }
}
```

#### 수정된 응답

```typescript
{
  // 위치 정보 (신규)
  location: {
    status: 'IN' | 'NEAR' | 'OUTSIDE',
    distance?: number,          // NEAR/OUTSIDE일 때
    confidenceNote: string,     // "상권 내부입니다" / "320m 거리입니다"
    point: { lat: number, lng: number }
  },

  area: {
    id: string,
    name: string,
    district: string,
    center: { lat: number, lng: number },
    polygon: GeoJSONPolygon | null
  },

  rawMetrics: {
    period: string,
    traffic_total: number,
    traffic_weekday: number,
    traffic_weekend: number,
    resident_index: number,
    worker_index: number,
    competition_density: number,    // 신규
    open_close_churn: number,       // 신규
    cost_proxy: number              // 신규
  },

  lv3_5: {
    grade: Grade,
    gradeName: string,
    subTitle: string,
    difficulty: number,
    confidence: number,
    confidenceAdjusted?: number,   // 거리 보정 후 신뢰도 (NEAR/OUTSIDE)
    reasons: GradeReason[],
    coreCopy: string[],
    actions: string[],
    risks: string[]
  },

  // Blending 정보 (선택적)
  blending?: {
    used: boolean,
    contributingAreas: {
      areaId: string,
      areaName: string,
      distance: number,
      weight: number
    }[]
  }
}
```

---

## 8. Phase 3 상세 설계

### 8.1 목표

- "내 자리" 정밀도 향상 (핀 반경 Lv4)
- 업종별 분석 가능 (기준선 대비)
- 소표본 오판 방지 (스무딩)

### 8.2 작업 목록

| # | 작업 | 상세 | 예상 시간 |
|---|------|------|----------|
| 1 | 점포 데이터 적재 | 소상공인시장진흥공단 데이터 DB 적재 | 1~2일 |
| 2 | 반경 집계 쿼리 | PostGIS 기반 반경 내 점포/업종 집계 | 4~6시간 |
| 3 | Lv4 신호 엔진 | signalEngine.ts 구현 | 1일 |
| 4 | 업종별 기준선 | benchmarks 테이블 + 비교 로직 | 4~6시간 |
| 5 | 표본 보정 | smoothing 함수 + 적용 | 2~3시간 |
| 6 | API 확장 | Lv4 신호 응답 추가 | 3~4시간 |
| 7 | UI 확장 | Lv4 신호 표시 컴포넌트 | 1일 |

### 8.3 핀 반경 집계

#### 테이블: stores (점포)

```sql
CREATE TABLE stores (
  id TEXT PRIMARY KEY,
  name TEXT,
  industry_code TEXT,         -- 업종 코드
  industry_name TEXT,         -- 업종명 (카페, 음식점 등)
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location GEOMETRY(POINT, 4326),
  address TEXT,
  status TEXT,                -- 'OPEN', 'CLOSED'
  opened_at DATE,
  closed_at DATE,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX stores_location_idx ON stores USING GIST(location);
CREATE INDEX stores_industry_idx ON stores(industry_code);
CREATE INDEX stores_status_idx ON stores(status);
```

#### 반경 집계 쿼리

```sql
CREATE OR REPLACE FUNCTION get_radius_stats(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_m DOUBLE PRECISION DEFAULT 300
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  WITH radius_stores AS (
    SELECT
      s.*,
      ST_Distance(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) AS distance
    FROM stores s
    WHERE ST_DWithin(
      s.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND s.status = 'OPEN'
  ),
  industry_counts AS (
    SELECT
      industry_name,
      COUNT(*) AS count
    FROM radius_stores
    GROUP BY industry_name
  ),
  closure_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE closed_at >= NOW() - INTERVAL '6 months') AS recent_closures,
      COUNT(*) AS total_stores
    FROM stores
    WHERE ST_DWithin(
      location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  )
  SELECT json_build_object(
    'total_stores', (SELECT COUNT(*) FROM radius_stores),
    'by_industry', (SELECT json_agg(row_to_json(ic)) FROM industry_counts ic),
    'recent_closures', (SELECT recent_closures FROM closure_stats),
    'closure_rate', (SELECT CASE WHEN total_stores > 0 THEN recent_closures::float / total_stores ELSE 0 END FROM closure_stats),
    'radius_m', p_radius_m
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### 8.4 Lv4 신호 엔진

```typescript
// lib/engine/signalEngine.ts

export interface RadiusStats {
  total_stores: number
  by_industry: { industry_name: string; count: number }[]
  recent_closures: number
  closure_rate: number
  radius_m: number
}

export interface Lv4Signal {
  key: string
  value: number | string
  level: 'INFO' | 'WARNING' | 'DANGER'
  description: string
}

export interface Lv4Result {
  radiusStats: RadiusStats
  signals: Lv4Signal[]
  industryComparisons: IndustryComparison[]
}

export async function calculateLv4Signals(
  lat: number,
  lng: number,
  targetIndustry?: string
): Promise<Lv4Result> {
  // 1. 반경 집계
  const radiusStats = await getRadiusStats(lat, lng, 300)

  // 2. 신호 생성
  const signals: Lv4Signal[] = []

  // 2-1. 경쟁 밀도 신호
  const targetCount = targetIndustry
    ? radiusStats.by_industry.find(i => i.industry_name === targetIndustry)?.count || 0
    : radiusStats.total_stores

  if (targetCount > 10) {
    signals.push({
      key: 'competition_high',
      value: targetCount,
      level: 'DANGER',
      description: `반경 ${radiusStats.radius_m}m 내 동일 업종 ${targetCount}개 (경쟁 과밀)`
    })
  } else if (targetCount > 5) {
    signals.push({
      key: 'competition_medium',
      value: targetCount,
      level: 'WARNING',
      description: `반경 ${radiusStats.radius_m}m 내 동일 업종 ${targetCount}개 (경쟁 있음)`
    })
  }

  // 2-2. 폐업률 신호 (스무딩 적용)
  const smoothed = getSmoothedRate(
    radiusStats.recent_closures,
    radiusStats.total_stores,
    0.12  // 서울 평균 12% 가정
  )

  if (smoothed.smoothedRate > 0.2) {
    signals.push({
      key: 'closure_high',
      value: `${(smoothed.smoothedRate * 100).toFixed(1)}%`,
      level: 'DANGER',
      description: `최근 6개월 폐업률 ${(smoothed.smoothedRate * 100).toFixed(1)}% (위험)`
    })
  }

  // 2-3. 업종 구성 신호
  const topIndustries = radiusStats.by_industry
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  const barRatio = radiusStats.by_industry
    .filter(i => i.industry_name.includes('술') || i.industry_name.includes('바'))
    .reduce((sum, i) => sum + i.count, 0) / radiusStats.total_stores

  if (barRatio > 0.3) {
    signals.push({
      key: 'nightlife_area',
      value: `${(barRatio * 100).toFixed(0)}%`,
      level: 'INFO',
      description: '야간 업종(술집/바) 비중 높음 - 야간 유동 유리'
    })
  }

  // 3. 업종별 기준선 비교
  const industryComparisons: IndustryComparison[] = []
  if (targetIndustry) {
    const benchmark = await getIndustryBenchmark(targetIndustry)
    const localRate = calculateIndustryClosureRate(radiusStats, targetIndustry)
    industryComparisons.push(compareToBaseline(localRate, benchmark))
  }

  return {
    radiusStats,
    signals,
    industryComparisons
  }
}
```

---

## 9. Phase 4 상세 설계

### 9.1 목표

- 서울 어디서든 분석 가능 (커버리지 100%)
- 폴리곤 빈틈 문제 완전 해결
- 성능 최적화 (사전 집계)

### 9.2 작업 목록

| # | 작업 | 상세 | 예상 시간 |
|---|------|------|----------|
| 1 | 격자 생성 | 서울 전체 250m 격자 생성 | 2~3시간 |
| 2 | ETL 파이프라인 | 격자별 지표 집계 스크립트 | 1~2일 |
| 3 | 스케줄링 | 월간/분기별 자동 집계 | 2~3시간 |
| 4 | API 수정 | Grid 기반 조회 로직 추가 | 4~6시간 |
| 5 | 성능 최적화 | 인덱스, 캐싱 | 1일 |

### 9.3 ETL 파이프라인

```typescript
// scripts/updateGridMetrics.ts

async function updateGridMetrics(period: string) {
  console.log(`[ETL] Starting grid metrics update for ${period}`)

  // 1. 모든 격자 조회
  const { data: grids } = await supabase
    .from('grid_cells')
    .select('id, center_lat, center_lng')

  console.log(`[ETL] Processing ${grids.length} grid cells`)

  // 2. 각 격자별 지표 계산
  for (const grid of grids) {
    const stats = await calculateGridStats(grid.center_lat, grid.center_lng, 250)

    // 3. DB에 저장 (upsert)
    await supabase
      .from('grid_metrics')
      .upsert({
        grid_id: grid.id,
        period,
        ...stats
      }, {
        onConflict: 'grid_id,period'
      })
  }

  console.log(`[ETL] Grid metrics update completed for ${period}`)
}

async function calculateGridStats(lat: number, lng: number, radius: number) {
  // stores 테이블에서 반경 내 점포 집계
  const { data } = await supabase.rpc('get_grid_stats', {
    p_lat: lat,
    p_lng: lng,
    p_radius: radius
  })

  return {
    store_count: data.store_count,
    store_food: data.by_industry.find(i => i.name === '음식점')?.count || 0,
    store_cafe: data.by_industry.find(i => i.name === '카페')?.count || 0,
    store_bar: data.by_industry.find(i => i.name === '술집')?.count || 0,
    closure_count: data.recent_closures,
    closure_rate: data.closure_rate,
    // ... 기타 지표
  }
}
```

### 9.4 Grid 기반 API

```typescript
// app/api/analyze/route.ts (Phase 4)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '')
  const lng = parseFloat(searchParams.get('lng') || '')

  // 1. 먼저 상권 폴리곤 체크
  const areaResult = await findAreaByPoint(lat, lng)

  // 2. 상권 내부면 기존 로직
  if (areaResult.status === 'IN') {
    return handleInAreaAnalysis(areaResult, lat, lng)
  }

  // 3. 상권 밖이면 Grid 기반 분석
  const gridMetrics = await getGridMetrics(lat, lng)

  if (!gridMetrics) {
    return NextResponse.json({
      error: '분석 가능한 지역이 아닙니다. (서울 외 지역)'
    }, { status: 404 })
  }

  // 4. Grid 데이터로 등급 계산
  const gradeResult = calculateGrade({
    traffic_index: gridMetrics.traffic_index,
    daypart_variance: gridMetrics.daypart_variance,
    weekend_ratio: gridMetrics.weekend_ratio,
    resident_index: gridMetrics.resident_count / 10000,
    worker_index: gridMetrics.worker_count / 10000,
    competition_density: gridMetrics.competition_density,
    open_close_churn: gridMetrics.churn_rate,
    cost_proxy: gridMetrics.rent_proxy
  })

  return NextResponse.json({
    location: {
      status: 'GRID',
      gridId: gridMetrics.grid_id,
      confidenceNote: '격자 기반 분석입니다. 정확한 상권 데이터는 없지만 주변 정보를 기반으로 분석했습니다.'
    },
    gridMetrics,
    lv3_5: {
      grade: gradeResult.grade,
      // ...
    }
  })
}
```

---

## 10. 데이터 요구사항

### Phase 2

| 데이터 | 출처 | 현재 상태 | 필요 작업 |
|--------|------|----------|----------|
| 개폐업 변동 (churn) | 서울시 상권분석서비스 | DB 컬럼 있음 | CSV 다운로드 → 적재 |
| 경쟁 밀도 | 서울시 상권분석서비스 | DB 컬럼 있음 | CSV 다운로드 → 적재 |
| 비용 압박 | 임대료 추정 or 프록시 | DB 컬럼 있음 | 추정 로직 또는 대체 데이터 |

### Phase 3

| 데이터 | 출처 | 비고 |
|--------|------|------|
| 점포 위치/업종 | 소상공인시장진흥공단 | 상가(상권)정보 API |
| 업종별 폐업 통계 | 서울시 상권분석서비스 | 기준선 산출용 |
| POI (역/대학/병원) | 공공데이터포털 | 앵커 감지용 |

### Phase 4

| 데이터 | 출처 | 비고 |
|--------|------|------|
| 유동인구 (격자) | SKT/KT 등 통신사 | 유료 또는 공공데이터 |
| 거주/직장 인구 | 통계청 | 행정동 단위 → 격자 배분 |

---

## 11. 의사결정 포인트

### Q1: Phase 2에서 Blending을 포함할까?

| 선택지 | 장점 | 단점 |
|--------|------|------|
| 포함 | 경계 케이스 UX 개선 | 개발 시간 +4~6시간 |
| 제외 | 빠른 배포 | nearest 억지 문제 유지 |

**추천: 포함**
- IN/NEAR/OUTSIDE만으로는 NEAR/OUTSIDE일 때 "어떻게 분석했는지" 설명이 약함
- Blending으로 "주변 N개 상권을 종합했습니다"라고 하면 신뢰도 유지

### Q2: Phase 3와 Phase 4 중 어느 것을 먼저?

| 순서 | 근거 |
|------|------|
| Phase 3 먼저 (추천) | Lv4 신호가 있어야 "내 자리" 정밀도가 올라감. Grid는 커버리지 문제지만, 대부분 사용자는 상권 내부/인접에서 검색할 가능성 높음 |
| Phase 4 먼저 | 커버리지를 완전히 해결하고 싶다면. 하지만 ETL 부담이 큼 |

### Q3: 표본 보정은 언제부터?

**추천: Phase 3부터 필수**
- 반경 집계를 시작하면 표본 크기 문제가 바로 발생
- 보정 없이 "폐업률 16.7%"라고 보여주면 오해 유발

---

## 12. 성공 지표

| Phase | 지표 | 목표 | 측정 방법 |
|-------|------|------|----------|
| Phase 2 | 등급 근거 명확도 | "왜 C등급인지" 3개 이상 근거 제시 | reasons 배열 길이 |
| Phase 2 | 경계 밖 오해 | IN/NEAR/OUTSIDE 구분 표시 | location.status 필드 |
| Phase 3 | 업종별 분석 | "카페로 여기 괜찮나요?" 답변 가능 | industryComparisons 제공 |
| Phase 3 | 반경 신호 | 2개 이상 Lv4 신호 제공 | signals 배열 길이 |
| Phase 4 | 커버리지 | 서울 내 어디서든 분석 가능 | OUTSIDE 케이스 0건 |

---

## 결론

> **"정확하게 판별"은 가능하다.**
> **다만 한 번에 가는 게 아니라, 단계별로 정확도를 올려가는 전략이 현실적이다.**

### 핵심 원칙

1. **Lv3.5(상권 단위)**로 큰 구조를 잡고
2. **Lv4(핀 반경)**로 내 자리 디테일을 잡고
3. **Grid**로 커버리지 빈틈을 제거한다

### 우선순위

1. **8지표 복원 + churn 반영** (가장 빠른 효과)
2. **IN/NEAR/OUTSIDE 상태 분리** (신뢰도 관리)
3. **핀 반경 Lv4** (정밀도 상승)
4. **Grid** (최종 완성)

### 다음 단계

**Phase 2 구현 시작**
1. churn, competition_density, cost_proxy 데이터 적재
2. gradeEngine.ts 8지표 공식 적용
3. IN/NEAR/OUTSIDE 위치 상태 분류
4. API 응답 + UI 업데이트

---

*작성: OpenRisk 개발팀*
*최종 수정: 2024-12-30*
