# AI 프롬프트 명세서

> AI 요약 기능(`/api/ai/summary`)에서 사용하는 Groq Llama 3.3 70B 모델 프롬프트 구조 및 규칙

## 개요

| 항목 | 내용 |
|------|------|
| 모델 | Llama 3.3 70B Versatile |
| 제공사 | Groq (무료 티어) |
| 용도 | 상권 데이터 기반 AI 해석 리포트 생성 |
| 파일 | `app/api/ai/summary/route.ts` |

## 프롬프트 구조 (v1.2)

### 섹션 구성

| 섹션 | 내용 |
|------|------|
| 0) 입력 데이터 취급 규칙 | 프롬프트 주입 방지 |
| 1) 역할 및 톤 | 냉철한 분석가, 단정 금지 |
| 2) 절대 금지 | 추천/확신 표현 금지 |
| 3) 입력 스키마 | OpenRisk 데이터 구조 |
| 4) 해석 규칙 | 근거→해석→리스크 연결 |
| 5) 마케팅 언급 규칙 | 등급별 조건부 |
| 6) 출력 규격 | JSON 형식, 길이 제한 |
| 7) 최종 출력 JSON | 템플릿 |
| 8) 최종 자기검증 | 파싱 가능 여부 점검 |

---

## 핵심 규칙

### 1. 표현 규칙

**허용:**
- "~일 수 있음"
- "~경향이 관찰됨"
- "~가능성이 있음"
- "~것으로 추정됨"

**금지:**
- "~으로 판단됨", "~으로 보임" (단정)
- "좋음/나쁨/안전함/유망함" (평가)
- "대박/확실/무조건/반드시" (확신)
- "신뢰도 90%" (확률 기반 확신)

### 2. 계산 규칙

**허용:**
- 같은 레코드 내 비교 (평일 vs 주말, 거주 vs 직장)
- 배수/비율 계산 (weekday/weekend, worker/resident)

**금지:**
- 외부 평균/서울 평균 비교 (입력에 없으면)
- 비교 기준 없이 "많다/적다/높다/낮다" 표현
- null 기반 계산

### 3. 규모 표현 규칙

비교 기준이 없을 때:
```
❌ "유동인구가 많은 편"
✅ "비교 데이터 부재로 절대 평가는 제한됨"
✅ "구조 신호가 관찰됨"
```

---

## 필드 역할 분리 (중복 방지)

### structureAnalysis
**역할:** 순수 상권 구조 서술 (시간대/수요 패턴/인구 구성)

**금지어:**
```
광고, 마케팅, 노출, SNS, 플레이스, 리뷰, 검색, 바이럴, 유입, 홍보
```

### marketingNote
**역할:** 마케팅 실험 가설 + 검증 방법 (2문장)

**금지어:**
```
주거/오피스/복합, 평일/주말, 점심/저녁, 직장인/거주민, 시간대, 배후 수요
```

**조건:**
- `analysis.marketingElasticity`가 null이면 반드시 null
- grade D 또는 grade 없음이면 null

**작성 형식:**
```
1문장(가설): 어떤 마케팅 변수가 성과에 영향을 줄 수 있는지
2문장(검증): 소규모 테스트/관찰 지표로 확인 필요
```

---

## 특수 규칙

### riskChecks 작성 규칙

keyMetrics의 구조적 특성에서 논리적으로 리스크 도출:

```
keyMetrics: "평일 유동인구가 주말의 3배"
→ riskChecks: "주말 매출 공백 가능성에 대한 대비 필요"

keyMetrics: "외부 유입 의존도 높음"
→ riskChecks: "경기 변동이나 계절 요인에 민감할 수 있음"
```

### finalSummary 필수 구조 (결론 카드)

**형식:** 2~3문장 고정

| 문장 | 내용 |
|------|------|
| 1문장 | 구조 결론 (structureAnalysis 압축, 동일 표현 금지) |
| 2문장 | riskChecks 2개를 "원인→리스크"로 압축 |
| 3문장 | nextSteps 2개를 "확인 필요" 체크리스트로 |

**규칙:**
- structureAnalysis와 동일 문장/표현 반복 금지
- 새로운 사실 생성 금지 (압축·재조합·동의어 치환·순서 변경은 허용)
- marketingNote가 null이면 "마케팅 판단 데이터 부족" 추가 가능

---

## 출력 규격

### 길이 제한

| 필드 | 제한 |
|------|------|
| oneLiner | 60자 이내 |
| structureAnalysis | 2~3문장, 350자 이내 |
| keyMetrics.interpretation | 각 50자 이내 |
| riskChecks 각 항목 | 120자 이내 |
| nextSteps 각 항목 | 80자 이내 |
| marketingNote | 150자 이내 |
| finalSummary | 240자 이내 (2~3문장) |

### JSON 템플릿

```json
{
  "oneLiner": "상권 핵심 구조 1문장 요약",
  "structureAnalysis": "상권 유형/소비 패턴 2~3문장 해석",
  "keyMetrics": [
    {"key": "traffic_total", "label": "총 유동인구", "value": null, "interpretation": "..."},
    {"key": "traffic_weekday", "label": "평일 유동인구", "value": null, "interpretation": "..."},
    {"key": "traffic_weekend", "label": "주말 유동인구", "value": null, "interpretation": "..."},
    {"key": "resident_index", "label": "거주인구 지수", "value": null, "interpretation": "..."},
    {"key": "worker_index", "label": "직장인구 지수", "value": null, "interpretation": "..."}
  ],
  "riskChecks": ["주의 포인트 1", "주의 포인트 2"],
  "nextSteps": ["확인 행동 1", "확인 행동 2", "확인 행동 3"],
  "marketingNote": null,
  "finalSummary": "결론 카드 2~3문장",
  "disclaimer": "본 분석은 참고용이며 실제 창업 결정에는 현장 조사가 필수입니다."
}
```

---

## 버전 히스토리

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.0 | 2025-12-30 | 초기 프롬프트 작성 |
| v1.1 | 2025-12-31 | 계산 금지 완화 (배수/비율 허용), 규모 표현 규칙 추가, 길이 통일 |
| v1.2 | 2025-12-31 | 필드 역할 분리, finalSummary 결론 카드 구조, marketingNote 조건부 null |

---

## 관련 파일

- `app/api/ai/summary/route.ts` - 프롬프트 및 API 구현
- `components/AISummaryModal.tsx` - AI 요약 모달 UI
- `app/result/page.tsx` - AI 요약 버튼 트리거
