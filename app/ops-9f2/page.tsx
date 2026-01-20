'use client'

import Link from 'next/link'
import { BarChart3, Eye } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-center text-gray-900">관리자 메뉴</h1>

        <div className="grid gap-3 sm:gap-4">
          <Link
            href="/ops-9f2/stats"
            className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-white rounded-lg shadow hover:shadow-md active:bg-gray-50 transition-all"
          >
            <div className="p-2.5 sm:p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-base sm:text-lg text-gray-900">방문자 통계</h2>
              <p className="text-xs sm:text-sm text-gray-500">사이트 방문자 현황 및 통계 확인</p>
            </div>
          </Link>

          <Link
            href="/ops-9f2/views"
            className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-white rounded-lg shadow hover:shadow-md active:bg-gray-50 transition-all"
          >
            <div className="p-2.5 sm:p-3 bg-green-100 rounded-lg">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-base sm:text-lg text-gray-900">조회수 관리</h2>
              <p className="text-xs sm:text-sm text-gray-500">게시글 조회수 조회 및 수정</p>
            </div>
          </Link>
        </div>

        <div className="mt-6 sm:mt-8 text-center">
          <Link href="/board" className="text-sm text-gray-500 hover:underline active:text-gray-700">
            ← 게시판으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
