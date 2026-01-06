// 조회수 중복 방지 (localStorage 기반)

const STORAGE_KEY = 'openrisk_viewed_posts'
const EXPIRE_HOURS = 24

interface ViewedPost {
  id: number
  timestamp: number
}

export function hasViewedPost(postId: number): boolean {
  if (typeof window === 'undefined') return false

  try {
    const viewed: ViewedPost[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const now = Date.now()
    const expireTime = EXPIRE_HOURS * 60 * 60 * 1000

    // 만료된 항목 제거
    const validViewed = viewed.filter(v => now - v.timestamp < expireTime)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validViewed))

    return validViewed.some(v => v.id === postId)
  } catch {
    return false
  }
}

export function markPostAsViewed(postId: number): void {
  if (typeof window === 'undefined') return

  try {
    const viewed: ViewedPost[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')

    if (!viewed.some(v => v.id === postId)) {
      viewed.push({ id: postId, timestamp: Date.now() })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(viewed))
    }
  } catch {
    // 무시
  }
}
