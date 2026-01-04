/**
 * OpenRisk PDF 리포트 생성기
 * jsPDF + Canvas 기반 한글 텍스트 렌더링
 */

import { jsPDF } from 'jspdf'
import { AnalyzeV2Response, AREA_TYPE_INFO } from './v2/types'

interface PdfOptions {
  data: AnalyzeV2Response
  filename?: string
}

// 한글 텍스트를 캔버스로 렌더링하여 이미지로 변환
function renderTextToCanvas(
  text: string,
  options: {
    fontSize: number
    fontWeight?: string
    color?: string
    maxWidth?: number
  }
): { dataUrl: string; width: number; height: number } | null {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const { fontSize, fontWeight = 'normal', color = '#000000', maxWidth } = options
  const scale = 3 // 고해상도

  // 폰트 설정
  const fontFamily = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, sans-serif'
  ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`

  // 텍스트 줄바꿈
  const lines: string[] = []
  if (maxWidth) {
    let currentLine = ''
    for (const char of text) {
      const testLine = currentLine + char
      const metrics = ctx.measureText(testLine)
      if (metrics.width / scale > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = char
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)
  } else {
    lines.push(text)
  }

  // 캔버스 크기 계산
  let maxLineWidth = 0
  for (const line of lines) {
    const w = ctx.measureText(line).width
    if (w > maxLineWidth) maxLineWidth = w
  }

  const lineHeight = fontSize * scale * 1.3
  canvas.width = Math.ceil(maxLineWidth) + 10
  canvas.height = Math.ceil(lines.length * lineHeight) + 10

  // 다시 폰트 설정 (캔버스 크기 변경 후 리셋됨)
  ctx.font = `${fontWeight} ${fontSize * scale}px ${fontFamily}`
  ctx.fillStyle = color
  ctx.textBaseline = 'top'

  // 각 줄 그리기
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, i * lineHeight)
  })

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: maxLineWidth / scale,
    height: (lines.length * lineHeight) / scale,
  }
}

/**
 * 분석 결과를 PDF로 생성
 */
export async function generatePdf({ data, filename }: PdfOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // 헬퍼: 한글 텍스트 그리기
  const drawText = (
    text: string,
    x: number,
    yPos: number,
    options: {
      fontSize?: number
      fontWeight?: string
      color?: string
      maxWidth?: number
      align?: 'left' | 'center' | 'right'
    } = {}
  ): number => {
    const { fontSize = 10, fontWeight, color, maxWidth, align = 'left' } = options

    const result = renderTextToCanvas(text, { fontSize, fontWeight, color, maxWidth })
    if (!result) return yPos

    let drawX = x
    if (align === 'center' && maxWidth) {
      drawX = x + (maxWidth - result.width) / 2
    } else if (align === 'right' && maxWidth) {
      drawX = x + maxWidth - result.width
    }

    doc.addImage(result.dataUrl, 'PNG', drawX, yPos, result.width, result.height)
    return yPos + result.height
  }

  // 헬퍼: 사각형 그리기
  const drawRect = (
    x: number,
    yPos: number,
    width: number,
    height: number,
    options: { fill?: string; stroke?: string } = {}
  ) => {
    if (options.fill) {
      doc.setFillColor(options.fill)
      doc.rect(x, yPos, width, height, 'F')
    }
    if (options.stroke) {
      doc.setDrawColor(options.stroke)
      doc.setLineWidth(0.3)
      doc.rect(x, yPos, width, height, 'S')
    }
  }

  // ===== 헤더 =====
  drawRect(margin, y, contentWidth, 14, { fill: '#000000' })
  drawText('OPEN RISK', margin + 4, y + 3, { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF' })
  drawText('창업 리스크 분석 리포트', margin + contentWidth - 55, y + 5, { fontSize: 9, color: '#FFFFFF' })
  y += 18

  // ===== 날짜 =====
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  drawText(`분석 일시: ${today}`, margin, y, { fontSize: 8, color: '#666666' })
  y += 6

  // ===== 기본 정보 카드 =====
  const cardWidth = (contentWidth - 6) / 3
  const cardHeight = 18

  // 위치
  drawRect(margin, y, cardWidth, cardHeight, { stroke: '#000000' })
  drawText('위치', margin + 3, y + 2, { fontSize: 7, color: '#888888' })
  drawText(data.location.district, margin + 3, y + 8, { fontSize: 10, fontWeight: 'bold' })

  // 업종
  drawRect(margin + cardWidth + 3, y, cardWidth, cardHeight, { stroke: '#000000' })
  drawText('업종', margin + cardWidth + 6, y + 2, { fontSize: 7, color: '#888888' })
  drawText(data.analysis.categoryName, margin + cardWidth + 6, y + 8, { fontSize: 10, fontWeight: 'bold' })

  // 상권유형
  const areaTypeInfo = AREA_TYPE_INFO[data.analysis.areaType]
  const areaTypeBg = data.analysis.areaType === 'D_특수' ? '#000000' :
                     data.analysis.areaType === 'C_상업' ? '#4B5563' :
                     data.analysis.areaType === 'B_혼합' ? '#9CA3AF' : '#D1D5DB'
  const areaTypeColor = data.analysis.areaType === 'A_주거' ? '#000000' : '#FFFFFF'

  drawRect(margin + (cardWidth + 3) * 2, y, cardWidth, cardHeight, { fill: areaTypeBg })
  drawText('상권유형', margin + (cardWidth + 3) * 2 + 3, y + 2, {
    fontSize: 7,
    color: data.analysis.areaType === 'A_주거' ? '#666666' : '#CCCCCC'
  })
  drawText(areaTypeInfo?.name || data.analysis.areaType, margin + (cardWidth + 3) * 2 + 3, y + 8, {
    fontSize: 10,
    fontWeight: 'bold',
    color: areaTypeColor
  })
  y += cardHeight + 6

  // ===== 주소 =====
  y = drawText(data.location.address, margin, y, { fontSize: 14, fontWeight: 'bold' }) + 4

  // 요약
  drawRect(margin, y, 2, 14, { fill: '#000000' })
  y = drawText(data.interpretation.summary, margin + 5, y + 1, {
    fontSize: 9,
    color: '#444444',
    maxWidth: contentWidth - 8,
  }) + 6

  // ===== 위험도 점수 =====
  drawRect(margin, y, contentWidth, 28, { stroke: '#E5E7EB' })
  drawText('위험도', margin + 4, y + 3, { fontSize: 8, color: '#888888' })
  drawText(String(data.analysis.riskScore), margin + 4, y + 9, { fontSize: 22, fontWeight: 'bold' })

  const riskLabel = data.analysis.riskScore >= 70 ? '매우 위험' :
                    data.analysis.riskScore >= 50 ? '위험' :
                    data.analysis.riskScore >= 30 ? '주의' : '안전'
  drawText(riskLabel, margin + 28, y + 16, { fontSize: 9, fontWeight: 'bold' })

  // 프로그레스 바
  const barX = margin + 55
  const barWidth = contentWidth - 60
  drawRect(barX, y + 14, barWidth, 6, { fill: '#F3F4F6' })
  drawRect(barX, y + 14, barWidth * (data.analysis.riskScore / 100), 6, { fill: '#000000' })
  y += 34

  // ===== 4대 지표 =====
  const { metrics } = data
  const indicators = [
    {
      label: '경쟁',
      value: metrics.competition.sameCategory >= 16 ? '과포화' :
             metrics.competition.sameCategory >= 11 ? '포화' :
             metrics.competition.sameCategory >= 6 ? '보통' : '여유',
      sub: `동종 ${metrics.competition.sameCategory}개`,
      percent: Math.min(metrics.competition.sameCategory / 20 * 100, 100),
    },
    {
      label: '유동인구',
      value: metrics.traffic.level === 'very_high' ? '매우많음' :
             metrics.traffic.level === 'high' ? '많음' :
             metrics.traffic.level === 'medium' ? '보통' :
             metrics.traffic.level === 'low' ? '적음' : '매우적음',
      sub: `지수 ${metrics.traffic.index}`,
      percent: Math.min(metrics.traffic.index, 100),
    },
    {
      label: '임대료',
      value: metrics.cost.level === 'high' ? '높음' :
             metrics.cost.level === 'medium' ? '보통' : '낮음',
      sub: `${data.location.region} 기준`,
      percent: metrics.cost.level === 'high' ? 100 : metrics.cost.level === 'medium' ? 60 : 30,
    },
    {
      label: '폐업률',
      value: `${metrics.survival.closureRate}%`,
      sub: metrics.survival.trendLabel,
      percent: Math.min(metrics.survival.closureRate * 5, 100),
    },
  ]

  const colWidth = (contentWidth - 9) / 4
  indicators.forEach((ind, idx) => {
    const colX = margin + idx * (colWidth + 3)
    drawRect(colX, y, colWidth, 32, { stroke: '#E5E7EB' })
    drawText(ind.label, colX + 3, y + 2, { fontSize: 7, color: '#888888' })
    drawText(ind.value, colX + 3, y + 9, { fontSize: 12, fontWeight: 'bold' })

    // 바
    drawRect(colX + 3, y + 22, colWidth - 6, 3, { fill: '#F3F4F6' })
    drawRect(colX + 3, y + 22, (colWidth - 6) * (ind.percent / 100), 3, { fill: '#000000' })

    drawText(ind.sub, colX + 3, y + 27, { fontSize: 6, color: '#888888' })
  })
  y += 38

  // ===== 핵심 요약 =====
  drawText('핵심 요약', margin, y, { fontSize: 10, fontWeight: 'bold' })
  drawRect(margin, y + 5, contentWidth, 0.5, { fill: '#000000' })
  y += 9

  const topRisks = data.riskCards?.slice(0, 3) || []
  if (topRisks.length > 0) {
    topRisks.forEach((card, i) => {
      drawRect(margin, y, contentWidth, 16, { fill: '#F9FAFB' })
      drawRect(margin, y, 2, 16, { fill: '#000000' })
      drawText(`0${i + 1}`, margin + 5, y + 2, { fontSize: 7, color: '#888888' })
      drawText(card.flag, margin + 14, y + 2, { fontSize: 9, fontWeight: 'bold' })
      drawText(card.warning, margin + 14, y + 9, { fontSize: 8, color: '#444444', maxWidth: contentWidth - 20 })
      y += 18
    })
  } else {
    const insights = [
      { title: '경쟁 현황', text: data.interpretation.easyExplanations.competition },
      { title: '유동인구', text: data.interpretation.easyExplanations.traffic },
      { title: '비용 효율', text: data.interpretation.easyExplanations.cost },
    ]
    insights.forEach((ins, i) => {
      drawRect(margin, y, contentWidth, 16, { fill: '#F9FAFB' })
      drawRect(margin, y, 2, 16, { fill: '#000000' })
      drawText(`0${i + 1}`, margin + 5, y + 2, { fontSize: 7, color: '#888888' })
      drawText(ins.title, margin + 14, y + 2, { fontSize: 9, fontWeight: 'bold' })
      drawText(ins.text, margin + 14, y + 9, { fontSize: 8, color: '#444444', maxWidth: contentWidth - 20 })
      y += 18
    })
  }
  y += 4

  // ===== 앵커 시설 =====
  if (data.anchors.hasAnyAnchor) {
    drawText('주변 집객 시설', margin, y, { fontSize: 10, fontWeight: 'bold' })
    drawRect(margin, y + 5, contentWidth, 0.5, { fill: '#000000' })
    y += 9

    const anchorList: string[] = []
    if (data.anchors.subway) {
      anchorList.push(`지하철: ${data.anchors.subway.name}역 (${data.anchors.subway.line}) - ${data.anchors.subway.distance}m`)
    }
    if (data.anchors.starbucks) {
      anchorList.push(`스타벅스: ${data.anchors.starbucks.count}개 (최근접 ${data.anchors.starbucks.distance}m)`)
    }
    if (data.anchors.mart) {
      anchorList.push(`대형마트: ${data.anchors.mart.name} - ${data.anchors.mart.distance}m`)
    }
    if (data.anchors.department) {
      anchorList.push(`백화점: ${data.anchors.department.name} - ${data.anchors.department.distance}m`)
    }

    anchorList.forEach(item => {
      y = drawText(item, margin + 3, y, { fontSize: 8, color: '#444444' }) + 2
    })
    y += 4
  }

  // ===== 시간대별 유동 =====
  drawText('시간대별 유동', margin, y, { fontSize: 10, fontWeight: 'bold' })
  drawRect(margin, y + 5, contentWidth, 0.5, { fill: '#000000' })
  y += 9

  const times = [
    { label: '오전 (06-11)', value: metrics.traffic.timePattern.morning },
    { label: '낮 (11-17)', value: metrics.traffic.timePattern.day },
    { label: '저녁 (17-23)', value: metrics.traffic.timePattern.night },
  ]
  const timeColW = (contentWidth - 6) / 3
  times.forEach((t, idx) => {
    const tx = margin + idx * (timeColW + 3)
    drawText(t.label, tx, y, { fontSize: 7, color: '#666666' })
    drawRect(tx, y + 5, timeColW, 5, { fill: '#F3F4F6' })
    drawRect(tx, y + 5, timeColW * (t.value / 100), 5, { fill: '#000000' })
    drawText(`${t.value}%`, tx + timeColW - 10, y + 11, { fontSize: 7, color: '#444444' })
  })
  y += 20

  // ===== 상권 안정성 =====
  drawText('상권 안정성', margin, y, { fontSize: 10, fontWeight: 'bold' })
  drawRect(margin, y + 5, contentWidth, 0.5, { fill: '#000000' })
  y += 9

  drawRect(margin, y, contentWidth, 22, { fill: '#F9FAFB', stroke: '#E5E7EB' })

  // 폐업률
  drawText('연간 폐업률', margin + 4, y + 3, { fontSize: 7, color: '#666666' })
  drawText(`${metrics.survival.closureRate}%`, margin + 35, y + 3, { fontSize: 7, fontWeight: 'bold' })
  drawRect(margin + 4, y + 9, (contentWidth / 2) - 10, 4, { fill: '#E5E7EB' })
  drawRect(margin + 4, y + 9, ((contentWidth / 2) - 10) * Math.min(metrics.survival.closureRate * 3, 100) / 100, 4, { fill: '#000000' })

  // 주말 비중
  const weekendP = Math.round(metrics.traffic.weekendRatio * 100)
  drawText('주말 매출 비중', margin + contentWidth / 2, y + 3, { fontSize: 7, color: '#666666' })
  drawText(`${weekendP}%`, margin + contentWidth / 2 + 38, y + 3, { fontSize: 7, fontWeight: 'bold' })
  drawRect(margin + contentWidth / 2, y + 9, (contentWidth / 2) - 10, 4, { fill: '#E5E7EB' })
  drawRect(margin + contentWidth / 2, y + 9, ((contentWidth / 2) - 10) * (weekendP / 100), 4, { fill: '#000000' })

  drawText(metrics.survival.summary, margin + 4, y + 16, { fontSize: 7, color: '#666666', maxWidth: contentWidth - 10 })
  y += 28

  // ===== 푸터 =====
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 15
  drawRect(margin, footerY, contentWidth, 0.3, { fill: '#E5E7EB' })
  drawText('※ 본 분석은 공공데이터 기반 추정치이며, 실제와 다를 수 있습니다. 창업 전 반드시 현장 확인을 권장합니다.', margin, footerY + 3, {
    fontSize: 6,
    color: '#888888',
  })
  drawText('openrisk.info', pageWidth - margin - 22, footerY + 3, { fontSize: 7, fontWeight: 'bold' })

  // PDF 저장
  const safeName = filename || `OpenRisk_${data.location.district}_${data.analysis.categoryName}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(safeName)
}
