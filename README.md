# OpenRisk

공공데이터 기반 상권 리스크 분석 서비스입니다.  
서울/경기/인천/부산 좌표를 입력하면 반경 500m 기준으로 경쟁·유동·임대료·생존·앵커 지표를 종합 분석합니다.

## Stack

- `Next.js (App Router)`
- `TypeScript`
- `Supabase`
- `Kakao Local/Maps API`
- `OpenAI API` (AI 요약)

## 주요 경로

- `app/home-b` : 메인 랜딩/검색
- `app/result-b` : 분석 결과 화면
- `app/api/v2/analyze` : v2 분석 API
- `app/api/search` : 위치 자동완성 API
- `app/api/ai/summary` : AI 경고 요약 API
- `app/board` : 커뮤니티

## 실행 방법

```bash
npm install
npm run dev
```

기본 접속: `http://localhost:3000`

## 환경 변수

필수/권장 변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `KAKAO_REST_KEY`
- `NEXT_PUBLIC_KAKAO_MAP_KEY`
- `NEXT_PUBLIC_KAKAO_JS_KEY` (권장)
- `OPENAI_API_KEY` (AI 요약 사용 시)

테스트 로그인 페이지를 사용할 때만:

- `NEXT_PUBLIC_ENABLE_TEST_LOGIN=true`
- `NEXT_PUBLIC_TEST_LOGIN_KEY=<임의의_비밀키>`

## 참고

- 일부 API는 서버 측 레이트리밋이 적용됩니다.
- SEO 파일은 `app/layout.tsx`, `app/robots.ts`, `app/sitemap.ts`에서 관리합니다.
