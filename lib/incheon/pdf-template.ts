import type { IncheonAnalyzeResponse } from './types'

const riskLevelKo: Record<string, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
  VERY_HIGH: '매우 높음',
}

const confidenceKo: Record<string, string> = { high: '높음', medium: '중간', low: '낮음' }

const metricMeta: Array<{ key: 'competition' | 'transit' | 'cost' | 'anchor'; label: string; desc: string; color: string }> = [
  { key: 'competition', label: '경쟁 과밀', desc: '반경 500m 내 같은 업종 밀집 정도', color: '#FF6B1D' },
  { key: 'transit', label: '교통 접근성(유입 부족)', desc: '버스·지하철 접근성으로 본 고객 유입', color: '#0B66FF' },
  { key: 'cost', label: '비용 압박', desc: '권역 소규모상가 임대료·공실률 참고', color: '#16B8C8' },
  { key: 'anchor', label: '생활권 앵커', desc: '학교·역 등 사람을 모으는 시설 접근', color: '#7957F2' },
]

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatDate(iso?: string): string {
  const date = iso ? new Date(iso) : new Date()
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function scoreBar(score: number | null, color: string): string {
  if (score === null) {
    return `<div class="bar"><div class="bar-fill" style="width:0%;background:#9AA8BA"></div></div><span class="bar-na">정보 부족</span>`
  }
  return `<div class="bar"><div class="bar-fill" style="width:${Math.min(100, score)}%;background:${color}"></div></div><span class="bar-val">${score}</span>`
}

function section(num: number, title: string, body: string): string {
  return `<section class="sec">
    <h2 class="sec-title"><span class="sec-num">${num}</span>${esc(title)}</h2>
    <div class="sec-body">${body}</div>
  </section>`
}

function metricSection(num: number, data: IncheonAnalyzeResponse, key: 'competition' | 'transit' | 'cost' | 'anchor', lifeKey: keyof IncheonAnalyzeResponse['lifeDNA']): string {
  const meta = metricMeta.find((m) => m.key === key)!
  const score = data.risk.scoreBreakdown[key]
  const degraded = (data.risk.degradedMetrics ?? []).includes(key)
  const excluded = (data.risk.excludedMetrics ?? []).includes(key)
  const life = data.lifeDNA[lifeKey]
  const evidence = (life?.evidence ?? []).map((item) => `<li>${esc(item)}</li>`).join('')
  const cautions = (life?.cautions ?? []).map((item) => `<li>${esc(item)}</li>`).join('')
  const tag = excluded ? '<span class="tag tag-na">정보 부족</span>' : degraded ? '<span class="tag tag-deg">제한적 반영</span>' : ''
  return section(num, meta.label, `
    <p class="desc">${esc(meta.desc)} ${tag}</p>
    <div class="bar-row">${scoreBar(score, meta.color)}</div>
    ${evidence ? `<p class="lbl">근거</p><ul class="list">${evidence}</ul>` : ''}
    ${cautions ? `<p class="lbl">유의</p><ul class="list muted">${cautions}</ul>` : ''}
  `)
}

export function generateIncheonPdfHtml(data: IncheonAnalyzeResponse, displayLabel = data.location.label || '인천 분석 지점'): string {
  const { location, category, risk } = data
  const analysisLabel = displayLabel || location.label || '인천 분석 지점'
  const scoreText = risk.score === null ? '—' : String(risk.score)
  const levelText = risk.insufficientData ? '판단 보류' : riskLevelKo[risk.level] ?? '-'
  const date = formatDate()
  const baseDate = formatDate(data.auxiliary?.datasetGeneratedAt)

  const top3 = (data.cards?.riskTop3 ?? [])
    .map((card, i) => `<div class="card"><span class="rank">${i + 1}</span><div><p class="card-t">${esc(card.title)}</p><p class="card-b">${esc(card.body)}</p></div></div>`)
    .join('')

  const reasons = (risk.confidenceReasons ?? []).map((r) => `<li>${esc(r)}</li>`).join('')

  const checks = (data.cards?.fieldChecks ?? []).map((q, i) => `<div class="check"><span class="check-n">${i + 1}</span><span>${esc(q)}</span></div>`).join('')

  const sources = (data.sources ?? [])
    .map((s) => `<div class="src"><span class="src-n">${esc(s.name)}</span><span class="src-p">${esc(s.provider)}</span><span class="src-u">${s.scoringUse ? '점수 반영' : '참고'}</span></div>`)
    .join('')

  const survival = risk.survival

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif; background:#fff; color:#0E1F38; width:794px; margin:0 auto; }
  .page { padding:40px 44px; display:flex; flex-direction:column; gap:18px; }
  .top { border-bottom:3px solid #0B66FF; padding-bottom:14px; }
  .brand { font-size:13px; font-weight:800; color:#0B66FF; letter-spacing:1px; }
  .title { font-size:26px; font-weight:900; margin-top:6px; }
  .meta { display:flex; flex-wrap:wrap; gap:14px; margin-top:10px; font-size:12px; color:#53657E; font-weight:600; }
  .meta b { color:#0E1F38; }
  .hero { display:flex; align-items:center; gap:24px; border:1px solid #D7E1F0; background:#F8FBFF; padding:20px 24px; }
  .hero-score { font-size:64px; font-weight:900; line-height:1; color:#FF651F; }
  .hero-level { font-size:20px; font-weight:900; border:2px solid #FF8A1F; color:#E8590C; padding:6px 14px; }
  .hero-conf { margin-left:auto; text-align:right; font-size:12px; color:#53657E; font-weight:700; }
  .sec { border:1px solid #E3EAF4; padding:14px 16px; }
  .sec-title { font-size:14px; font-weight:900; display:flex; align-items:center; gap:8px; }
  .sec-num { display:inline-flex; width:20px; height:20px; align-items:center; justify-content:center; background:#0B66FF; color:#fff; border-radius:50%; font-size:11px; }
  .sec-body { margin-top:10px; font-size:12px; line-height:1.6; color:#33445E; }
  .desc { font-weight:600; }
  .bar-row { margin-top:8px; }
  .bar { display:inline-block; vertical-align:middle; width:74%; height:12px; background:#EDF2F8; border-radius:6px; overflow:hidden; }
  .bar-fill { height:100%; }
  .bar-val { margin-left:8px; font-weight:900; font-size:13px; }
  .bar-na { margin-left:8px; font-weight:800; color:#6B7A90; }
  .lbl { margin-top:10px; font-size:11px; font-weight:800; color:#0B66FF; }
  .list { margin-top:4px; padding-left:16px; }
  .list li { margin:2px 0; }
  .list.muted li { color:#6B7A90; }
  .tag { font-size:10px; font-weight:800; padding:2px 6px; margin-left:6px; }
  .tag-deg { background:#FFF1E0; color:#C2710C; }
  .tag-na { background:#F2F5F9; color:#6B7A90; }
  .card { display:flex; gap:10px; padding:8px 0; border-bottom:1px dotted #E3EAF4; }
  .rank { flex:0 0 22px; height:22px; background:#FFF1E8; color:#F06A1A; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:12px; }
  .card-t { font-weight:800; }
  .card-b { color:#53657E; margin-top:2px; }
  .survival { border:1px dashed #C9D6E8; background:#FAFCFF; padding:12px 14px; }
  .check { display:flex; gap:8px; padding:5px 0; }
  .check-n { flex:0 0 20px; height:20px; background:#0B66FF; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; }
  .src { display:flex; gap:10px; padding:5px 0; border-bottom:1px solid #EEF2F8; font-size:11px; }
  .src-n { font-weight:800; flex:1; }
  .src-p { color:#6B7A90; }
  .src-u { color:#0B66FF; font-weight:800; }
  .foot { margin-top:8px; font-size:10px; color:#8A98AC; line-height:1.6; }
</style></head>
<body><div class="page">

  <div class="top">
    <div class="brand">OpenRisk 인천 · 공공데이터 상권 리스크 리포트</div>
    <div class="title">${esc(analysisLabel)} · ${esc(category.name)}</div>
    <div class="meta">
      <span>업종 <b>${esc(category.name)}</b></span>
      <span>분석 반경 <b>${location.radiusMeters}m</b></span>
      <span>H3 <b>res ${location.h3Resolution}</b></span>
      <span>발행일 <b>${date}</b></span>
    </div>
  </div>

  ${section(1, '분석 개요', `이 리포트는 인천 공공데이터(점포·교통·교육/보육·임대료)만으로 반경 ${location.radiusMeters}m 상권 리스크를 0~100으로 산정한 결과입니다. 점수가 높을수록 위험이 큽니다. 본 분석은 참고 자료이며, 창업·투자 결정의 최종 근거로 사용할 수 없습니다.`)}

  ${section(2, '위치 · 업종 · 분석 반경', `
    <p>· 분석 기준점: <b>${esc(analysisLabel)}</b> (위도 ${location.lat.toFixed(5)}, 경도 ${location.lng.toFixed(5)})</p>
    <p>· 대상 업종: <b>${esc(category.name)}</b></p>
    <p>· 분석 반경: <b>${location.radiusMeters}m</b> (H3 res ${location.h3Resolution}, 거리 감쇠 가중)</p>
  `)}

  <div class="hero">
    <div>
      <div style="font-size:12px;font-weight:800;color:#53657E">종합 위험 점수</div>
      <div class="hero-score">${scoreText}</div>
    </div>
    <div class="hero-level">${esc(levelText)}</div>
    <div class="hero-conf">데이터 신뢰도<br/><b style="font-size:16px;color:#0E1F38">${confidenceKo[risk.confidence ?? 'medium']}</b></div>
  </div>

  ${section(3, '핵심 위험 요인', top3 || '<p>상권 데이터가 부족해 핵심 위험 요인을 확정하지 않았습니다.</p>')}

  ${metricSection(4, data, 'competition', 'categoryDensity')}
  ${metricSection(5, data, 'transit', 'transitAccess')}
  ${metricSection(6, data, 'cost', 'costPressure')}
  ${metricSection(7, data, 'anchor', 'educationFamily')}

  ${section(8, '복합 위험 신호 (참고)', `
    <div class="survival">
      <p><b>${esc(survival?.label ?? '복합 위험 신호')}: ${survival?.score ?? '—'}</b> <span class="tag tag-na">종합 점수 미반영</span></p>
      <p style="margin-top:6px;color:#53657E">경쟁·비용·접근성을 조합한 참고용 복합 신호입니다. 실제 폐업률 데이터가 아니며, 종합 점수에는 반영하지 않습니다.</p>
    </div>
  `)}

  ${section(9, '데이터 신뢰도 · 한계', `
    <p>종합 신뢰도: <b>${confidenceKo[risk.confidence ?? 'medium']}</b></p>
    ${reasons ? `<p class="lbl">신뢰도 산정 근거</p><ul class="list">${reasons}</ul>` : ''}
    <p class="foot">모든 지표는 공공데이터 기반 추정치이며 실제와 차이가 있을 수 있습니다. 비용은 권역 단위, 일부 지표는 데이터 공백이 있을 수 있습니다.</p>
  `)}

  ${section(10, '창업 전 현장 체크리스트', checks || '체크리스트가 준비되지 않았습니다.')}

  ${section(11, '데이터 출처 · 기준일', `
    <p style="margin-bottom:6px">데이터 기준일: <b>${baseDate}</b> · 정책: <b>공공데이터 전용</b></p>
    ${sources || '출처 정보가 없습니다.'}
  `)}

  <p class="foot">© ${new Date().getFullYear()} OpenRisk · 본 리포트의 분석 결과에 따른 의사결정 책임은 이용자에게 있으며, 제공자는 분석 오류·데이터 지연으로 인한 손해에 책임지지 않습니다. 실제 창업 시 현장 조사·전문가 상담·재무 검토가 필수입니다.</p>

</div></body></html>`
}
