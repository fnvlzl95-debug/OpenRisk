import { NextRequest, NextResponse } from 'next/server'
import { generatePdfHtml } from '@/lib/v2/pdf-template'
import { AnalyzeV2Response } from '@/lib/v2/types'
import puppeteer from 'puppeteer'

export async function POST(request: NextRequest) {
  try {
    const data: AnalyzeV2Response = await request.json()

    // HTML 생성
    const html = generatePdfHtml(data)

    // Puppeteer로 직접 PDF 생성
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    await browser.close()

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="OpenRisk_Report_${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'PDF 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
