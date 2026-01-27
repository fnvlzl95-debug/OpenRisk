import { generatePdfHtml } from './pdf-template'
import { AnalyzeV2Response } from './types'

export async function generatePdfClient(data: AnalyzeV2Response): Promise<void> {
  const [html2canvasModule, jsPDFModule] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])
  const html2canvas = html2canvasModule.default
  const jsPDF = jsPDFModule.default

  // 숨겨진 컨테이너에 HTML 렌더링
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '794px'
  container.style.zIndex = '-1'
  document.body.appendChild(container)

  const html = generatePdfHtml(data)
  container.innerHTML = html

  try {
    const canvas = await html2canvas(container.querySelector('.page') as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 794,
      height: 1123,
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pdfWidth = 210
    const pdfHeight = 297
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)

    const filename = `OpenRisk_Report_${data.location.district}_${data.analysis.categoryName}.pdf`
    pdf.save(filename)
  } finally {
    document.body.removeChild(container)
  }
}
