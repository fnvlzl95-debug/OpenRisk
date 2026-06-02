import { generateIncheonPdfHtml } from './pdf-template'
import type { IncheonAnalyzeResponse } from './types'

/**
 * 인천 분석 결과를 11개 섹션 PDF로 저장한다.
 * v2와 동일한 html2canvas-pro → PNG → jsPDF 패턴(한글 폰트 자동).
 * 내용이 길어 단일 캡처를 A4 높이로 분할해 여러 페이지로 출력한다.
 */
export async function generateIncheonPdfClient(data: IncheonAnalyzeResponse): Promise<void> {
  const [html2canvasModule, jsPDFModule] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const html2canvas = html2canvasModule.default
  const jsPDF = jsPDFModule.default

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '794px'
  iframe.style.height = '1123px'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    throw new Error('iframe 생성 실패')
  }

  iframeDoc.open()
  iframeDoc.write(generateIncheonPdfHtml(data))
  iframeDoc.close()

  await new Promise((resolve) => setTimeout(resolve, 350))

  try {
    const pageEl = (iframeDoc.querySelector('.page') as HTMLElement) ?? iframeDoc.body
    const canvas = await html2canvas(pageEl, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pageWidthMm = 210
    const pageHeightMm = 297
    const pxPerMm = canvas.width / pageWidthMm
    const pageHeightPx = Math.floor(pageHeightMm * pxPerMm)
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightPx))

    for (let page = 0; page < totalPages; page += 1) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - page * pageHeightPx)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = sliceHeightPx
      const ctx = slice.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, page * pageHeightPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)
      const imgData = slice.toDataURL('image/png')
      const sliceHeightMm = sliceHeightPx / pxPerMm
      if (page > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, sliceHeightMm, undefined, 'FAST')
    }

    const safeLabel = (data.location.label || '인천').replace(/[^\w가-힣]+/g, '_').slice(0, 30)
    pdf.save(`OpenRisk_Incheon_${safeLabel}_${data.category.name}.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}
