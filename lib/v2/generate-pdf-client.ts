import { generatePdfHtml } from './pdf-template'
import { AnalyzeV2Response } from './types'

export async function generatePdfClient(data: AnalyzeV2Response): Promise<void> {
  const [html2canvasModule, jsPDFModule] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])
  const html2canvas = html2canvasModule.default
  const jsPDF = jsPDFModule.default

  // iframe으로 격리된 환경에서 렌더링 (메인 페이지 스타일 간섭 방지)
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

  const html = generatePdfHtml(data)
  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  // 렌더링 완료 대기
  await new Promise(resolve => setTimeout(resolve, 300))

  try {
    const pageEl = iframeDoc.querySelector('.page') as HTMLElement
    if (!pageEl) throw new Error('.page 요소를 찾을 수 없습니다')

    // 캡처용으로 overflow 해제 & 정확한 A4 크기 강제
    pageEl.style.overflow = 'visible'
    pageEl.style.height = '1123px'
    pageEl.style.width = '794px'

    const canvas = await html2canvas(pageEl, {
      scale: 4,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST')

    const filename = `OpenRisk_Report_${data.location.district}_${data.analysis.categoryName}.pdf`
    pdf.save(filename)
  } finally {
    document.body.removeChild(iframe)
  }
}
