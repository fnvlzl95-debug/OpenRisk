'use client'

import { useState } from 'react'
import { CATEGORY_LIST, CATEGORY_GROUPS, type BusinessCategory } from '@/lib/categories'

interface CategorySelectorProps {
  value: BusinessCategory | null
  onChange: (category: BusinessCategory) => void
  isFocused?: boolean
}

export default function CategorySelector({ value, onChange, isFocused = false }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const selectedCategory = value ? CATEGORY_LIST.find(c => c.key === value) : null

  const getGroupCategories = (group: string) => {
    return CATEGORY_LIST.filter(c => c.group === group)
  }

  const handleSelect = (category: BusinessCategory) => {
    onChange(category)
    setIsOpen(false)
    setActiveGroup(null)
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3
          bg-[#1a1a1a] border rounded-lg sm:rounded-xl
          transition-all duration-300 min-w-[120px] sm:min-w-[140px]
          ${value ? 'border-blue-500/50 text-white' : 'border-white/10 text-white/40'}
          hover:border-white/30 hover:bg-[#222]
          ${isFocused ? 'scale-105' : ''}
        `}
      >
        <div className={`w-2 h-2 rounded-full ${value ? 'bg-blue-500' : 'bg-white/20'}`} />
        <span className="text-sm sm:text-base font-medium truncate">
          {selectedCategory?.name || '업종 선택'}
        </span>
        <svg
          className={`w-4 h-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setIsOpen(false); setActiveGroup(null); }}
          />

          {/* Menu - 위로 열림 */}
          <div className="absolute bottom-full left-0 mb-2 z-50 bg-[#111]/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[280px] sm:min-w-[320px]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-xs font-mono text-white/30 flex justify-between items-center">
                <span>업종 선택</span>
                <span className="text-[10px]">필수</span>
              </div>
            </div>

            {/* Category Groups */}
            <div className="max-h-[300px] sm:max-h-[350px] overflow-y-auto">
              {CATEGORY_GROUPS.map((group) => (
                <div key={group} className="border-b border-white/5 last:border-b-0">
                  {/* Group Header */}
                  <button
                    type="button"
                    onClick={() => setActiveGroup(activeGroup === group ? null : group)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                  >
                    <span className="text-sm font-medium text-white/70">{group}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/30">
                        {getGroupCategories(group).length}
                      </span>
                      <svg
                        className={`w-4 h-4 text-white/40 transition-transform ${
                          activeGroup === group ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Category Items */}
                  {activeGroup === group && (
                    <div className="pb-2">
                      {getGroupCategories(group).map((cat) => (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => handleSelect(cat.key)}
                          className={`
                            w-full px-6 py-2.5 text-left text-sm transition-all
                            flex items-center gap-3
                            ${value === cat.key
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'text-white/60 hover:bg-white/5 hover:text-white'
                            }
                          `}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            value === cat.key ? 'bg-blue-500' : 'bg-white/20'
                          }`} />
                          {cat.name}
                          {value === cat.key && (
                            <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-white/5 bg-white/5">
              <p className="text-[10px] text-white/30 text-center">
                선택한 업종에 맞춰 리스크 가중치가 적용됩니다
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
