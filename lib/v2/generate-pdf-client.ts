import { generatePdfHtml } from './pdf-template'
import { AnalyzeV2Response } from './types'

export async function generatePdfClient(data: AnalyzeV2Response): Promise<void> {
  const html = generatePdfHtml(data)

  // iframe을 사용하여 브라우저 인쇄 기능으로 PDF 저장
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = '794px'
  iframe.style.height = '1123px'
  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!iframeDoc) {
    document.body.removeChild(iframe)
    throw new Error('iframe 생성 실패')
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  // 렌더링 완료 대기
  await new Promise(resolve => setTimeout(resolve, 500))

  iframe.contentWindow?.print()

  // 인쇄 다이얼로그 닫힌 후 정리
  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}
