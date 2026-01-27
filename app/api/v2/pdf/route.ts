import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { generatePdfHtml } from '@/lib/v2/pdf-template'
import { AnalyzeV2Response } from '@/lib/v2/types'

export async function POST(request: NextRequest) {
  try {
    const data: AnalyzeV2Response = await request.json()

    // HTML 생성
    const html = generatePdfHtml(data)

    // 외부 스크립트로 PDF 생성
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-pdf.js')

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const chunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk))

      child.on('close', (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString()
          reject(new Error(stderr || `Process exited with code ${code}`))
          return
        }
        resolve(Buffer.concat(chunks))
      })

      child.on('error', reject)

      // HTML을 stdin으로 전달
      child.stdin.write(html)
      child.stdin.end()
    })

    return new NextResponse(pdfBuffer, {
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
