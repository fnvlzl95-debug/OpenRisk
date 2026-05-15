import fs from 'node:fs/promises'
import path from 'node:path'

import * as dotenv from 'dotenv'
import { chromium, type Locator, type Page } from 'playwright'

dotenv.config({ path: '.env.local' })

type Visibility = 'public' | 'protected' | 'private'

type FrontMatter = {
  title: string
  blogName?: string
  categoryId?: string
  visibility?: Visibility
  publish?: boolean
  tags: string[]
}

type ParsedPost = {
  meta: FrontMatter
  bodyMarkdown: string
  bodyText: string
  bodyHtml: string
}

type Options = {
  file?: string
  dir?: string
  blogName?: string
  categoryId?: string
  userDataDir: string
  newPostUrl?: string
  visibility?: Visibility
  publish: boolean
  all: boolean
  loginOnly: boolean
  help: boolean
}

function logStep(message: string): void {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

const usage = `Tistory publisher

Usage:
  npm run tistory:publish -- --file docs/marketing/tistory/01_post.md
  npm run tistory:publish -- --file docs/marketing/tistory/01_post.md --publish
  npm run tistory:publish -- --all
  npm run tistory:publish -- --login-only

Options:
  --file <path>           Markdown file with front matter
  --dir <path>            Directory containing markdown posts
  --blog-name <name>      Tistory blog name, used for https://<name>.tistory.com
  --category-id <id>      Optional category id for future UI matching
  --user-data-dir <path>  Chromium profile path (default: .tistory-session)
  --new-post-url <url>    Override the new post URL
  --visibility <value>    public | protected | private
  --all                   Publish all markdown files in --dir
  --login-only            Open editor, wait for login, then exit
  --publish               Publish instead of saving a draft
  --help                  Show this message

Env:
  TISTORY_BLOG_NAME
  TISTORY_BLOG_URL
  TISTORY_USER_DATA_DIR
  TISTORY_VISIBILITY

Notes:
  - Tistory Open API was officially announced for shutdown on 2023-12-22,
    so this script uses browser automation instead of API calls.
  - First run may require a manual Kakao login in the opened browser.
`

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dir: 'docs/marketing/tistory',
    userDataDir: process.env.TISTORY_USER_DATA_DIR || '.tistory-session',
    publish: false,
    all: false,
    loginOnly: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--file') {
      options.file = next
      index += 1
      continue
    }

    if (arg === '--blog-name') {
      options.blogName = next
      index += 1
      continue
    }

    if (arg === '--dir') {
      options.dir = next
      index += 1
      continue
    }

    if (arg === '--category-id') {
      options.categoryId = next
      index += 1
      continue
    }

    if (arg === '--user-data-dir') {
      options.userDataDir = next
      index += 1
      continue
    }

    if (arg === '--new-post-url') {
      options.newPostUrl = next
      index += 1
      continue
    }

    if (arg === '--visibility') {
      if (next !== 'public' && next !== 'protected' && next !== 'private') {
        throw new Error(`Invalid visibility: ${next}`)
      }
      options.visibility = next
      index += 1
      continue
    }

    if (arg === '--publish') {
      options.publish = true
      continue
    }

    if (arg === '--all') {
      options.all = true
      continue
    }

    if (arg === '--login-only') {
      options.loginOnly = true
      continue
    }

    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function extractBlogName(input?: string): string | undefined {
  if (!input) {
    return undefined
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return undefined
  }

  if (!trimmed.includes('://') && !trimmed.includes('.')) {
    return trimmed
  }

  try {
    const withProtocol = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    const url = new URL(withProtocol)
    const hostname = url.hostname.replace(/^www\./, '')
    const match = hostname.match(/^([a-zA-Z0-9-]+)\.tistory\.com$/)
    return match?.[1]
  } catch {
    return undefined
  }
}

function resolveNewPostUrl(blogName?: string, blogUrl?: string, overrideUrl?: string): string {
  if (overrideUrl) {
    return overrideUrl
  }

  if (blogUrl) {
    const normalized = blogUrl.endsWith('/') ? blogUrl.slice(0, -1) : blogUrl
    return `${normalized}/manage/newpost`
  }

  if (!blogName) {
    throw new Error('Missing Tistory blog target. Set TISTORY_BLOG_NAME or TISTORY_BLOG_URL.')
  }

  return `https://${blogName}.tistory.com/manage/newpost`
}

async function listMarkdownFiles(dirPath: string): Promise<string[]> {
  const absoluteDir = path.resolve(dirPath)
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(absoluteDir, entry.name))
    .sort((left, right) => left.localeCompare(right))
}

function parseFrontMatter(source: string): ParsedPost {
  const normalized = source.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    throw new Error('Post file must start with front matter block.')
  }

  const closingIndex = normalized.indexOf('\n---\n', 4)
  if (closingIndex === -1) {
    throw new Error('Front matter closing delimiter not found.')
  }

  const frontMatterBlock = normalized.slice(4, closingIndex)
  const bodyMarkdown = normalized.slice(closingIndex + 5).trim()
  const meta = parseFrontMatterBlock(frontMatterBlock)

  if (!meta.title) {
    throw new Error('Front matter must include a title.')
  }

  return {
    meta,
    bodyMarkdown,
    bodyText: markdownToPlainText(bodyMarkdown),
    bodyHtml: markdownToHtml(bodyMarkdown),
  }
}

function parseFrontMatterBlock(block: string): FrontMatter {
  const lines = block.split('\n')
  const meta: FrontMatter = {
    title: '',
    tags: [],
  }

  let currentListKey: 'tags' | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    if (!line.trim()) {
      continue
    }

    const listMatch = rawLine.match(/^\s*-\s+(.+)\s*$/)
    if (listMatch && currentListKey === 'tags') {
      meta.tags.push(listMatch[1].trim())
      continue
    }

    currentListKey = null

    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (!fieldMatch) {
      continue
    }

    const [, key, value] = fieldMatch
    const cleanValue = stripQuotes(value.trim())

    if (key === 'title') {
      meta.title = cleanValue
      continue
    }

    if (key === 'blogName') {
      meta.blogName = cleanValue || undefined
      continue
    }

    if (key === 'categoryId') {
      meta.categoryId = cleanValue || undefined
      continue
    }

    if (key === 'visibility') {
      if (cleanValue === 'public' || cleanValue === 'protected' || cleanValue === 'private') {
        meta.visibility = cleanValue
      }
      continue
    }

    if (key === 'publish') {
      meta.publish = cleanValue === 'true'
      continue
    }

    if (key === 'tags') {
      currentListKey = 'tags'
    }
  }

  return meta
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, '')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function applyInlineMarkdown(value: string): string {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/^!\[[^\]]*]\([^)]+\)\s*$/gm, '')
    .replace(/^##+\s+/gm, '')
    .replace(/^\s*-\s+/gm, '- ')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  const paragraph: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushParagraph = () => {
    if (!paragraph.length) {
      return
    }

    html.push(`<p data-ke-size="size16">${paragraph.map(applyInlineMarkdown).join('<br />')}</p>`)
    paragraph.length = 0
  }

  const closeList = () => {
    if (!listType) {
      return
    }

    html.push(`</${listType}>`)
    listType = null
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      closeList()
      continue
    }

    const headingTwo = trimmed.match(/^##\s+(.+)$/)
    if (headingTwo) {
      flushParagraph()
      closeList()
      html.push(`<h2 data-ke-size="size26">${applyInlineMarkdown(headingTwo[1])}</h2>`)
      continue
    }

    const headingThree = trimmed.match(/^###\s+(.+)$/)
    if (headingThree) {
      flushParagraph()
      closeList()
      html.push(`<h3 data-ke-size="size23">${applyInlineMarkdown(headingThree[1])}</h3>`)
      continue
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/)
    if (imageMatch) {
      flushParagraph()
      closeList()
      const [, altText, src] = imageMatch
      html.push(
        `<p data-ke-size="size16"><img src="${escapeHtml(src)}" alt="${escapeHtml(altText)}" style="max-width: 100%; height: auto;" /></p>`
      )
      continue
    }

    const unorderedItem = trimmed.match(/^-+\s+(.+)$/)
    if (unorderedItem) {
      flushParagraph()
      if (listType !== 'ul') {
        closeList()
        html.push('<ul>')
        listType = 'ul'
      }
      html.push(`<li>${applyInlineMarkdown(unorderedItem[1])}</li>`)
      continue
    }

    const orderedItem = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedItem) {
      flushParagraph()
      if (listType !== 'ol') {
        closeList()
        html.push('<ol>')
        listType = 'ol'
      }
      html.push(`<li>${applyInlineMarkdown(orderedItem[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  closeList()

  return html.join('\n')
}

async function findVisibleLocator(
  page: Page,
  selectors: string[],
  filter?: (box: { height: number; width: number } | null) => boolean
): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()

    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index)
      const visible = await candidate.isVisible().catch(() => false)
      if (!visible) {
        continue
      }

      const box = await candidate.boundingBox().catch(() => null)
      if (filter && !filter(box ? { height: box.height, width: box.width } : null)) {
        continue
      }

      return candidate
    }
  }

  return null
}

async function waitForEditor(page: Page): Promise<void> {
  const timeoutMs = 5 * 60 * 1000
  const start = Date.now()
  let loginHintShown = false

  while (Date.now() - start < timeoutMs) {
    const currentUrl = page.url()
    if (currentUrl.includes('/manage/newpost')) {
      return
    }

    if (currentUrl.includes('accounts.kakao.com') && !loginHintShown) {
      logStep('Manual login required. Complete Kakao login in the browser.')
      loginHintShown = true
    }

    await page.waitForTimeout(1000)
  }

  throw new Error('Timed out waiting for the Tistory editor page.')
}

async function closeUnexpectedDialogs(page: Page): Promise<void> {
  const dismissTexts = [/불러오지 않기/, /취소/, /닫기/, /나중에/, /계속 작성/]

  for (const text of dismissTexts) {
    const button = page.getByRole('button', { name: text }).first()
    const visible = await button.isVisible().catch(() => false)
    if (visible) {
      await button.click().catch(() => undefined)
      await page.waitForTimeout(300)
    }
  }
}

async function fillTitle(page: Page, title: string): Promise<void> {
  const titleField = await findVisibleLocator(page, [
    'input[name="title"]',
    'textarea[name="title"]',
    'input[placeholder*="제목"]',
    'textarea[placeholder*="제목"]',
    '.textarea_tit textarea',
    '.tit_post',
  ])

  if (!titleField) {
    throw new Error('Could not find the Tistory title field.')
  }

  await titleField.click()
  await page.keyboard.press('Meta+A').catch(() => undefined)

  if ((await titleField.evaluate((node) => node.tagName.toLowerCase())) === 'input') {
    await titleField.fill(title)
    return
  }

  await titleField.fill(title).catch(async () => {
    await titleField.evaluate(
      (node, nextTitle) => {
        const element = node as HTMLInputElement | HTMLTextAreaElement | HTMLElement
        if ('value' in element) {
          element.value = nextTitle
        } else {
          element.textContent = nextTitle
        }
        element.dispatchEvent(new Event('input', { bubbles: true }))
      },
      title
    )
  })
}

async function readEditorTextLength(editor: Locator): Promise<number> {
  return editor.evaluate((node) => {
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
      return node.value.trim().length
    }

    return (node.textContent || '').trim().length
  })
}

async function describeActiveElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null
    if (!active) {
      return 'none'
    }

    return JSON.stringify({
      tag: active.tagName,
      id: active.id || '',
      className: typeof active.className === 'string' ? active.className : '',
      role: active.getAttribute('role'),
      contenteditable: active.getAttribute('contenteditable'),
      placeholder: active.getAttribute('placeholder'),
      text: (active.textContent || '').trim().slice(0, 80),
    })
  })
}

async function clearEditor(page: Page, editor: Locator): Promise<void> {
  await editor.click()
  await page.keyboard.press('Meta+A').catch(() => undefined)
  await page.keyboard.press('Backspace').catch(() => undefined)
  await page.waitForTimeout(200)
}

async function markActiveEditable(page: Page): Promise<Locator | null> {
  const marked = await page.evaluate(() => {
    document.querySelectorAll('[data-openrisk-active-editor="true"]').forEach((node) => {
      node.removeAttribute('data-openrisk-active-editor')
    })

    const active = document.activeElement
    if (!(active instanceof HTMLElement)) {
      return false
    }

    const editable =
      active.isContentEditable ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && active.type !== 'hidden')

    if (!editable) {
      return false
    }

    active.setAttribute('data-openrisk-active-editor', 'true')
    return true
  })

  if (!marked) {
    return null
  }

  return page.locator('[data-openrisk-active-editor="true"]').first()
}

async function tryClipboardPaste(page: Page, bodyHtml: string, bodyText: string): Promise<boolean> {
  const pastedHtml = await page.evaluate(
    async ({ html, text }) => {
      if (!('clipboard' in navigator) || !('ClipboardItem' in window)) {
        return false
      }

      try {
        const clipboardItem = new window.ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        })

        await navigator.clipboard.write([clipboardItem])
        return true
      } catch {
        return false
      }
    },
    { html: bodyHtml, text: bodyText }
  )

  if (!pastedHtml) {
    return false
  }

  await page.keyboard.press('Meta+V').catch(() => undefined)
  await page.waitForTimeout(400)
  return true
}

async function tryExecInsert(page: Page, bodyHtml: string, bodyText: string): Promise<boolean> {
  return page.evaluate(
    ({ html, text }) => {
      const activeElement = document.activeElement as HTMLElement | null
      if (!activeElement || !activeElement.isContentEditable) {
        return false
      }

      const insertedHtml = document.execCommand?.('insertHTML', false, html)
      if (insertedHtml) {
        return true
      }

      return document.execCommand?.('insertText', false, text) ?? false
    },
    { html: bodyHtml, text: bodyText }
  )
}

async function tryKeyboardInsert(page: Page, bodyText: string): Promise<void> {
  await page.keyboard.insertText(bodyText)
  await page.waitForTimeout(400)
}

async function waitForTinyMce(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      const win = window as Window & {
        tinymce?: {
          get?: (id: string) => {
            initialized?: boolean
            getBody?: () => HTMLElement | null
          } | null
        }
      }

      const editor = win.tinymce?.get?.('editor-tistory')
      return Boolean(editor?.initialized || editor?.getBody?.())
    }, { timeout: 10000 })

    return true
  } catch {
    return false
  }
}

async function readTinyMceTextLength(page: Page): Promise<number> {
  return page.evaluate(() => {
    const win = window as Window & {
      tinymce?: {
        get?: (id: string) => {
          getContent?: (options?: { format?: string }) => string
        } | null
      }
    }

    const editor = win.tinymce?.get?.('editor-tistory')
    const text = editor?.getContent?.({ format: 'text' }) || ''
    return text.trim().length
  })
}

async function tryTinyMceInsert(page: Page, bodyHtml: string): Promise<boolean> {
  const ready = await waitForTinyMce(page)
  if (!ready) {
    return false
  }

  const inserted = await page.evaluate((html) => {
    const win = window as Window & {
      tinymce?: {
        get?: (id: string) => {
          focus?: () => void
          setContent?: (content: string) => void
          getBody?: () => HTMLElement | null
          save?: () => void
        } | null
      }
    }

    const editor = win.tinymce?.get?.('editor-tistory')
    if (!editor?.setContent) {
      return false
    }

    editor.focus?.()
    editor.setContent(html)
    editor.save?.()

    const textarea = document.getElementById('editor-tistory')
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
    }

    return true
  }, bodyHtml)

  if (!inserted) {
    return false
  }

  await page.waitForTimeout(400)
  return (await readTinyMceTextLength(page)) > 20
}

async function tryIframeBodyInsert(page: Page, bodyHtml: string): Promise<boolean> {
  const iframe = page.locator('iframe#editor-tistory_ifr').first()
  const visible = await iframe.isVisible().catch(() => false)
  if (!visible) {
    return false
  }

  const frameHandle = await iframe.elementHandle()
  const frame = await frameHandle?.contentFrame()
  if (!frame) {
    return false
  }

  const body = frame.locator('body#tinymce, body.mce-content-body, body').first()
  const bodyVisible = await body.isVisible().catch(() => false)
  if (!bodyVisible) {
    return false
  }

  await body.click().catch(() => undefined)
  await frame.evaluate((html) => {
    const target =
      (document.querySelector('body#tinymce') as HTMLElement | null) ||
      (document.querySelector('body.mce-content-body') as HTMLElement | null) ||
      document.body

    target.innerHTML = html
    target.dispatchEvent(new Event('input', { bubbles: true }))
  }, bodyHtml)

  await page.evaluate(() => {
    const win = window as Window & {
      tinymce?: {
        get?: (id: string) => {
          save?: () => void
        } | null
      }
    }

    win.tinymce?.get?.('editor-tistory')?.save?.()
  })

  await page.waitForTimeout(400)
  return (await readTinyMceTextLength(page)) > 20
}

async function focusLikelyBodyEditor(page: Page): Promise<Locator | null> {
  await page.keyboard.press('Tab').catch(() => undefined)
  await page.waitForTimeout(250)

  let activeEditor = await markActiveEditable(page)
  if (activeEditor) {
    return activeEditor
  }

  const titleField = await findVisibleLocator(page, [
    'input[name="title"]',
    'textarea[name="title"]',
    'input[placeholder*="제목"]',
    'textarea[placeholder*="제목"]',
    '.textarea_tit textarea',
    '.tit_post',
  ])

  const titleBox = titleField ? await titleField.boundingBox().catch(() => null) : null
  if (titleBox) {
    await page.mouse.click(titleBox.x + Math.min(200, Math.max(40, titleBox.width / 2)), titleBox.y + titleBox.height + 140)
    await page.waitForTimeout(250)
    activeEditor = await markActiveEditable(page)
    if (activeEditor) {
      return activeEditor
    }
  }

  const viewport = page.viewportSize() || { width: 1440, height: 960 }
  await page.mouse.click(Math.round(viewport.width / 2), 360)
  await page.waitForTimeout(250)
  return markActiveEditable(page)
}

async function saveDebugArtifacts(page: Page, reason: string): Promise<void> {
  const debugDir = path.resolve('.tistory-debug')
  await fs.mkdir(debugDir, { recursive: true })

  const timestamp = new Date().toISOString().replaceAll(':', '-')
  const htmlPath = path.join(debugDir, `${timestamp}_${reason}.html`)
  const screenshotPath = path.join(debugDir, `${timestamp}_${reason}.png`)

  await fs.writeFile(htmlPath, await page.content(), 'utf8')
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)

  logStep(`Debug HTML saved: ${htmlPath}`)
  logStep(`Debug screenshot saved: ${screenshotPath}`)
  logStep(`Active element: ${await describeActiveElement(page)}`)
}

async function fillBody(page: Page, bodyHtml: string, bodyText: string): Promise<void> {
  if (await tryTinyMceInsert(page, bodyHtml)) {
    return
  }

  if (await tryIframeBodyInsert(page, bodyHtml)) {
    return
  }

  let editor = await findVisibleLocator(
    page,
    [
      '.ProseMirror[contenteditable="true"]',
      '.tt-editor [contenteditable="true"]',
      '.editor_content [contenteditable="true"]',
      '.contents_style [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"]',
      '.CodeMirror textarea',
      'textarea',
    ],
    (box) => Boolean(box && box.height > 40 && box.width > 200)
  )

  if (!editor) {
    editor = await focusLikelyBodyEditor(page)
  }

  if (!editor) {
    await saveDebugArtifacts(page, 'body_selector_missing')
    throw new Error('Could not find the Tistory editor body area.')
  }

  await clearEditor(page, editor)

  if (await tryClipboardPaste(page, bodyHtml, bodyText)) {
    if ((await readEditorTextLength(editor)) > 20) {
      return
    }
  }

  await editor.click()
  if (await tryExecInsert(page, bodyHtml, bodyText)) {
    if ((await readEditorTextLength(editor)) > 20) {
      return
    }
  }

  await clearEditor(page, editor)
  await tryKeyboardInsert(page, bodyText)

  if ((await readEditorTextLength(editor)) > 20) {
    return
  }

  await saveDebugArtifacts(page, 'body_insert_failed')
  throw new Error('Tistory editor body insert failed after all fallback attempts.')
}

async function fillTags(page: Page, tags: string[]): Promise<void> {
  if (!tags.length) {
    return
  }

  const tagInput = await findVisibleLocator(page, [
    'input[placeholder*="태그"]',
    'input[placeholder*="tag"]',
    '.tag_input input',
  ])

  if (!tagInput) {
    logStep('Tag input was not found. Skipping tags.')
    return
  }

  await tagInput.click()
  await tagInput.fill(tags.join(', '))
  await page.keyboard.press('Enter').catch(() => undefined)
}

async function clickFirstVisibleButton(page: Page, names: RegExp[]): Promise<boolean> {
  for (const name of names) {
    const button = page.getByRole('button', { name }).first()
    const visible = await button.isVisible().catch(() => false)
    if (!visible) {
      continue
    }

    await button.click()
    return true
  }

  return false
}

async function saveDraft(page: Page): Promise<void> {
  const saved = await clickFirstVisibleButton(page, [/임시저장/, /저장/])
  if (!saved) {
    throw new Error('Draft button not found.')
  }

  logStep('Draft save requested.')
  await verifyDraftSaved(page)
}

async function openFreshEditor(page: Page, newPostUrl: string): Promise<void> {
  await page.goto(newPostUrl, { waitUntil: 'domcontentloaded' })
  await waitForEditor(page)
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await closeUnexpectedDialogs(page)
}

async function applyVisibility(page: Page, visibility: Visibility): Promise<void> {
  const labelByVisibility: Record<Visibility, RegExp> = {
    public: /공개/,
    protected: /보호/,
    private: /비공개/,
  }

  const target = page.getByText(labelByVisibility[visibility]).first()
  const visible = await target.isVisible().catch(() => false)
  if (!visible) {
    return
  }

  await target.click().catch(() => undefined)
}

async function waitForVisibleToast(page: Page, pattern: RegExp, timeoutMs = 10000): Promise<string | null> {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const candidates = await page.locator('#toast-container *, .toast *, [role="alert"], .ReactModalPortal *').allTextContents().catch(() => [])
    const normalized = candidates
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter(Boolean)

    const matched = normalized.find((text) => pattern.test(text))
    if (matched) {
      return matched
    }

    await page.waitForTimeout(250)
  }

  return null
}

async function verifyDraftSaved(page: Page): Promise<void> {
  const toast = await waitForVisibleToast(page, /(임시저장|저장).*(완료|되었습니다|했어요|되었어요)|완료.*(임시저장|저장)/, 12000)
  if (toast) {
    logStep(`Draft verified by toast: ${toast}`)
    return
  }

  const draftCount = await page.locator('.btn-draft .count').textContent().catch(() => null)
  if (draftCount && /\d+/.test(draftCount)) {
    logStep(`Draft status observed: count=${draftCount.trim()}`)
    return
  }

  await saveDebugArtifacts(page, 'draft_verify_failed')
  throw new Error('Draft save could not be verified.')
}

async function verifyPublished(page: Page, expectedTitle: string): Promise<void> {
  const started = Date.now()

  while (Date.now() - started < 15000) {
    const currentUrl = page.url()
    const currentTitle = await page.title().catch(() => '')
    const pageText = await page.locator('body').innerText().catch(() => '')

    if (!currentUrl.includes('/manage/newpost') && pageText.includes(expectedTitle)) {
      logStep(`Publish verified by navigation: ${currentUrl}`)
      return
    }

    if (currentTitle.includes(expectedTitle) && !currentUrl.includes('/manage/newpost')) {
      logStep(`Publish verified by title: ${currentUrl}`)
      return
    }

    const toast = await waitForVisibleToast(page, /(발행|공개).*(완료|되었습니다|했어요|되었어요)|완료.*(발행|공개)/, 500)
    if (toast) {
      logStep(`Publish toast observed: ${toast}`)
      return
    }

    await page.waitForTimeout(500)
  }

  await saveDebugArtifacts(page, 'publish_verify_failed')
  throw new Error('Publish completed click flow, but final published state could not be verified.')
}

async function publishPost(page: Page, visibility: Visibility, expectedTitle: string): Promise<void> {
  const openedPublishDialog = await clickFirstVisibleButton(page, [/완료/, /발행/, /공개/])
  if (!openedPublishDialog) {
    throw new Error('Could not find the initial publish button.')
  }

  await page.waitForTimeout(500)
  await applyVisibility(page, visibility)
  await page.waitForTimeout(300)

  const confirmed = await clickFirstVisibleButton(page, [/발행/, /공개/, /완료/])
  if (!confirmed) {
    throw new Error('Could not find the final publish confirmation button.')
  }

  logStep(`Publish requested with visibility=${visibility}.`)
  await verifyPublished(page, expectedTitle)
}

async function processSinglePost(page: Page, postPath: string, options: {
  newPostUrl: string
  visibility: Visibility
  shouldPublish: boolean
}): Promise<void> {
  const source = await fs.readFile(postPath, 'utf8')
  const post = parseFrontMatter(source)

  logStep(`Opening Tistory editor for: ${post.meta.title}`)
  logStep(`Source file: ${postPath}`)
  logStep(`Mode: ${options.shouldPublish ? 'publish' : 'draft'}`)

  await openFreshEditor(page, options.newPostUrl)
  await fillTitle(page, post.meta.title)
  await fillBody(page, post.bodyHtml, post.bodyText)
  await fillTags(page, post.meta.tags)

  if (options.shouldPublish || post.meta.publish === true) {
    const visibility = post.meta.visibility || options.visibility
    await publishPost(page, visibility, post.meta.title)
  } else {
    await saveDraft(page)
  }

  await page.waitForTimeout(1500)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    console.log(usage)
    return
  }

  if (!options.loginOnly && !options.file && !options.all) {
    throw new Error('Missing post target. Use --file, --all, or --login-only.')
  }

  let firstPost: ParsedPost | null = null
  if (options.file) {
    const source = await fs.readFile(path.resolve(options.file), 'utf8')
    firstPost = parseFrontMatter(source)
  }

  const envBlogUrl = process.env.TISTORY_BLOG_URL
  const normalizedBlogName =
    extractBlogName(options.blogName) ||
    extractBlogName(firstPost?.meta.blogName) ||
    extractBlogName(process.env.TISTORY_BLOG_NAME) ||
    extractBlogName(envBlogUrl)
  const normalizedBlogUrl = envBlogUrl?.trim() || (normalizedBlogName ? `https://${normalizedBlogName}.tistory.com` : undefined)

  if (!normalizedBlogName && !normalizedBlogUrl && !options.newPostUrl) {
    throw new Error('Missing Tistory blog target. Set --blog-name, TISTORY_BLOG_NAME, or TISTORY_BLOG_URL.')
  }

  const visibility = options.visibility || firstPost?.meta.visibility || (process.env.TISTORY_VISIBILITY as Visibility) || 'public'
  const shouldPublish = options.publish || firstPost?.meta.publish === true
  const newPostUrl = resolveNewPostUrl(normalizedBlogName, normalizedBlogUrl, options.newPostUrl)
  const targetFiles = options.all
    ? await listMarkdownFiles(options.dir || 'docs/marketing/tistory')
    : options.file
      ? [path.resolve(options.file)]
      : []

  if (options.all && targetFiles.length === 0) {
    throw new Error(`No markdown files found in: ${path.resolve(options.dir || 'docs/marketing/tistory')}`)
  }

  if (options.loginOnly) {
    logStep('Mode: login-only')
  } else if (options.all) {
    logStep(`Mode: ${shouldPublish ? 'publish-all' : 'draft-all'}`)
    logStep(`Target directory: ${path.resolve(options.dir || 'docs/marketing/tistory')}`)
    logStep(`Target files: ${targetFiles.length}`)
  }

  const context = await chromium.launchPersistentContext(path.resolve(options.userDataDir), {
    headless: false,
    viewport: { width: 1440, height: 960 },
  })

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  const page = context.pages()[0] || (await context.newPage())

  if (options.loginOnly) {
    await openFreshEditor(page, newPostUrl)
    logStep('Login session is ready. Closing browser context.')
    await context.close()
    return
  }

  for (const targetFile of targetFiles) {
    await processSinglePost(page, targetFile, {
      newPostUrl,
      visibility,
      shouldPublish,
    })
  }

  logStep('Done. Review the opened browser if you want to confirm the result.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
