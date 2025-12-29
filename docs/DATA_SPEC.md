# OpenRisk 데이터 명세서

## 개요

OpenRisk는 서울시 상권분석서비스의 공공데이터를 기반으로 상권 리스크를 분석합니다.
이 문서는 프로젝트에서 사용하는 데이터 구조, 분류 체계, 계산 로직을 정리합니다.

---

## 데이터 소스

### 1차 출처
- **서울시 상권분석서비스** (https://data.seoul.go.kr)
  - 상권 영역 (폴리곤)
  - 유동인구 데이터
  - 인구 통계 (거주/직장)
  - 분기별 업데이트

### 2차 API
- **카카오 Local API**
  - 키워드 → 좌표 변환
  - 주소 검색

---

## 데이터베이스 스키마

### 1. trade_areas (상권 영역)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | varchar | 상권 고유 ID |
| name | varchar | 상권명 |
| district | varchar | 행정구 |
| center_lat | float8 | 중심 위도 |
| center_lng | float8 | 중심 경도 |
| polygon | geometry | 상권 영역 (PostGIS) |
| source | varchar | 데이터 출처 |
| updated_at | timestamp | 마지막 업데이트 |

**인덱스**
- `idx_trade_areas_name`: name 컬럼 (LIKE 검색용)
- `idx_trade_areas_district`: district 컬럼
- `idx_trade_areas_polygon`: polygon 컬럼 (GiST)

### 2. area_metrics (상권 지표)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial | 자동 증가 ID |
| area_id | varchar | 상권 ID (FK) |
| period | varchar | 기준 기간 (YYYY-QN) |
| resident_index | float8 | 거주 인구 지수 (만 단위) |
| worker_index | float8 | 직장 인구 지수 (만 단위) |
| traffic_index | float8 | 유동인구 지수 (만 단위) |
| daypart_variance | float8 | 시간대 편차 (0-1) |
| weekend_ratio | float8 | 주말 비중 (0-1) |
| competition_density | float8 | 경쟁 밀도 (미사용) |
| open_close_churn | float8 | 개폐업률 (미사용) |
| cost_proxy | float8 | 비용 프록시 (미사용) |

**인덱스**
- `idx_area_metrics_area_id`: area_id 컬럼
- `idx_area_metrics_period`: period 컬럼

### 3. RPC 함수

#### find_area_by_point(p_lat, p_lng)
좌표 기반 상권 검색

```sql
-- 1순위: 폴리곤 내부에 포함된 상권
-- 2순위: 가장 가까운 상권 (500m 이내)
```

---

## 등급 체계

### 4단계 등급 시스템

| 등급 | 명칭 | 영문 | 난이도 | 특성 |
|------|------|------|--------|------|
| A | A_주거 | Safe Zone | 1/5 | 안정적, 단골 기반 |
| B | B_혼합 | Gray Zone | 3/5 | 시간대별 전략 필요 |
| C | C_상업 | High Risk / High Return | 5/5 | 경쟁 치열, 고비용 |
| D | D_특수 | Special Case | N/A | 분류 불가, 전문 분석 필요 |

### 등급 결정 로직

```typescript
function calculateGrade(metrics: GradeInput): Grade {
  const trafficScore = traffic_index / 1000  // 0-1 정규화
  const varianceScore = daypart_variance     // 0-1

  // A등급: 유동인구 적고 편차 낮음
  if (trafficScore < 0.2 && varianceScore < 0.3) return 'A'

  // B등급: 중간 수준
  if (trafficScore < 0.5 && varianceScore < 0.5) return 'B'

  // C등급: 유동인구 많거나 편차 높음
  if (trafficScore >= 0.5 || varianceScore >= 0.5) return 'C'

  // D등급: 분류 불가
  return 'D'
}
```

### 등급별 해석

#### A등급 (주거형)
- **핵심 해석**
  - 주거 중심 상권으로 유동인구 변동이 적음
  - 단골 기반 업종에 유리
  - 임대료가 상대적으로 안정적

- **추천 액션**
  - 생활 밀착형 업종 (세탁소, 미용실, 편의점)
  - 단골 고객 확보 전략
  - 주민 니즈 사전 조사

- **리스크**
  - 신규 고객 유입 어려움
  - 업종 변경 시 고객 이탈

#### B등급 (혼합형)
- **핵심 해석**
  - 주거와 상업이 혼합된 복합 상권
  - 시간대별 고객층 변화
  - 전략적 접근 필요

- **추천 액션**
  - 시간대별 타겟 분석
  - 점심/저녁 메뉴 차별화
  - 주중/주말 운영 전략

- **리스크**
  - 타겟 설정 실패 시 양쪽 놓침
  - 운영 복잡도 증가

#### C등급 (상업형)
- **핵심 해석**
  - 유동인구 많은 상업 중심
  - 경쟁 치열, 트렌드 변화 빠름
  - 높은 매출 기대, 높은 리스크

- **추천 액션**
  - 명확한 차별점 필수
  - 최소 6개월 고정비 자금 확보
  - 트렌드 대응 계획

- **리스크**
  - 높은 임대료/권리금
  - 트렌드 민감
  - 마케팅 경쟁 심화

#### D등급 (특수형)
- **핵심 해석**
  - 일반적 분석 불가
  - 특정 조건에서만 유효
  - 전문가 상담 권장

- **추천 액션**
  - 심층 조사 필요
  - 유사 업종 사례 분석
  - 전문가 컨설팅

- **리스크**
  - 예측 불가능
  - 일반 상권 분석 미적용

---

## 지표 계산

### 1. 유동인구 지수 (traffic_index)

```
traffic_index = 분기 총 유동인구 / 10000
```

- 단위: 만 명
- 예: traffic_index = 406.7 → 406.7만 명/분기

### 2. 시간대 편차 (daypart_variance)

```
daypart_variance = std(시간대별 유동인구) / mean(시간대별 유동인구)
```

- 범위: 0-1
- 0에 가까울수록: 시간대별 유동인구 균일 (주거형)
- 1에 가까울수록: 시간대별 편차 큼 (상업형)

### 3. 주말 비중 (weekend_ratio)

```
weekend_ratio = 주말 유동인구 / 전체 유동인구
```

- 범위: 0-1
- 0.2-0.3: 평일 중심 (오피스)
- 0.4-0.5: 균형
- 0.5 이상: 주말 중심 (상업/관광)

### 4. 표시용 지표 변환

```typescript
// 총 유동인구
traffic_total = traffic_index * 10000  // 명 단위

// 주말 유동인구
traffic_weekend = traffic_total * weekend_ratio

// 평일 유동인구
traffic_weekday = traffic_total - traffic_weekend
```

---

## 검색 흐름

### 1. 좌표 기반 검색 (우선)

```
사용자 입력 ("홍대")
    ↓
카카오 Local API (키워드 → 좌표)
    ↓
Supabase RPC: find_area_by_point(lat, lng)
    ↓
폴리곤 포함 상권 반환 (또는 nearest)
```

### 2. 이름 기반 검색 (폴백)

```
사용자 입력 ("홍대")
    ↓
AREA_ALIASES 매핑 ("홍대입구역", "홍대입구역 1번", ...)
    ↓
DB ILIKE 검색
    ↓
우선순위 필터 (마포구, 강남구 등)
```

### 키워드 별칭

```typescript
const AREA_ALIASES = {
  '홍대': ['홍대입구역', '홍대입구역 1번', '홍대입구역 2번'],
  '강남': ['강남역', '강남역 1번', '강남역(2호선)'],
  '신촌': ['신촌역', '신촌역(2호선)', '신촌로터리'],
  '이태원': ['이태원역', '이태원로'],
  '합정': ['합정역', '합정역(2호선)'],
  '망원': ['망원역', '망원동'],
  '성수': ['성수역', '성수동']
}
```

---

## 응답 구조

### AnalysisResult

```typescript
interface AnalysisResult {
  area: {
    id: string           // "1001"
    name: string         // "홍대입구역 1번"
    district: string     // "마포구"
    center: {
      lat: number        // 37.5563
      lng: number        // 126.9220
    }
  }

  rawMetrics: {
    period: string       // "20253"
    traffic_total: number      // 4067000
    traffic_weekday: number    // 2723000
    traffic_weekend: number    // 1344000
    resident_index: number     // 0
    worker_index: number       // 0
  }

  lv3_5: {
    grade: 'A' | 'B' | 'C' | 'D'
    gradeName: string          // "C_상업"
    subTitle: string           // "High Risk / High Return"
    difficulty: number         // 5
    confidence: number         // 0.85
    reasons: Array<{
      key: string              // "traffic"
      value: number            // 0.4067
      label: string            // "유동인구 지수"
    }>
    coreCopy: string[]
    actions: string[]
    risks: string[]
  }

  lv4: null  // Phase 2 예정
}
```

---

## 데이터 업데이트

### 주기
- 서울시 상권분석서비스: **분기별** 업데이트
- 권장 동기화: 분기 시작 후 1개월 내

### 업데이트 항목
1. `area_metrics` 테이블에 새 period 데이터 INSERT
2. 신규 상권 발생 시 `trade_areas` 추가

### 데이터 품질 체크
- `traffic_index` NULL 체크
- `daypart_variance` 범위 검증 (0-1)
- `weekend_ratio` 범위 검증 (0-1)

---

## 향후 확장 계획

### lv4 분석 (Phase 2)
- 업종별 경쟁 밀도
- 개폐업률 분석
- 임대료 추정
- 업종 추천

### 추가 데이터 소스
- 카드 결제 데이터
- 배달 주문 데이터
- 소셜 미디어 트렌드
- 부동산 시세
