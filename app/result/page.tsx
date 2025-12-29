'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

// 임시 더미 데이터 (나중에 API로 대체)
const DUMMY_RESULT = {
  area: {
    id: 'hongdae',
    name: '홍대입구역 인근',
    district: '마포구',
    center: { lat: 37.556, lng: 126.923 }
  },
  lv3_5: {
    grade: 'C' as const,
    gradeName: 'C_상업',
    subTitle: 'High Risk / High Return',
    difficulty: 5,
    confidence: 0.72,
    reasons: [
      { key: 'competition_density', value: 0.88, label: '경쟁 밀도 높음' },
      { key: 'traffic_index', value: 0.90, label: '유동 집중' },
      { key: 'daypart_variance', value: 0.75, label: '시간대 편차 큼' }
    ],
    coreCopy: [
      '사람은 많지만, 그만큼 경쟁자가 많고 월세가 높습니다.',
      '트렌드가 매우 빨라 6개월 뒤를 장담하기 어렵습니다.',
      '준비되지 않은 초보자는 높은 고정비(권리금 등)만 감당하다 끝날 수 있습니다.'
    ],
    actions: [
      '트렌드 속도를 감당할 수 있는 업종인지 검토',
      '최소 6개월 고정비 버틸 자금 확보 필수',
      '경쟁 업체 대비 명확한 차별점 준비'
    ],
    risks: [
      '트렌드 변화에 민감',
      '높은 임대료/권리금',
      '마케팅 경쟁 심화'
    ]
  }
}

const GRADE_COLORS = {
  A: 'bg-green-500',
  B: 'bg-yellow-500',
  C: 'bg-red-500',
  D: 'bg-purple-500'
}

const GRADE_BG = {
  A: 'bg-green-50 dark:bg-green-900/20',
  B: 'bg-yellow-50 dark:bg-yellow-900/20',
  C: 'bg-red-50 dark:bg-red-900/20',
  D: 'bg-purple-50 dark:bg-purple-900/20'
}

function ResultContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('query')

  // TODO: 실제로는 query로 API 호출해서 결과 가져옴
  const result = DUMMY_RESULT

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* 헤더 */}
      <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          >
            ← 다시 검색
          </Link>
          <span className="text-zinc-400">|</span>
          <span className="text-zinc-600 dark:text-zinc-400">검색: {query}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 지역명 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {result.area.name}
          </h1>
          <p className="text-zinc-500">{result.area.district}</p>
        </div>

        {/* 등급 카드 */}
        <div className={`rounded-2xl p-6 mb-6 ${GRADE_BG[result.lv3_5.grade]}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 ${GRADE_COLORS[result.lv3_5.grade]} rounded-2xl flex items-center justify-center text-white text-2xl font-bold`}>
              {result.lv3_5.grade}
            </div>
            <div>
              <div className="text-xl font-bold text-zinc-900 dark:text-white">
                {result.lv3_5.gradeName}
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                {result.lv3_5.subTitle}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <span className="text-zinc-500 text-sm">난이도:</span>
              <span className="text-lg">
                {'★'.repeat(result.lv3_5.difficulty)}
                {'☆'.repeat(5 - result.lv3_5.difficulty)}
              </span>
            </div>
            <div className="text-zinc-500 text-sm">
              신뢰도: {Math.round(result.lv3_5.confidence * 100)}%
            </div>
          </div>
        </div>

        {/* 핵심 해석 */}
        <Section title="핵심 해석">
          <ul className="space-y-3">
            {result.lv3_5.coreCopy.map((copy, i) => (
              <li key={i} className="flex gap-3 text-zinc-700 dark:text-zinc-300">
                <span className="text-blue-500">•</span>
                {copy}
              </li>
            ))}
          </ul>
        </Section>

        {/* 근거 */}
        <Section title="왜 이렇게 나왔나요?">
          <div className="space-y-3">
            {result.lv3_5.reasons.map((reason) => (
              <div key={reason.key} className="flex items-center justify-between">
                <span className="text-zinc-700 dark:text-zinc-300">{reason.label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${reason.value * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-500 w-12 text-right">
                    {Math.round(reason.value * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 추천 액션 */}
        <Section title="추천 액션" icon="✅">
          <ul className="space-y-2">
            {result.lv3_5.actions.map((action, i) => (
              <li key={i} className="flex gap-3 text-zinc-700 dark:text-zinc-300">
                <span className="text-green-500">✓</span>
                {action}
              </li>
            ))}
          </ul>
        </Section>

        {/* 주의 리스크 */}
        <Section title="주의 리스크" icon="⚠️">
          <ul className="space-y-2">
            {result.lv3_5.risks.map((risk, i) => (
              <li key={i} className="flex gap-3 text-zinc-700 dark:text-zinc-300">
                <span className="text-red-500">!</span>
                {risk}
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 mb-4 border border-zinc-200 dark:border-zinc-700">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      {children}
    </div>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-500">로딩 중...</div>
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}
