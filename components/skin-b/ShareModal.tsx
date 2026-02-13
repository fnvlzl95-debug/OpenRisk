'use client'

import { useState, useEffect } from 'react'
import { X, Link2, Check, MessageCircle, Loader2 } from 'lucide-react'

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || ''

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  text: string
  url: string
}

export default function ShareModal({ isOpen, onClose, title, text, url }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [kakaoReady, setKakaoReady] = useState(false)

  // 카카오 SDK 로드 확인
  useEffect(() => {
    if (!isOpen) return

    const checkKakao = () => {
      if (typeof window !== 'undefined' && window.Kakao) {
        if (!KAKAO_JS_KEY) {
          return
        }
        if (!window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_JS_KEY)
        }
        setKakaoReady(true)
      }
    }

    // 즉시 확인
    checkKakao()

    // 아직 로드 안됐으면 100ms마다 체크 (최대 3초)
    if (!kakaoReady) {
      const interval = setInterval(checkKakao, 100)
      const timeout = setTimeout(() => clearInterval(interval), 3000)
      return () => {
        clearInterval(interval)
        clearTimeout(timeout)
      }
    }
  }, [isOpen, kakaoReady])

  if (!isOpen) return null

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 복사 실패
    }
  }

  const handleKakaoShare = () => {
    if (kakaoReady && window.Kakao) {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description: text,
          imageUrl: 'https://openrisk.info/MetaImg.png',
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
        buttons: [
          {
            title: '분석 결과 보기',
            link: {
              mobileWebUrl: url,
              webUrl: url,
            },
          },
        ],
      })
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
            <span className="text-sm font-bold">공유하기</span>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* 카카오톡 공유 */}
            <button
              onClick={handleKakaoShare}
              disabled={!kakaoReady}
              className={`w-full flex items-center gap-3 p-3 border transition-colors ${
                kakaoReady
                  ? 'border-gray-200 hover:border-black hover:bg-gray-50'
                  : 'border-gray-100 bg-gray-50 cursor-wait'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kakaoReady ? 'bg-[#FEE500]' : 'bg-gray-200'}`}>
                {kakaoReady ? (
                  <MessageCircle size={20} className="text-[#3C1E1E]" />
                ) : (
                  <Loader2 size={20} className="text-gray-400 animate-spin" />
                )}
              </div>
              <div className="text-left">
                <div className={`text-sm font-medium ${kakaoReady ? '' : 'text-gray-400'}`}>카카오톡</div>
                <div className="text-[10px] text-gray-400">
                  {kakaoReady ? '친구에게 공유' : '로딩 중...'}
                </div>
              </div>
            </button>

            {/* 링크 복사 */}
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 p-3 border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${copied ? 'bg-black' : 'bg-gray-100'}`}>
                {copied ? (
                  <Check size={20} className="text-white" />
                ) : (
                  <Link2 size={20} className="text-gray-600" />
                )}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">{copied ? '복사됨!' : '링크 복사'}</div>
                <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{url}</div>
              </div>
            </button>

          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">
              분석 결과를 공유해보세요
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
