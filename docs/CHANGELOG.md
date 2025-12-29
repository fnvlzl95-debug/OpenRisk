# OpenRisk 개발 일지

## 2024-12-30 작업 내역

### 완료된 작업

#### 1. 엔진 분리 (`lib/engine/`)
로직을 별도 모듈로 분리하여 유지보수성 향상

- `lib/engine/gradeEngine.ts` - 등급 계산 로직
  - `calculateGrade()`: 유동인구, 시간대 편차, 주말 비중 기반 A-D 등급 산출
  - `calculateDisplayMetrics()`: 표시용 지표 계산

- `lib/engine/copyRenderer.ts` - 해석 문구 렌더러
  - `getGradeCopy()`: 등급별 coreCopy, actions, risks 반환
  - `getGradeSummary()`: 등급별 한 줄 요약

- `lib/engine/index.ts` - 모듈 exports

- `app/api/analyze/route.ts` 리팩토링
  - 로컬 함수 제거, 엔진 모듈에서 import

#### 2. 지도 시각화 (카카오맵)
- `components/AreaMap.tsx` 생성
  - 카카오 Maps SDK 동적 로드
  - 마커, 반경 원(300m), 상권명 오버레이 표시
  - 등급별 색상 적용

- 카카오 API 키 설정
  - `.env.local`에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 추가
  - 카카오 개발자 콘솔에서 Web 플랫폼 도메인 등록

#### 3. 결과 페이지 UI 개선
- 레이아웃 재구성
  - 왼쪽: 정보카드 + 유동인구 카드 (세로 배치)
  - 오른쪽: 지도 (전체 높이)

- 정보카드 통일
  - 등급/유형/난이도/신뢰도 panel 스타일 통일
  - `flex flex-col gap-2`로 라벨-값 간격 조정
  - `text-data-sm` 폰트 스타일 통일

- 유동인구 카드
  - 총/평일/주말 3열 grid
  - 동일한 panel 스타일 적용

#### 4. 디자인 시스템 수정
- 폰트 변경: Departure Mono → Pretendard
- 색상 가시성 개선
  - `stat-label`: `--text-tertiary` → `--text-secondary`
  - `data-label`: `--text-tertiary` → `--text-secondary`
  - `stat-unit`: `--text-tertiary` → `--text-secondary`

---

## 남은 작업

### Phase 2 (단기)
- [ ] 검색 자동완성 기능
- [ ] 상권 폴리곤 시각화 (원형 → 실제 폴리곤)
- [ ] 모바일 반응형 최적화
- [ ] 로딩 스켈레톤 UI

### Phase 3 (중기)
- [ ] lv4 분석 기능 (업종별 상세 분석)
- [ ] 비교 분석 기능 (2개 상권 비교)
- [ ] 분석 결과 PDF 다운로드
- [ ] 분석 결과 공유 기능

### Phase 4 (장기)
- [ ] 사용자 인증 (로그인/회원가입)
- [ ] 분석 이력 저장
- [ ] 즐겨찾기 상권
- [ ] 알림 기능 (상권 변동 알림)

---

## 실제 서비스를 위해 필요한 것

### 인프라
- [ ] Vercel 배포 설정
- [ ] 커스텀 도메인 연결
- [ ] SSL 인증서 (자동)
- [ ] CDN 설정

### 보안
- [ ] 환경 변수 관리 (Vercel 환경 변수)
- [ ] API Rate Limiting
- [ ] CORS 설정
- [ ] CSP (Content Security Policy)

### 데이터
- [ ] 데이터 업데이트 자동화 (분기별)
- [ ] 데이터 백업 정책
- [ ] 상권 폴리곤 데이터 보강
- [ ] 업종별 데이터 추가

### 모니터링
- [ ] 에러 트래킹 (Sentry)
- [ ] 분석 도구 (Google Analytics / Vercel Analytics)
- [ ] 성능 모니터링 (Core Web Vitals)
- [ ] 사용자 피드백 수집

### 법적 요건
- [ ] 개인정보처리방침
- [ ] 이용약관
- [ ] 데이터 출처 명시 (서울시 상권분석서비스)
- [ ] 면책 조항 (투자 결정 책임)

### SEO & 마케팅
- [ ] 메타 태그 최적화
- [ ] Open Graph 이미지
- [ ] sitemap.xml
- [ ] robots.txt
- [ ] 랜딩 페이지 콘텐츠

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15, React, TypeScript |
| Styling | Tailwind CSS, CSS Variables |
| Database | Supabase (PostgreSQL + PostGIS) |
| Map | Kakao Maps SDK |
| Deployment | Vercel (예정) |
| Font | Pretendard Variable |

---

## 파일 구조

```
OpenRisk/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts      # 분석 API
│   ├── result/
│   │   └── page.tsx          # 결과 페이지
│   ├── layout.tsx            # 루트 레이아웃
│   ├── page.tsx              # 메인 페이지
│   └── globals.css           # 디자인 시스템
├── components/
│   └── AreaMap.tsx           # 카카오맵 컴포넌트
├── lib/
│   ├── engine/
│   │   ├── gradeEngine.ts    # 등급 계산
│   │   ├── copyRenderer.ts   # 해석 문구
│   │   └── index.ts          # exports
│   ├── types.ts              # TypeScript 타입
│   └── supabase.ts           # Supabase 클라이언트
└── docs/
    ├── CHANGELOG.md          # 개발 일지
    └── DATA_SPEC.md          # 데이터 명세
```
