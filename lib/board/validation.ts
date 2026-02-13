// 입력값 검증 및 sanitize

// HTML Sanitization (XSS 방지)
// 마크다운 문법은 유지하고 HTML 태그만 이스케이프
export function sanitizeHtml(text: string): string {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u0000-\u001F\u007F]/g, '')

  // HTML 특수문자 이스케이프
  return normalized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 게시글 검증
export function validatePost(title: string, content: string): { valid: boolean; error?: string } {
  if (typeof title !== 'string' || typeof content !== 'string') {
    return { valid: false, error: '잘못된 요청입니다.' }
  }

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
  if (typeof content !== 'string') {
    return { valid: false, error: '잘못된 요청입니다.' }
  }

  const sanitizedContent = content.trim()

  if (!sanitizedContent) {
    return { valid: false, error: '댓글 내용을 입력해주세요.' }
  }

  if (sanitizedContent.length > 500) {
    return { valid: false, error: '댓글은 500자 이내로 입력해주세요.' }
  }

  return { valid: true }
}
