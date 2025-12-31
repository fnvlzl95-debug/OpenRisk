'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const SKINS = [
  {
    id: 'a',
    name: 'Glassmorphic',
    description: '글래스모피즘, 그라디언트 효과',
    preview: '/preview-b.png',
    gradient: 'from-blue-900 to-purple-900',
    accent: '#60a5fa',
    disabled: false
  },
  {
    id: 'b',
    name: 'TBD',
    description: '준비 중입니다',
    preview: '/preview-a.png',
    gradient: 'from-zinc-800 to-zinc-900',
    accent: '#666666',
    disabled: true
  }
]

export default function SelectPage() {
  const router = useRouter()
  const [hoveredSkin, setHoveredSkin] = useState<string | null>(null)

  const selectSkin = (skin: typeof SKINS[0]) => {
    if (skin.disabled) return
    localStorage.setItem('openrisk-skin', skin.id)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-3 h-3 bg-white rounded-full" />
          <span className="text-xl font-bold tracking-tighter">OpenRisk</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          디자인 선택
        </h1>
        <p className="text-white/40 text-lg">
          테스트 중인 UI 스킨을 선택하세요
        </p>
        <div className="mt-2 inline-block px-3 py-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-mono">
          BETA TEST MODE
        </div>
      </div>

      {/* Skin Cards */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full relative z-10">
        {SKINS.map((skin) => (
          <button
            key={skin.id}
            onClick={() => selectSkin(skin)}
            onMouseEnter={() => !skin.disabled && setHoveredSkin(skin.id)}
            onMouseLeave={() => setHoveredSkin(null)}
            disabled={skin.disabled}
            className={`
              group relative p-1 rounded-3xl transition-all duration-500
              ${hoveredSkin === skin.id ? 'scale-[1.02]' : 'scale-100'}
              ${skin.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Glow Effect */}
            <div
              className={`
                absolute -inset-1 rounded-3xl bg-gradient-to-r ${skin.gradient}
                opacity-0 group-hover:opacity-50 transition-opacity duration-500 blur-xl
              `}
            />

            {/* Card Content */}
            <div className="relative bg-[#111] border border-white/10 rounded-3xl p-6 h-full overflow-hidden">
              {/* Preview Area */}
              <div
                className={`
                  h-48 rounded-2xl mb-6 flex items-center justify-center
                  bg-gradient-to-br ${skin.gradient} relative overflow-hidden
                `}
              >
                {/* Mock UI Preview */}
                <div className="absolute inset-4 bg-black/40 rounded-xl backdrop-blur-sm border border-white/10 p-4">
                  {skin.id === 'a' ? (
                    // Skin A Preview
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg" style={{ background: skin.accent }} />
                        <div className="h-3 w-20 bg-white/20 rounded" />
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded" />
                      <div className="h-2 w-3/4 bg-white/10 rounded" />
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="h-12 bg-white/5 rounded-lg border border-white/10" />
                        <div className="h-12 bg-white/5 rounded-lg border border-white/10" />
                      </div>
                    </div>
                  ) : (
                    // Skin B Preview
                    <div className="space-y-2">
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold" style={{ color: skin.accent }}>A</div>
                      </div>
                      <div className="h-2 w-full bg-white/20 rounded-full" />
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <div className="h-8 bg-emerald-500/20 rounded-lg border border-emerald-500/30" />
                        <div className="h-8 bg-rose-500/20 rounded-lg border border-rose-500/30" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="text-left">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold">{skin.name}</h3>
                  {skin.disabled ? (
                    <span className="text-xs font-mono px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      COMING SOON
                    </span>
                  ) : (
                    <span className="text-xs font-mono px-2 py-1 rounded-full bg-white/10 text-white/60">
                      SKIN {skin.id.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-white/50 text-sm">{skin.description}</p>
              </div>

              {/* Hover Arrow */}
              {!skin.disabled && (
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-white/30 text-sm font-mono relative z-10">
        <p>선택한 스킨은 로컬에 저장됩니다</p>
      </div>
    </div>
  )
}
