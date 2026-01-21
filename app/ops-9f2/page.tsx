'use client'

import Link from 'next/link'
import { BarChart3, Eye, Settings, ChevronRight } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="group">
              <span className="text-lg sm:text-xl font-black tracking-tight text-gray-900 group-hover:text-gray-600 transition-colors">
                OPEN RISK
              </span>
            </Link>
            <Link
              href="/board"
              className="text-xs sm:text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              게시판으로 이동
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* 타이틀 영역 */}
        <div className="py-8 sm:py-12 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-900 rounded-lg">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-widest">Admin Console</p>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">관리자 메뉴</h1>
            </div>
          </div>
        </div>

        {/* 메뉴 그리드 */}
        <div className="py-6 sm:py-8">
          <div className="grid gap-3 sm:gap-4">
            <Link
              href="/ops-9f2/stats"
              className="group flex items-center justify-between p-4 sm:p-5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500 rounded-xl shadow-sm">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-base sm:text-lg text-gray-900">방문자 통계</h2>
                  <p className="text-xs sm:text-sm text-gray-500">사이트 방문자 현황 및 통계 확인</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>

            <Link
              href="/ops-9f2/views"
              className="group flex items-center justify-between p-4 sm:p-5 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500 rounded-xl shadow-sm">
                  <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-base sm:text-lg text-gray-900">조회수 관리</h2>
                  <p className="text-xs sm:text-sm text-gray-500">게시글 조회수 조회 및 수정</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-300">
            <span className="font-black text-gray-400">OPEN RISK</span>
            <p>Admin Console</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
