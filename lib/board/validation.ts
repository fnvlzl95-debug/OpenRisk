// 입력값 검증 및 sanitize

// HTML 태그 제거 (XSS 방지)
export function sanitizeHtml(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
