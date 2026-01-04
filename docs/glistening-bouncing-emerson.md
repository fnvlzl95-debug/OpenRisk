# 오픈리스크 (OpenRisk) MVP 설계 계획

## 1. 제품 개요

### 1.1 한 줄 정의
사용자가 입력한 지역의 상권 데이터를 **"불안(리스크)을 해석 가능한 문장 + 근거 + 행동"**으로 변환해주는 웹 리포트.

### 1.2 핵심 원칙
- **Lv3.5** = 판단(등급) - A/B/C/D
- **Lv4** = 해석 보정 신호 (등급 뒤집기 금지)
- **앵커** = "유망함"이 아니라 **"유입 신호 + 의존 리스크"**를 나타내는 해석 보정용

---

## 2. 기술 스택

### MVP 스택 (확정)
| 구분 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router) | 풀스택, Vercel 배포 |
| 스타일링 | Tailwind CSS + shadcn/ui | |
| 지도 | Kakao Maps JS SDK | 지오코딩 + 폴리곤 표시 |
| DB | **Supabase (Postgres + PostGIS)** | PostGIS 필수 - 폴리곤 매칭 정확도 |
| 캐시 | **없음** | 동접 1000명 전까진 불필요 |
| ETL | **scripts/uploadData.ts** | CSV → DB 스크립트 1개 (수동) |
| 배포 | Vercel | |

### PostGIS가 필수인 이유
- "서교동 카페거리" vs "서교동 주택가"를 구분해야 함
- 행정동 단위로 뭉개면 데이터 쓰레기
- Supabase는 Extensions에서 클릭 한 번으로 PostGIS 활성화

### 나중에 추가 (확장 시)
- Redis 캐시 (동접 늘면)
- ETL 자동화 (월 1회 cron)

---

## 3. MVP 범위

### 지역
- **서울 한정** (상권영역 폴리곤 데이터 공개)
- 7개 대표 상권: 홍대, 강남역, 신촌, 이태원, 합정, 망원, 성수

### 기능
- **Lv3.5**: 등급 판정 + UX 문장 + 근거 + 액션/리스크
- **Lv4**: Phase 2에서 추가 (밥/술 → 광고 → 앵커 순)

### 없는 지역 검색 시
> "아직 분석 데이터가 없는 지역입니다"

---

## 4. 디렉토리 구조

```
/openrisk
├── app/
│   ├── layout.tsx              # 전역 레이아웃
│   ├── page.tsx                # 메인 페이지 (검색)
│   ├── result/
│   │   └── page.tsx            # 결과 페이지 (?areaId=xxx)
│   └── api/
│       ├── geo/
│       │   └── search/route.ts # 주소 검색 (Kakao 프록시)
│       └── analyze/route.ts    # 상권 분석
├── components/
│   ├── SearchInput.tsx         # 주소 검색 입력 (자동완성)
│   ├── GradeBadge.tsx          # 등급 배지 (A/B/C/D)
│   ├── ReasonList.tsx          # 근거 리스트
│   ├── CopySection.tsx         # UX 문장 섹션
│   ├── ActionRiskList.tsx      # 액션/리스크 리스트
│   └── AreaMap.tsx             # 지도 + 폴리곤
├── lib/
│   ├── engine/
│   │   ├── gradeEngine.ts      # Lv3.5 등급 판정
│   │   ├── signalEngine.ts     # Lv4 신호 (Phase 2)
│   │   └── copyRenderer.ts     # 문장 조합
│   ├── data/
│   │   ├── areas.json          # 상권 영역 (7개)
│   │   ├── metrics.json        # 상권별 지표
│   │   ├── gradeRules.json     # 등급 룰셋
│   │   └── copyTemplates.json  # UX 문장
│   ├── geo/
│   │   └── matcher.ts          # 좌표 → 상권 매칭
│   └── types.ts                # 타입 정의
├── scripts/
│   └── seedData.ts             # 데이터 수동 적재 스크립트
└── .env.local                  # Kakao API 키
```

---

## 5. 데이터 구조

### 5.1 상권 영역 (areas.json)
```typescript
interface TradeArea {
  id: string;              // "hongdae"
  name: string;            // "홍대입구역 인근"
  district: string;        // "마포구"
  center: { lat: number; lng: number };
  polygon: [number, number][];  // WGS84 좌표
  source: string;          // "서울 열린데이터광장"
  updatedAt: string;       // "2024-12"
}
```

### 5.2 상권 지표 (metrics.json)
```typescript
interface AreaMetrics {
  areaId: string;
  period: string;              // "2024-12"
  // 기본 지표 (0~1 정규화)
  residentIndex: number;       // 주거지수
  workerIndex: number;         // 직장지수
  trafficIndex: number;        // 유동지수
  daypartVariance: number;     // 시간대 편차
  weekendRatio: number;        // 주말 비율
  competitionDensity: number;  // 경쟁 밀도
  openCloseChurn: number;      // 개폐업 변동
  costProxy: number;           // 비용압박 프록시
  // Lv4용 (Phase 2)
  nightActivityRatio?: number; // 야간 활동 비율
  franchiseRatio?: number;     // 프랜차이즈 비율
}
```

### 5.3 등급 룰셋 (gradeRules.json)
```typescript
interface GradeRuleSet {
  version: string;
  rules: {
    grade: "A" | "B" | "C" | "D";
    formula: string;  // "resident*0.4 + (1-variance)*0.3 + (1-costProxy)*0.3"
    weights: Record<string, number>;
  }[];
}
```

### 5.4 UX 문장 템플릿 (copyTemplates.json)
```typescript
interface CopyTemplate {
  key: string;            // "A_core_1", "C_risk_1"
  scope: "lv3_5" | "lv4";
  grade?: "A" | "B" | "C" | "D";
  type: "core" | "reason" | "action" | "risk";
  text: string;
}
```

---

## 6. 등급 판정 로직 (Lv3.5)

### 6.1 점수 공식
```
A_score = +resident*0.4 + (1-daypartVariance)*0.3 + (1-costProxy)*0.3
B_score = mix(resident, worker) + daypartVariance + weekdayWeekendGap
C_score = +traffic*0.3 + +competition*0.3 + +churn*0.2 + +costProxy*0.2
D_score = specialFlag (병원/대학/산단/관광 의존)
```

### 6.2 신뢰도
```
confidence = sigmoid(topScore - secondScore)
```
- 신뢰도 < 30%: "B 62% / C 38%" 형태로 혼합 표시

### 6.3 근거 추출
점수 기여도 상위 3개 피처를 reasons로 반환

---

## 7. API 설계

### GET /api/geo/search?query={검색어}
Kakao Local API 프록시 (주소 검색)
```json
{
  "candidates": [
    { "address": "서울 마포구 서교동", "lat": 37.556, "lng": 126.923 }
  ]
}
```

### GET /api/analyze?lat={위도}&lng={경도}
```json
{
  "area": {
    "id": "hongdae",
    "name": "홍대입구역 인근",
    "center": { "lat": 37.556, "lng": 126.923 }
  },
  "lv3_5": {
    "grade": "C",
    "gradeName": "C_상업",
    "subTitle": "High Risk / High Return",
    "difficulty": 5,
    "confidence": 0.72,
    "reasons": [
      { "key": "competition_density", "value": 0.88, "label": "경쟁 밀도 높음" },
      { "key": "traffic_index", "value": 0.90, "label": "유동 집중" },
      { "key": "daypart_variance", "value": 0.75, "label": "시간대 편차 큼" }
    ],
    "coreCopy": [
      "사람은 많지만, 그만큼 경쟁자가 많고 월세가 높습니다.",
      "트렌드가 매우 빨라 6개월 뒤를 장담하기 어렵습니다.",
      "준비되지 않은 초보자는 높은 고정비만 감당하다 끝날 수 있습니다."
    ],
    "actions": [...],
    "risks": [...]
  },
  "lv4": null  // Phase 2
}
```

---

## 8. UI 화면

### 메인 페이지 (/)
```
┌─────────────────────────────────────┐
│           오픈리스크                 │
│   "상권의 진짜 리스크를 번역합니다"   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 지역 검색 (주소/역/동)       │   │
│  └─────────────────────────────┘   │
│            [ 분석하기 ]             │
└─────────────────────────────────────┘
```

### 결과 페이지 (/result?areaId=xxx)
```
┌─────────────────────────────────────┐
│ ← 다시 검색                         │
├─────────────────────────────────────┤
│ [지도: 상권 폴리곤 하이라이트]        │
├─────────────────────────────────────┤
│ 홍대입구역 인근                      │
│ ┌─────────────────────────────────┐ │
│ │  C_상업  ★★★★★                  │ │
│ │  High Risk / High Return        │ │
│ │  신뢰도: 72%                    │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ 핵심 해석                           │
│ • 사람은 많지만, 경쟁자가 많고...     │
│ • 트렌드가 매우 빨라...              │
│ • 준비되지 않은 초보자는...           │
├─────────────────────────────────────┤
│ 왜 이렇게 나왔나요?                  │
│ • 경쟁 밀도: 88%                    │
│ • 유동 집중: 90%                    │
│ • 시간대 편차: 75%                  │
├─────────────────────────────────────┤
│ 추천 액션                           │
│ • ...                              │
├─────────────────────────────────────┤
│ 주의 리스크                         │
│ • ...                              │
└─────────────────────────────────────┘
```

---

## 9. Lv4 신호 설계 (Phase 2)

### 9.1 밥/술 상권 (daypart_profile)
- MEAL: 주간 피크 + 짧은 체류
- ALCOHOL: 야간 유동 + 긴 체류
- MIXED: 시간대 분리 해석

### 9.2 광고 신호
| 신호 | 설명 |
|------|------|
| ALI (광고 레버리지) | 광고가 성장 레버가 될 가능성. A=LOW, B=MID, C=HIGH |
| ADI (광고 의존도) | 광고 없으면 흔들리는 구조인지. 술상권+외부유입↑면 HIGH |
| MCP (마케팅 비용 압박) | 노출비용이 과도해 손익 깨지는지. 관광지+경쟁↑면 HIGH |

### 9.3 관광 의존 (TDI)
- 관광 POI 밀도 기반
- HIGH면 "성수기/비수기 변동 + 랭킹/리뷰 전쟁" 문장 추가

### 9.4 앵커 감지
- **앵커 ≠ 유망함** (중요!)
- 앵커 = "유입을 만들어내는 자석이 있는지" + "의존 리스크"
- 4조건(지속/목적/반복/파급) 중 3개 충족 시 후보
- 시설 앵커(병원/대학)는 자동, 음식 앵커는 큐레이션

---

## 10. 사전 준비

### Kakao API 키 발급
1. https://developers.kakao.com 접속
2. 내 애플리케이션 → 앱 추가
3. 플랫폼 → Web → 도메인 추가:
   - `http://localhost:3000`
   - (배포 후) `https://xxx.vercel.app`
4. `.env.local` 생성:
```env
NEXT_PUBLIC_KAKAO_MAP_KEY=your_javascript_key
KAKAO_REST_KEY=your_rest_api_key
```

---

## 11. 구현 순서

### Step 1: 사전 준비
- [ ] Kakao Developers에서 API 키 발급
- [ ] Supabase 프로젝트 생성
- [ ] Supabase에서 PostGIS Extension 활성화

### Step 2: 프로젝트 셋업
- [ ] Next.js 15 + Tailwind + TypeScript 초기화
- [ ] shadcn/ui 설치
- [ ] Supabase 클라이언트 설정
- [ ] 디렉토리 구조 생성

### Step 3: DB 스키마 + 데이터 적재
- [ ] Supabase에 테이블 생성 (trade_areas, area_metrics, copy_templates, grade_rules)
- [ ] scripts/uploadData.ts 작성
- [ ] 서울 7개 상권 데이터 수동 적재 (CSV → DB)
- [ ] UX 문장 / 등급 룰셋 적재

### Step 4: 엔진 구현
- [ ] lib/types.ts (타입 정의)
- [ ] lib/engine/gradeEngine.ts (등급 판정)
- [ ] lib/engine/copyRenderer.ts (문장 조합)
- [ ] lib/geo/matcher.ts (PostGIS ST_Contains로 상권 매칭)

### Step 5: API 구현
- [ ] /api/geo/search (Kakao 프록시)
- [ ] /api/analyze (분석)

### Step 6: UI 구현
- [ ] 메인 페이지 (검색)
- [ ] 결과 페이지 (리포트)
- [ ] 컴포넌트들 (GradeBadge, ReasonList, CopySection 등)

### Step 7: 지도 연동
- [ ] Kakao Maps 초기화
- [ ] 폴리곤 표시

### Step 8: 마무리
- [ ] 모바일 반응형
- [ ] Vercel 배포
- [ ] Supabase 환경변수 연결

---

## 12. 주요 파일 생성 순서

1. `package.json` + 의존성 설치
2. `tailwind.config.ts`
3. `lib/supabase.ts` (Supabase 클라이언트)
4. `lib/types.ts`
5. `scripts/uploadData.ts` (CSV → DB)
6. `lib/engine/gradeEngine.ts`
7. `lib/engine/copyRenderer.ts`
8. `lib/geo/matcher.ts`
9. `app/layout.tsx`
10. `app/page.tsx`
11. `app/api/geo/search/route.ts`
12. `app/api/analyze/route.ts`
13. `app/result/page.tsx`
14. `components/*`

---

## 13. Supabase 테이블 스키마

### trade_areas (상권 영역)
```sql
CREATE TABLE trade_areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  polygon GEOMETRY(POLYGON, 4326) NOT NULL,  -- WGS84
  source TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX trade_areas_polygon_idx ON trade_areas USING GIST(polygon);
```

### area_metrics (상권 지표)
```sql
CREATE TABLE area_metrics (
  id SERIAL PRIMARY KEY,
  area_id TEXT REFERENCES trade_areas(id),
  period TEXT NOT NULL,  -- "2024-12"
  resident_index REAL,
  worker_index REAL,
  traffic_index REAL,
  daypart_variance REAL,
  weekend_ratio REAL,
  competition_density REAL,
  open_close_churn REAL,
  cost_proxy REAL,
  UNIQUE(area_id, period)
);
```

### copy_templates (UX 문장)
```sql
CREATE TABLE copy_templates (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  scope TEXT NOT NULL,  -- "lv3_5" | "lv4"
  grade TEXT,           -- "A" | "B" | "C" | "D"
  type TEXT NOT NULL,   -- "core" | "action" | "risk"
  text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
```

### grade_rules (등급 룰셋)
```sql
CREATE TABLE grade_rules (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  grade TEXT NOT NULL,
  weights JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
```
