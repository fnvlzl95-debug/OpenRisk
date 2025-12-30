'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children?: React.ReactNode
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, arrowLeft: 0 })
  const [isAbove, setIsAbove] = useState(true)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)

  // 스크롤 시 툴팁 닫기
  const handleScroll = useCallback(() => {
    if (isVisible) {
      setIsVisible(false)
    }
  }, [isVisible])

  useEffect(() => {
    setMounted(true)
  }, [])

  // 스크롤 이벤트 리스너
  useEffect(() => {
    if (isVisible) {
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isVisible, handleScroll])

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipWidth = 240
      const tooltipHeight = 70

      let top = rect.top - tooltipHeight - 10
      let showAbove = true

      if (top < 10) {
        top = rect.bottom + 10
        showAbove = false
      }

      let left = rect.left + rect.width / 2 - tooltipWidth / 2
      let arrowLeft = tooltipWidth / 2

      if (left < 10) {
        arrowLeft = rect.left + rect.width / 2 - 10
        left = 10
      }

      if (left + tooltipWidth > window.innerWidth - 10) {
        const overflow = (left + tooltipWidth) - (window.innerWidth - 10)
        arrowLeft = tooltipWidth / 2 + overflow
        left = window.innerWidth - tooltipWidth - 10
      }

      setPosition({ top, left, arrowLeft })
      setIsAbove(showAbove)
    }
  }, [isVisible])

  const borderColor = 'rgba(255, 255, 255, 0.15)'
  const bgColor = '#1f1f24'

  const tooltipBoxStyle: React.CSSProperties = {
    position: 'relative',
    padding: '10px 14px',
    background: bgColor,
    border: `1px solid ${borderColor}`,
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    fontSize: '0.8125rem',
    fontWeight: 400,
    lineHeight: 1.5,
    color: '#d4d4d8',
    maxWidth: '240px',
    minWidth: '160px',
    pointerEvents: 'none' as const,
  }

  // 화살표 (테두리 포함을 위해 두 개의 삼각형 사용)
  const arrowOuterStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeft: '8px solid transparent',
    borderRight: '8px solid transparent',
    left: position.arrowLeft,
    transform: 'translateX(-50%)',
  }

  const arrowInnerStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeft: '7px solid transparent',
    borderRight: '7px solid transparent',
    left: position.arrowLeft,
    transform: 'translateX(-50%)',
  }

  // 위쪽에 툴팁이 있을 때 (화살표가 아래를 향함)
  const arrowOuterDownStyle: React.CSSProperties = {
    ...arrowOuterStyle,
    bottom: '-9px',
    borderTop: `9px solid ${borderColor}`,
  }

  const arrowInnerDownStyle: React.CSSProperties = {
    ...arrowInnerStyle,
    bottom: '-7px',
    borderTop: `7px solid ${bgColor}`,
  }

  // 아래쪽에 툴팁이 있을 때 (화살표가 위를 향함)
  const arrowOuterUpStyle: React.CSSProperties = {
    ...arrowOuterStyle,
    top: '-9px',
    borderBottom: `9px solid ${borderColor}`,
  }

  const arrowInnerUpStyle: React.CSSProperties = {
    ...arrowInnerStyle,
    top: '-7px',
    borderBottom: `7px solid ${bgColor}`,
  }

  const tooltipContent = isVisible && mounted && (
    <div
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
    >
      <div style={tooltipBoxStyle} role="tooltip">
        {content}
        {/* 테두리용 바깥 화살표 */}
        <span style={isAbove ? arrowOuterDownStyle : arrowOuterUpStyle} />
        {/* 배경색 안쪽 화살표 */}
        <span style={isAbove ? arrowInnerDownStyle : arrowInnerUpStyle} />
      </div>
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex items-center"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onTouchStart={() => setIsVisible(true)}
      >
        {children || (
          <button
            type="button"
            className="tooltip-trigger"
            aria-label="도움말"
          >
            ?
          </button>
        )}
      </div>
      {mounted && createPortal(tooltipContent, document.body)}
    </>
  )
}
