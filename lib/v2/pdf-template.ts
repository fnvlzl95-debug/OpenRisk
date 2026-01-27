/**
 * 신문지 스타일 PDF HTML 템플릿
 * Puppeteer로 렌더링하여 PDF 생성
 */
import { AnalyzeV2Response } from './types'

// 리스크 레벨 한글 매핑
const riskLevelKo: Record<string, string> = {
  LOW: '낮음',
  MEDIUM: '보통',
  HIGH: '높음',
  VERY_HIGH: '매우 높음',
}

const riskLevelColor: Record<string, string> = {
  LOW: '#16a34a',
  MEDIUM: '#ca8a04',
  HIGH: '#ea580c',
  VERY_HIGH: '#dc2626',
}

const trafficLevelKo: Record<string, string> = {
  very_low: '매우 낮음',
  low: '낮음',
  medium: '보통',
  high: '높음',
  very_high: '매우 높음',
}

const areaTypeKo: Record<string, string> = {
  'A_주거': '주거형',
  'B_혼합': '혼합형',
  'C_상업': '상업형',
  'D_특수': '특수형',
}

const peakTimeKo: Record<string, string> = {
  morning: '오전 (06-11시)',
  day: '낮 (11-17시)',
  night: '야간 (17-23시)',
}

function formatDate(): string {
  const now = new Date()
  return now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getRiskGrade(score: number): string {
  if (score <= 30) return 'A'
  if (score <= 50) return 'B'
  if (score <= 70) return 'C'
  return 'D'
}

// 가로 바 차트 생성
function generateBarSVG(values: { label: string; value: number; color: string }[]): string {
  const barHeight = 20
  const gap = 8
  const totalHeight = values.length * (barHeight + gap)

  const bars = values.map((v, i) => {
    const y = i * (barHeight + gap)
    const width = Math.max(v.value * 2.2, 2)
    return `
      <text x="0" y="${y + 14}" font-size="11" fill="#555">${v.label}</text>
      <rect x="65" y="${y + 2}" width="${width}" height="${barHeight - 4}" rx="3" fill="${v.color}" opacity="0.85"/>
      <text x="${65 + width + 6}" y="${y + 14}" font-size="11" fill="#333" font-weight="600">${v.value}%</text>
    `
  }).join('')

  return `<svg viewBox="0 0 280 ${totalHeight}" width="280" height="${totalHeight}">${bars}</svg>`
}

export function generatePdfHtml(data: AnalyzeV2Response): string {
  const { location, analysis, metrics, anchors, interpretation } = data
  const date = formatDate()
  const grade = getRiskGrade(analysis.riskScore)

  const timeBarSvg = generateBarSVG([
    { label: '오전', value: metrics.traffic.timePattern.morning, color: '#f59e0b' },
    { label: '낮', value: metrics.traffic.timePattern.day, color: '#3b82f6' },
    { label: '야간', value: metrics.traffic.timePattern.night, color: '#8b5cf6' },
  ])

  const contributionItems = Object.entries(interpretation.scoreContribution)
    .sort((a, b) => b[1].percent - a[1].percent)
    .map(([key, val]) => {
      const labels: Record<string, string> = {
        competition: '경쟁', traffic: '유동인구', cost: '임대료',
        survival: '생존율', anchor: '앵커시설', timePattern: '시간패턴',
      }
      const impactColor = val.impact === 'positive' ? '#16a34a' : val.impact === 'negative' ? '#dc2626' : '#666'
      const impactText = val.impact === 'positive' ? '+' : val.impact === 'negative' ? '-' : '='
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dotted #e5e7eb;">
        <span style="font-size:11px;color:#555;">${labels[key] || key}</span>
        <span style="font-size:12px;font-weight:700;color:${impactColor};">${impactText}${val.percent}%</span>
      </div>`
    }).join('')

  // 앵커 시설 정보
  const anchorItems: string[] = []
  if (anchors.subway) anchorItems.push(`${anchors.subway.line} ${anchors.subway.name}역 (${anchors.subway.distance}m)`)
  if (anchors.starbucks) anchorItems.push(`스타벅스 ${anchors.starbucks.count}개 (최근접 ${anchors.starbucks.distance}m)`)
  if (anchors.mart) anchorItems.push(`${anchors.mart.name} (${anchors.mart.distance}m)`)
  if (anchors.department) anchorItems.push(`${anchors.department.name} (${anchors.department.distance}m)`)

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; background: #fff; color: #1a1a1a; width: 794px; margin: 0 auto; font-size: 10px; }
  .page { padding: 28px 36px 24px; height: 1123px; position: relative; display: flex; flex-direction: column; }

  /* 헤더 */
  .header { text-align: center; border-bottom: 3px double #1a1a1a; padding-bottom: 10px; margin-bottom: 14px; }
  .header .masthead { font-size: 30px; font-weight: 900; letter-spacing: 6px; }
  .header .sub-info { display: flex; justify-content: space-between; margin-top: 5px; font-size: 8.5px; color: #888; letter-spacing: 0.5px; }
  .header .edition { font-weight: 600; color: #c0392b; }

  /* 헤드라인 */
  .headline { font-size: 22px; font-weight: 900; line-height: 1.3; text-align: center; margin-bottom: 4px; }
  .sub-headline { font-size: 10.5px; color: #555; text-align: center; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #ddd; line-height: 1.5; }

  /* 레이아웃 */
  .content { flex: 1; display: flex; flex-direction: column; }
  .row { display: flex; gap: 16px; margin-bottom: 12px; align-items: stretch; }
  .col { flex: 1; display: flex; flex-direction: column; border: 1px solid #e8e8e8; border-radius: 6px; padding: 10px 12px; background: #fcfcfc; }
  .col-narrow { flex: 0 0 220px; display: flex; flex-direction: column; border: 1px solid #e8e8e8; border-radius: 6px; padding: 10px 12px; background: #fcfcfc; }
  .col-plain { flex: 1; display: flex; flex-direction: column; }

  /* 섹션 제목 */
  .stitle { font-size: 10.5px; font-weight: 800; color: #1a1a1a; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 3px; margin-bottom: 6px; letter-spacing: 0.5px; }

  /* 점수 영역 */
  .score-area { background: #f5f5f5; border-radius: 4px; padding: 10px 12px; text-align: center; margin-bottom: 8px; }
  .grade-badge { display: inline-block; width: 28px; height: 28px; line-height: 28px; border-radius: 50%; font-size: 14px; font-weight: 900; color: #fff; }

  /* 테이블 */
  .mt { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 6px; }
  .mt th { background: #f5f5f5; padding: 4px 6px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #ddd; }
  .mt td { padding: 4px 6px; border-bottom: 1px solid #eee; color: #333; }
  .mt td.v { text-align: right; font-weight: 600; }

  /* 인사이트 */
  .ins { background: #f0f0f0; border-left: 2px solid #c0392b; padding: 6px 10px; margin-bottom: 0; font-size: 9.5px; line-height: 1.6; color: #444; margin-top: auto; }
  .ins b { color: #1a1a1a; }

  /* 기여도 */
  .contrib { font-size: 9.5px; }

  /* 리스크/기회 */
  .fl { font-size: 9.5px; line-height: 1.6; color: #444; margin-bottom: 6px; }
  .fl .fi { padding: 2px 0 2px 12px; position: relative; }
  .fl .fi::before { position: absolute; left: 0; font-size: 8px; }
  .fl .ri::before { content: "\\25B6"; color: #dc2626; }
  .fl .oi::before { content: "\\25B6"; color: #16a34a; }

  /* 앵커 */
  .anchor-row { display: flex; gap: 8px; flex-wrap: wrap; font-size: 9.5px; margin-bottom: 6px; }
  .anchor-tag { background: #f5f5f5; padding: 3px 8px; border-radius: 3px; }

  /* 리스크 카드 */
  .rcard { border: 1px solid #e5e5e5; border-radius: 4px; padding: 8px 10px; }
  .rcard.critical { border-left: 3px solid #dc2626; }
  .rcard.warning { border-left: 3px solid #ea580c; }
  .rcard.caution { border-left: 3px solid #ca8a04; }
  .rcard .flag { font-size: 10.5px; font-weight: 700; margin-bottom: 2px; }
  .rcard .warn { font-size: 9px; color: #666; }
  .badge { display: inline-block; padding: 1px 5px; font-size: 8.5px; font-weight: 600; border-radius: 2px; margin-right: 3px; margin-top: 3px; }
  .badge-metric { background: #eff6ff; color: #2563eb; }
  .badge-data { background: #f0fdf4; color: #16a34a; }
  .badge-trend { background: #fef3c7; color: #d97706; }

  /* 구분선 */
  .div { border: none; border-top: 1px solid #ddd; margin: 8px 0; }
  .div-thick { border: none; border-top: 1.5px solid #1a1a1a; margin: 10px 0; }

  /* 푸터 */
  .footer { border-top: 1px solid #ddd; padding-top: 6px; margin-top: auto; display: flex; justify-content: space-between; font-size: 7.5px; color: #aaa; }
</style>
</head>
<body>
<div class="page">
  <!-- 헤더 -->
  <div class="header">
    <div class="masthead">OPEN RISK</div>
    <div class="sub-info">
      <span>${date} | ${location.region} ${location.district}</span>
      <span class="edition">RISK ANALYSIS REPORT</span>
      <span>공공데이터 기반 상권 분석</span>
    </div>
  </div>

  <h1 class="headline">"${location.address}" ${analysis.categoryName} 창업 리스크 분석</h1>
  <p class="sub-headline">${interpretation.summary}</p>

  <div class="content">
  <!-- 1행: 리스크종합+기여도 | 핵심분석+리스크+기회요인 -->
  <div class="row">
    <div class="col-narrow">
      <div class="stitle">리스크 종합</div>
      <div class="score-area" style="display:flex;align-items:center;justify-content:center;gap:10px;">
        <span class="grade-badge" style="background:${riskLevelColor[analysis.riskLevel]};flex-shrink:0;">${grade}</span>
        <div style="text-align:left;">
          <div style="font-size:18px;font-weight:900;color:${riskLevelColor[analysis.riskLevel]};">${analysis.riskScore}<span style="font-size:10px;color:#999;font-weight:400;">/100</span></div>
          <div style="font-size:9px;color:#666;">${riskLevelKo[analysis.riskLevel] || analysis.riskLevel} · ${areaTypeKo[analysis.areaType] || analysis.areaType}</div>
        </div>
      </div>
      <div class="stitle">점수 기여도</div>
      <div class="contrib">${contributionItems}</div>
    </div>
    <div class="col">
      <div class="stitle">핵심 분석</div>
      <div style="font-size:10px;line-height:1.6;color:#333;margin-bottom:6px;">${interpretation.summary}</div>

      ${interpretation.risks.length > 0 ? `
      <div class="stitle" style="border-color:#dc2626;color:#dc2626;">주요 리스크</div>
      <div class="fl">${interpretation.risks.map(r => `<div class="fi ri">${r}</div>`).join('')}</div>
      ` : ''}

      ${interpretation.opportunities.length > 0 ? `
      <div class="stitle" style="border-color:#16a34a;color:#16a34a;">기회 요인</div>
      <div class="fl">${interpretation.opportunities.map(o => `<div class="fi oi">${o}</div>`).join('')}</div>
      ` : ''}
    </div>
  </div>

  <hr class="div-thick">

  <!-- 2행: 경쟁+앵커 | 유동인구 -->
  <div class="row">
    <div class="col">
      <div class="stitle">경쟁 현황</div>
      <table class="mt">
        <tr><td>전체 점포 (500m)</td><td class="v">${metrics.competition.total}개</td></tr>
        <tr><td>동종 (${analysis.categoryName})</td><td class="v">${metrics.competition.sameCategory}개</td></tr>
        <tr><td>밀도</td><td class="v">${metrics.competition.densityLevel === 'high' ? '높음' : metrics.competition.densityLevel === 'medium' ? '보통' : '낮음'}</td></tr>
        ${metrics.competition.nearestCompetitor ? `<tr><td>최근접</td><td class="v">${metrics.competition.nearestCompetitor.name} ${metrics.competition.nearestCompetitor.distance}m</td></tr>` : ''}
      </table>
      <div class="ins"><b>분석:</b> ${interpretation.easyExplanations.competition}</div>
      ${anchorItems.length > 0 ? `
      <div class="stitle" style="margin-top:4px;">앵커 시설</div>
      <div class="anchor-row">${anchorItems.map(item => `<span class="anchor-tag">${item}</span>`).join('')}</div>
      ` : ''}
    </div>
    <div class="col">
      <div class="stitle">유동인구</div>
      <table class="mt">
        <tr><td>유동 지수</td><td class="v">${metrics.traffic.index}/100</td></tr>
        <tr><td>수준</td><td class="v">${trafficLevelKo[metrics.traffic.level] || metrics.traffic.level}</td></tr>
        <tr><td>피크</td><td class="v">${peakTimeKo[metrics.traffic.peakTime] || metrics.traffic.peakTime}</td></tr>
        <tr><td>주말/평일</td><td class="v">${metrics.traffic.weekendRatio.toFixed(2)}</td></tr>
      </table>
      <div style="margin-bottom:4px;">${timeBarSvg}</div>
      <div class="ins"><b>분석:</b> ${interpretation.easyExplanations.traffic}</div>
    </div>
  </div>

  <hr class="div">

  <!-- 3행: 임대료 | 생존율 -->
  <div class="row">
    <div class="col">
      <div class="stitle">임대료</div>
      <table class="mt">
        <tr><td>평균 (만원/평)</td><td class="v">${metrics.cost.avgRent.toFixed(1)}</td></tr>
        <tr><td>수준</td><td class="v">${metrics.cost.level === 'high' ? '높음' : metrics.cost.level === 'medium' ? '보통' : '낮음'}</td></tr>
        ${metrics.cost.districtAvg ? `<tr><td>${location.district} 평균</td><td class="v">${metrics.cost.districtAvg.toFixed(1)}</td></tr>` : ''}
      </table>
      <div class="ins"><b>분석:</b> ${interpretation.easyExplanations.cost}</div>
    </div>
    <div class="col">
      <div class="stitle">점포 생존율</div>
      <table class="mt">
        <tr><td>폐업률</td><td class="v">${metrics.survival.closureRate.toFixed(1)}%</td></tr>
        <tr><td>개업률</td><td class="v">${metrics.survival.openingRate.toFixed(1)}%</td></tr>
        <tr><td>순증감</td><td class="v">${metrics.survival.netChange > 0 ? '+' : ''}${metrics.survival.netChange}개</td></tr>
        <tr><td>트렌드</td><td class="v">${metrics.survival.trendLabel}</td></tr>
      </table>
      <div class="ins"><b>분석:</b> ${interpretation.easyExplanations.survival}</div>
    </div>
  </div>

  <!-- 리스크 카드 -->
  ${data.riskCards && data.riskCards.length > 0 ? `
  <hr class="div">
  <div class="stitle" style="border-color:#dc2626;">현장 확인 필수</div>
  <div class="row">
    ${data.riskCards.slice(0, 3).map(card => `
    <div class="col-plain">
      <div class="rcard ${card.severity}">
        <div class="flag">${card.flag}</div>
        <div class="warn">${card.warning}</div>
        <div>${card.evidenceBadges.map(b => `<span class="badge badge-${b.type}">${b.label}</span>`).join('')}</div>
      </div>
    </div>
    `).join('')}
  </div>
  ` : ''}

  </div><!-- /content -->

  <div class="footer">
    <span>OPEN RISK | 공공데이터 기반 상권 분석 플랫폼</span>
    <span>${date} 기준 | 본 리포트는 참고용이며, 실제 투자 판단의 근거로 사용할 수 없습니다.</span>
  </div>
</div>
</body>
</html>`
}
