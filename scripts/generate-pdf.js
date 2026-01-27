#!/usr/bin/env node
/**
 * PDF 생성 스크립트
 * stdin으로 HTML을 받아 stdout으로 PDF 바이너리 출력
 */
const puppeteer = require('puppeteer')

async function main() {
  // stdin에서 HTML 읽기
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  const html = Buffer.concat(chunks).toString('utf-8')

  if (!html) {
    process.stderr.write('No HTML input received\n')
    process.exit(1)
  }

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

  // stdout으로 PDF 바이너리 출력
  process.stdout.write(Buffer.from(pdf))
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`)
  process.exit(1)
})
