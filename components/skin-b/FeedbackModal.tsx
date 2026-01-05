'use client'

import { useState } from 'react'
import { X, Star, Loader2, Check } from 'lucide-react'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  address?: string
  category?: string
  riskScore?: number
}

export default function FeedbackModal({
  isOpen,
  onClose,
  address,
  category,
  riskScore
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('별점을 선택해주세요')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment,
          address,
          category,
          riskScore,
        }),
      })

      if (!res.ok) {
        throw new Error('피드백 저장 실패')
      }

      setIsSubmitted(true)
      setTimeout(() => {
        onClose()
        // 상태 초기화
        setRating(0)
        setComment('')
        setIsSubmitted(false)
      }, 1500)
    } catch {
      setError('피드백 저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm">
        <div className="bg-white border-2 border-black">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-sm font-bold">피드백</span>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {isSubmitted ? (
              <div className="flex flex-col items-center py-6">
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-3">
                  <Check className="text-white" size={24} />
                </div>
                <p className="text-sm font-medium">감사합니다!</p>
                <p className="text-xs text-gray-500">피드백이 저장되었습니다</p>
              </div>
            ) : (
              <>
                {/* 별점 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">분석 결과가 도움이 되셨나요?</p>
                  <div className="flex gap-1 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          size={28}
                          className={`transition-colors ${
                            star <= (hoverRating || rating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 코멘트 */}
                <div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="한줄 의견을 남겨주세요 (선택)"
                    maxLength={200}
                    className="w-full p-3 border border-gray-200 text-sm resize-none focus:outline-none focus:border-black transition-colors"
                    rows={2}
                  />
                  <p className="text-[10px] text-gray-400 text-right">{comment.length}/200</p>
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <p className="text-xs text-red-500 text-center">{error}</p>
                )}

                {/* 제출 버튼 */}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-black text-white text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '피드백 보내기'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
