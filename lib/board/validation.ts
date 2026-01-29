// 입력값 검증 및 sanitize
import DOMPurify from 'isomorphic-dompurify'

// HTML Sanitization (XSS 방지)
// DOMPurify를 사용해 안전한 HTML만 허용
export function sanitizeHtml(text: string): string {
  // 스마트 따옴표를 일반 따옴표로 변환
  const normalized = text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")

  // 안전한 HTML 태그만 허용
  return DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'div', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  })
}

// 게시글 검증
export function validatePost(title: string, content: string): { valid: boolean; error?: string } {
  const sanitizedTitle = title.trim()
  const sanitizedContent = content.trim()

  if (!sanitizedTitle) {
    return { valid: false, error: '제목을 입력해주세요.' }
  }

  if (sanitizedTitle.length > 100) {
    return { valid: false, error: '제목은 100자 이내로 입력해주세요.' }
  }

  if (!sanitizedContent) {
    return { valid: false, error: '내용을 입력해주세요.' }
  }

  if (sanitizedContent.length > 5000) {
    return { valid: false, error: '내용은 5000자 이내로 입력해주세요.' }
  }

  return { valid: true }
}

// 댓글 검증
export function validateComment(content: string): { valid: boolean; error?: string } {
  const sanitizedContent = content.trim()

  if (!sanitizedContent) {
    return { valid: false, error: '댓글 내용을 입력해주세요.' }
  }

  if (sanitizedContent.length > 500) {
    return { valid: false, error: '댓글은 500자 이내로 입력해주세요.' }
  }

  return { valid: true }
}
