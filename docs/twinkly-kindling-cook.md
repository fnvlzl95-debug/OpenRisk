# OpenRisk v2.0 - 포인트 기반 리스크 분석 시스템 설계서

## 1. 핵심 컨셉 변경

### Before (v1.0 - 상권 기반)
```
사용자: "홍대" 검색
    ↓
카카오 API → 좌표 변환
    ↓
PostGIS ST_Contains → "홍대입구역 1번" 상권 매칭
    ↓
해당 상권의 사전 계산된 지표 조회
```

**문제점:**
- 서울시가 정의한 상권 영역에 종속
- 경기/인천에는 동일 형식 데이터 없음
- 사용자가 원하는 "정확한 지점"이 아닌 "가장 가까운 상권" 분석

### After (v2.0 - 포인트 기반)
```
사용자: "서울 마포구 연남동 123-45" + 업종 선택 (필수)
    ↓
정확한 좌표 (37.5563, 126.9220) + 업종: 카페
    ↓
반경 500m (고정) 내 실시간 집계
├─ 경쟁 업종 수 (동종 카페 집중 분석)
├─ 유동인구 추정
├─ 임대료 추정
├─ 폐업률 (해당 업종 기준)
└─ 앵커 시설
    ↓
업종 맞춤 리스크 점수 계산 → 사용자에게 표시
```

**핵심 변화:**
| 항목 | v1.0 | v2.0 |
|------|------|------|
| 분석 단위 | 서울시 정의 상권 | 사용자 선택 지점 + 반경 500m (고정) |
| 업종 | 업종 무관 일반 분석 | **업종 필수 선택** → 맞춤 분석 |
| 데이터 의존 | 서울시 공공데이터 | 전국 공통 데이터 + 실시간 API |
| 지역 범위 | 서울만 | 서울/경기/인천 (확장 가능) |
| 정확도 | "근처 상권" 참고 | 정확히 그 위치 |
| 기존 서울 데이터 | 직접 사용 | **보정/검증용**으로 활용 |

---

## 2. 데이터 아키텍처

### 2.1 데이터 소스 (3계층)

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 정적 데이터 (DB 사전 적재)                         │
│  ├─ 소상공인 상가정보 (전국 점포 위치/업종)                   │
│  ├─ 국토부 실거래가 (임대료 추정)                            │
│  ├─ 지하철/버스 승하차 (교통 유동성)                         │
│  └─ 행정동 경계 + 인구통계                                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 준정적 데이터 (월간/분기 업데이트)                  │
│  ├─ 폐업률/생존율 (소상공인 데이터 비교)                     │
│  ├─ 상권변화지표 (서울/경기 공공데이터)                      │
│  └─ 평균 매출 추정치                                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 동적 데이터 (실시간 API 호출)                      │
│  ├─ 카카오 POI API (반경 내 업종별 점포 수)                  │
│  └─ 카카오 지오코딩 (주소 → 좌표)                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 핵심 데이터 소스 상세

#### (1) 소상공인 상가(상권)정보 - **필수**
- **출처**: data.go.kr (API + 파일)
- **범위**: 전국 영업 중인 상가
- **주요 컬럼**: 상가업소번호, 상호명, 표준산업분류(247개), 좌표
- **용도**: 반경 내 점포 수, 업종별 밀도, 경쟁 분석
- **업데이트**: 월간

#### (2) 국토부 실거래가 - **필수**
- **출처**: data.go.kr (API)
- **범위**: 전국 부동산 거래
- **용도**: 상업용 임대료 추정 → cost_proxy
- **업데이트**: 월간

#### (3) 지하철/버스 승하차 - **서울/경기/인천**
- **출처**: 각 지자체 데이터포털
- **용도**: 유동인구 추정, 피크 시간대 분석
- **업데이트**: 일간/월간

#### (4) 카카오 로컬 API - **실시간**
- **용도**: 반경 내 POI 검색 (업종별)
- **장점**: 최신 데이터, 전국 커버
- **제한**: 일 무료 450건 (초과 시 유료)

---

## 3. 새로운 지표 체계

### 3.1 포인트 기반 7대 지표

| # | 지표명 | 산출 방식 | 데이터 소스 |
|---|--------|----------|-------------|
| 1 | **경쟁 밀도** | 반경 500m 내 동종 업종 수 | 소상공인 상가정보 + 카카오 POI |
| 2 | **유동인구 추정** | 가장 가까운 지하철역 승하차 + 버스정류장 | 교통 데이터 |
| 3 | **임대료 수준** | 반경 1km 상업용 실거래 평균 | 국토부 실거래가 |
| 4 | **폐업 위험도** | 반경 내 최근 1년 폐업률 | 소상공인 시계열 비교 |
| 5 | **앵커 시설** | 지하철역/대학/병원/대형마트 거리 | 카카오 POI |
| 6 | **시간대 특성** | 피크 시간 (아침/낮/밤) | 교통 데이터 시간대별 |
| 7 | **상권 성격** | 주거/상업/혼합/특수 판별 | 업종 분포 + 인구 |

### 3.2 업종 카테고리 (필수 선택)

```typescript
// 사용자가 반드시 선택해야 하는 업종 목록
const BUSINESS_CATEGORIES = {
  // 음식점
  'restaurant_korean': { name: '한식', kakaoCode: 'FD6', keywords: ['한식', '한정식'] },
  'restaurant_western': { name: '양식', kakaoCode: 'FD6', keywords: ['양식', '파스타', '스테이크'] },
  'restaurant_japanese': { name: '일식', kakaoCode: 'FD6', keywords: ['일식', '초밥', '라멘'] },
  'restaurant_chinese': { name: '중식', kakaoCode: 'FD6', keywords: ['중식', '중국집'] },
  'restaurant_chicken': { name: '치킨', kakaoCode: 'FD6', keywords: ['치킨', '통닭'] },
  'restaurant_pizza': { name: '피자', kakaoCode: 'FD6', keywords: ['피자'] },

  // 카페/베이커리
  'cafe': { name: '카페', kakaoCode: 'CE7', keywords: ['카페', '커피'] },
  'bakery': { name: '베이커리', kakaoCode: 'CE7', keywords: ['빵', '베이커리', '제과'] },
  'dessert': { name: '디저트', kakaoCode: 'CE7', keywords: ['디저트', '케이크', '아이스크림'] },

  // 주점
  'bar': { name: '술집/바', kakaoCode: 'FD6', keywords: ['술집', '바', '호프'] },

  // 소매
  'convenience': { name: '편의점', kakaoCode: 'CS2', keywords: ['편의점'] },
  'mart': { name: '슈퍼마켓', kakaoCode: 'MT1', keywords: ['마트', '슈퍼'] },

  // 서비스
  'beauty': { name: '미용실', kakaoCode: 'CS2', keywords: ['미용실', '헤어샵'] },
  'nail': { name: '네일샵', kakaoCode: 'CS2', keywords: ['네일'] },
  'laundry': { name: '세탁소', kakaoCode: 'CS2', keywords: ['세탁'] },
  'pharmacy': { name: '약국', kakaoCode: 'PM9', keywords: ['약국'] },

  // 기타
  'gym': { name: '헬스장', kakaoCode: 'CS2', keywords: ['헬스', '피트니스'] },
  'academy': { name: '학원', kakaoCode: 'AC5', keywords: ['학원'] },
} as const

type BusinessCategory = keyof typeof BUSINESS_CATEGORIES
```

### 3.3 지표별 계산 로직

```typescript
interface PointAnalysis {
  // 입력
  lat: number
  lng: number
  radius: 500  // 고정 500m
  targetCategory: BusinessCategory  // 사용자 업종 (필수)

  // 산출 지표
  competition: {
    total: number        // 반경 내 전체 점포
    sameCategory: number // 동종 업종
    density: number      // 경쟁 밀도 (0~1)
  }

  traffic: {
    estimated: number    // 추정 유동인구
    peakTime: 'morning' | 'day' | 'night'
    weekendRatio: number
  }

  cost: {
    avgRent: number      // 평균 임대료 (만원/평)
    level: 'high' | 'medium' | 'low'
  }

  survival: {
    closureRate: number  // 폐업률 (%)
    risk: 'high' | 'medium' | 'low'
  }

  anchors: {
    nearestSubway: { name: string, distance: number } | null
    nearestUniversity: { name: string, distance: number } | null
    nearestHospital: { name: string, distance: number } | null
  }

  areaType: 'A_주거' | 'B_혼합' | 'C_상업' | 'D_특수'
}
```

---

## 4. 데이터 처리 전략

### 4.1 대용량 데이터 처리

#### 문제: 소상공인 상가정보 약 300만 건

**해결책: H3 그리드 사전 집계**

```sql
-- H3 해상도 9 (~350m 셀)
CREATE TABLE grid_store_counts (
  h3_id VARCHAR(15) PRIMARY KEY,
  center_lat FLOAT8,
  center_lng FLOAT8,
  region VARCHAR(10),  -- '서울', '경기', '인천'

  -- 업종별 점포 수 (상위 20개 카테고리)
  cafe_count INT,
  restaurant_count INT,
  convenience_count INT,
  pharmacy_count INT,
  -- ...
  total_count INT,

  -- 시계열 (폐업률 계산용)
  prev_total_count INT,
  closure_count INT,
  opening_count INT,

  period VARCHAR(10),  -- '2025-Q1'
  updated_at TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_grid_h3 ON grid_store_counts(h3_id);
CREATE INDEX idx_grid_region ON grid_store_counts(region);
```

**쿼리 최적화:**
```typescript
// 반경 500m 분석 시 → 약 4~7개 H3 셀만 조회
async function analyzePoint(lat: number, lng: number, radius: number = 500) {
  // 1. 중심점의 H3 ID 계산
  const centerH3 = h3.latLngToCell(lat, lng, 9)

  // 2. 반경 내 포함되는 H3 셀 목록
  const nearbyH3s = h3.gridDisk(centerH3, 2)  // 2링 = 약 19개 셀

  // 3. 해당 셀들의 집계 데이터 조회
  const { data } = await supabase
    .from('grid_store_counts')
    .select('*')
    .in('h3_id', nearbyH3s)

  // 4. 거리 가중 합산
  return aggregateWithDistance(data, lat, lng, radius)
}
```

### 4.2 실시간 API 호출 최적화

```typescript
// 카카오 POI API 호출 (캐싱 전략)
const POI_CACHE_TTL = 24 * 60 * 60 * 1000  // 24시간

async function getPOIData(lat: number, lng: number, category: string) {
  const cacheKey = `poi:${lat.toFixed(4)}:${lng.toFixed(4)}:${category}`

  // 1. Redis 캐시 확인
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // 2. 카카오 API 호출
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/search/category.json?` +
    `category_group_code=${category}&x=${lng}&y=${lat}&radius=500`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } }
  )

  // 3. 캐시 저장
  const data = await response.json()
  await redis.setex(cacheKey, POI_CACHE_TTL, JSON.stringify(data))

  return data
}
```

### 4.3 ETL 파이프라인

```
┌─────────────────────────────────────────────────────────────┐
│  월간 배치 (Cron: 매월 1일)                                  │
├─────────────────────────────────────────────────────────────┤
│  1. 소상공인 상가정보 다운로드                               │
│     └─ data.go.kr API → CSV → Supabase                     │
│                                                             │
│  2. H3 그리드 집계                                          │
│     └─ 각 점포 좌표 → H3 셀 → grid_store_counts 업데이트    │
│                                                             │
│  3. 폐업률 계산                                             │
│     └─ 이전 월 데이터와 비교 → closure_count 산출           │
│                                                             │
│  4. 실거래가 업데이트                                       │
│     └─ 국토부 API → 법정동별 평균 임대료                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  일간 배치 (Cron: 매일 새벽)                                 │
├─────────────────────────────────────────────────────────────┤
│  1. 지하철 승하차 데이터 (서울)                              │
│     └─ data.seoul.go.kr → 역별/시간대별 집계                │
│                                                             │
│  2. 버스 승하차 데이터 (서울)                                │
│     └─ 정류장별 집계 → 그리드 유동인구 추정                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 새로운 DB 스키마

### 5.1 테이블 구조

```sql
-- 1. H3 그리드 점포 집계 (핵심 테이블)
CREATE TABLE grid_store_counts (
  h3_id VARCHAR(15) PRIMARY KEY,
  center_lat FLOAT8 NOT NULL,
  center_lng FLOAT8 NOT NULL,
  region VARCHAR(10) NOT NULL,  -- '서울', '경기', '인천'
  district VARCHAR(50),         -- '마포구', '성남시'

  -- 업종별 점포 수
  store_counts JSONB NOT NULL,  -- {"cafe": 48, "restaurant": 67, ...}
  total_count INT NOT NULL,

  -- 시계열 (월간 비교)
  prev_period_count INT,
  closure_count INT DEFAULT 0,
  opening_count INT DEFAULT 0,

  period VARCHAR(10) NOT NULL,  -- '2025-01'
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 그리드 유동인구 추정
CREATE TABLE grid_traffic (
  h3_id VARCHAR(15) PRIMARY KEY,

  -- 가장 가까운 교통시설 기반 추정
  nearest_subway_id VARCHAR(20),
  subway_distance INT,          -- 미터
  nearest_bus_stop_id VARCHAR(20),
  bus_distance INT,

  -- 추정 유동인구 (역/정류장 승하차 기반)
  traffic_estimated INT,
  traffic_morning INT,          -- 06-11시
  traffic_day INT,              -- 11-17시
  traffic_night INT,            -- 17-06시
  weekend_ratio FLOAT,

  period VARCHAR(10) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. 법정동별 임대료 추정
CREATE TABLE district_rent (
  legal_dong_code VARCHAR(10) PRIMARY KEY,
  district_name VARCHAR(50) NOT NULL,

  -- 상업용 부동산 실거래 기반
  avg_rent_per_pyeong INT,      -- 만원/평
  sample_count INT,             -- 거래 건수
  rent_level VARCHAR(10),       -- 'high', 'medium', 'low'

  period VARCHAR(10) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. 지하철역 정보
CREATE TABLE subway_stations (
  station_id VARCHAR(20) PRIMARY KEY,
  station_name VARCHAR(50) NOT NULL,
  line VARCHAR(20) NOT NULL,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,

  -- 시간대별 승하차
  daily_total INT,
  hourly_data JSONB,            -- {"06": 1200, "07": 4500, ...}

  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. 버스정류장 정보
CREATE TABLE bus_stops (
  stop_id VARCHAR(20) PRIMARY KEY,
  stop_name VARCHAR(100) NOT NULL,
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,

  daily_total INT,

  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 5.2 인덱스 전략

```sql
-- 공간 인덱스 (PostGIS 불필요, H3로 대체)
CREATE INDEX idx_grid_store_h3 ON grid_store_counts(h3_id);
CREATE INDEX idx_grid_store_region ON grid_store_counts(region);

-- 지하철역 공간 검색용
CREATE INDEX idx_subway_location ON subway_stations
  USING GIST (ST_MakePoint(lng, lat)::geography);

-- 버스정류장 공간 검색용
CREATE INDEX idx_bus_location ON bus_stops
  USING GIST (ST_MakePoint(lng, lat)::geography);
```

---

## 6. API 설계

### 6.1 새로운 엔드포인트

```typescript
// POST /api/v2/analyze
// 포인트 기반 분석 (새 버전)
interface AnalyzeRequest {
  lat: number
  lng: number
  // radius 제거 - 항상 500m 고정
  targetCategory: BusinessCategory  // 예정 업종 (필수!)
}

interface AnalyzeResponse {
  location: {
    lat: number
    lng: number
    address: string      // 역지오코딩 결과
    region: string       // '서울', '경기', '인천'
    district: string     // '마포구'
  }

  analysis: {
    riskScore: number    // 0~100 (높을수록 위험)
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
    areaType: 'A_주거' | 'B_혼합' | 'C_상업' | 'D_특수'
  }

  metrics: {
    competition: {
      total: number
      sameCategory: number | null
      density: number
      densityLevel: 'low' | 'medium' | 'high'
    }
    traffic: {
      estimated: number
      peakTime: 'morning' | 'day' | 'night'
      weekendRatio: number
    }
    cost: {
      avgRent: number
      level: 'low' | 'medium' | 'high'
    }
    survival: {
      closureRate: number
      risk: 'low' | 'medium' | 'high'
    }
  }

  anchors: {
    subway: { name: string, distance: number, line: string } | null
    university: { name: string, distance: number } | null
    hospital: { name: string, distance: number } | null
    mart: { name: string, distance: number } | null
  }

  interpretation: {
    summary: string      // 한 줄 요약
    risks: string[]      // 리스크 요인
    opportunities: string[] // 기회 요인
  }

  dataQuality: {
    storeDataAge: string   // '2025-01'
    trafficDataAge: string
    coverage: 'high' | 'medium' | 'low'
  }
}
```

### 6.2 호환성: v1 → v2 마이그레이션

```typescript
// 기존 /api/analyze 유지 (deprecated 표시)
// 내부적으로 v2 로직 호출 후 v1 형식으로 변환

async function analyzeV1Compat(query: string) {
  // 1. 카카오 API로 좌표 변환
  const coords = await getCoordinatesFromKakao(query)

  // 2. v2 분석 호출
  const v2Result = await analyzePointV2(coords.lat, coords.lng)

  // 3. v1 형식으로 변환
  return convertToV1Format(v2Result)
}
```

---

## 7. 리스크 점수 계산

### 7.1 종합 리스크 스코어 (0~100)

```typescript
function calculateRiskScore(metrics: PointMetrics): number {
  const weights = {
    competition: 0.25,    // 경쟁 밀도
    cost: 0.25,           // 임대료 부담
    survival: 0.25,       // 폐업 위험
    traffic: 0.15,        // 유동인구 (낮으면 위험)
    anchor: 0.10          // 앵커 시설 (없으면 위험)
  }

  // 각 지표를 0~100 스케일로 정규화
  const scores = {
    competition: normalizeCompetition(metrics.competition.density),
    cost: normalizeCost(metrics.cost.avgRent),
    survival: metrics.survival.closureRate * 5,  // 20% → 100점
    traffic: 100 - normalizeTraffic(metrics.traffic.estimated),
    anchor: metrics.anchors.subway ? 0 : 30  // 지하철 없으면 +30
  }

  return Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + scores[key] * weight, 0
  )
}

// 리스크 레벨 분류
function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'LOW'
  if (score < 50) return 'MEDIUM'
  if (score < 70) return 'HIGH'
  return 'VERY_HIGH'
}
```

### 7.2 업종별 가중치 조정 (필수 적용)

```typescript
// 업종 필수 선택이므로 항상 맞춤 가중치 적용
const CATEGORY_WEIGHTS: Record<BusinessCategory, typeof weights> = {
  // 카페: 경쟁 + 유동인구 중심
  'cafe': {
    competition: 0.35,
    cost: 0.20,
    survival: 0.20,
    traffic: 0.20,
    anchor: 0.05
  },

  // 한식: 임대료 + 경쟁 중심
  'restaurant_korean': {
    competition: 0.30,
    cost: 0.30,
    survival: 0.20,
    traffic: 0.15,
    anchor: 0.05
  },

  // 치킨: 배달 위주라 유동인구 덜 중요
  'restaurant_chicken': {
    competition: 0.35,
    cost: 0.25,
    survival: 0.25,
    traffic: 0.10,
    anchor: 0.05
  },

  // 편의점: 입지(앵커) 매우 중요, 경쟁 덜 중요
  'convenience': {
    competition: 0.15,
    cost: 0.20,
    survival: 0.15,
    traffic: 0.25,
    anchor: 0.25
  },

  // 미용실: 주거 밀집 중요
  'beauty': {
    competition: 0.25,
    cost: 0.25,
    survival: 0.20,
    traffic: 0.15,
    anchor: 0.15  // 주거지 인접 중요
  },

  // ... 기타 업종별 가중치
}
```

---

## 8. 구현 로드맵

### Phase 1: 기반 구축 (1주)
- [ ] H3 라이브러리 설치 및 유틸 함수
- [ ] 새 DB 테이블 생성 (grid_store_counts 등)
- [ ] 소상공인 상가정보 API 연동 및 초기 적재

### Phase 2: 서울 포인트 분석 (1주)
- [ ] /api/v2/analyze 엔드포인트 구현
- [ ] 지하철/버스 승하차 데이터 적재
- [ ] 유동인구 추정 로직
- [ ] 리스크 점수 계산 엔진

### Phase 3: 경기/인천 확장 (1주)
- [ ] 경기/인천 상가정보 H3 집계
- [ ] 경기 지하철 데이터 (신분당선, 경의중앙선 등)
- [ ] 인천 지하철 데이터

### Phase 4: UI 개편 (1주)
- [ ] 지도 클릭 분석 기능
- [ ] 반경 조절 슬라이더
- [ ] 리스크 시각화 (게이지, 히트맵)
- [ ] v1 → v2 점진적 전환

### Phase 5: 고도화
- [ ] 업종별 맞춤 분석
- [ ] 시계열 트렌드 (전월 대비)
- [ ] AI 요약 v2 연동

---

## 9. 기술 스택

| 영역 | 현재 | 변경/추가 |
|------|------|----------|
| 프레임워크 | Next.js 16 | 유지 |
| DB | Supabase (PostgreSQL) | 유지 + H3 확장 |
| 공간 쿼리 | PostGIS | H3 (JavaScript) |
| 외부 API | 카카오 Maps | 유지 + POI API 추가 |
| 캐시 | 없음 | Vercel KV (Redis) |
| 배치 | 없음 | Vercel Cron |
| 데이터 | 서울시 CSV | + data.go.kr API |

---

## 10. 예상 비용

| 항목 | 무료 티어 | 예상 사용량 | 비용 |
|------|----------|------------|------|
| Supabase | 500MB | ~200MB | 무료 |
| Vercel | 100GB 대역폭 | ~10GB | 무료 |
| 카카오 API | 일 450건 | ~100건/일 | 무료 |
| data.go.kr | 무제한 | - | 무료 |
| Vercel KV | 30MB | ~10MB | 무료 |

**총 예상 비용: 무료** (무료 티어 내 운영 가능)

---

## 11. 마이그레이션 전략

### 11.1 서울 데이터 활용

기존 서울시 공공데이터는 **검증/보정용**으로 활용:
- 새 H3 기반 분석 결과 vs 기존 상권 분석 비교
- 오차 보정 계수 도출
- 사용자 신뢰도 확보

### 11.2 점진적 전환

```
Week 1: v2 API 병렬 운영 (내부 테스트)
Week 2: 일부 사용자 A/B 테스트
Week 3: v2 기본, v1 폴백
Week 4: v1 deprecated, v2 전면 전환
```

---

## 12. 결론

### 핵심 변경 요약

1. **분석 단위**: 상권 폴리곤 → 포인트 + 반경 500m (고정)
2. **업종**: 일반 분석 → **업종 필수 선택** → 맞춤 분석
3. **데이터 소스**: 서울시 전용 → 전국 공통 (data.go.kr)
4. **기존 데이터**: 서울 상권 데이터는 **보정/검증용**으로 활용
5. **집계 방식**: 사전 계산 → H3 그리드 실시간 집계
6. **출력**: 등급(A/B/C/D) → 업종별 리스크 점수(0~100)

### 확정된 설계 결정

| 항목 | 결정 |
|------|------|
| 반경 | **500m 고정** (단순화, 일관성) |
| 업종 | **필수 선택** (맞춤 분석 제공) |
| 기존 서울 데이터 | **보정/검증용** (직접 사용 X) |

### 기대 효과

- **확장성**: 서울 → 경기/인천 → 전국
- **정확성**: "이 지점"의 "이 업종" 실제 리스크
- **실시간성**: 최신 점포 데이터 반영
- **사용자 가치**: 업종별 맞춤 창업 리스크 분석
