/**
 * 유틸리티 함수 모음
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind CSS 클래스 병합 유틸리티
 * clsx + tailwind-merge 조합
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 숫자 포맷팅 (한국식)
 */
export function formatNumber(n: number): string {
  if (n >= 100000000) {
    return (n / 100000000).toFixed(1) + '억'
  }
  if (n >= 10000) {
    return (n / 10000).toFixed(1) + '만'
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + '천'
  }
  return n.toLocaleString()
}

/**
 * 거리 포맷팅
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return (meters / 1000).toFixed(1) + 'km'
  }
  return meters + 'm'
}

/**
 * 퍼센트 포맷팅
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + '%'
}
