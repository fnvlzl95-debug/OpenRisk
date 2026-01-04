'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface GaugeChartProps {
  score: number
}

export default function GaugeChart({ score }: GaugeChartProps) {
  const data = [
    { name: 'Score', value: score },
    { name: 'Remaining', value: 100 - score },
  ]

  // 흑백 스타일: 점수가 높을수록 진한 검정
  const activeColor = score >= 70 ? '#111111' :  // 매우 진한 검정
                      score >= 50 ? '#333333' :  // 진한 회색
                      score >= 30 ? '#666666' :  // 중간 회색
                      '#999999'                   // 연한 회색
  const emptyColor = '#E5E5E5'

  return (
    <div className="relative w-full h-full flex justify-center items-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="70%"
            startAngle={180}
            endAngle={0}
            innerRadius="60%"
            outerRadius="95%"
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell key="cell-0" fill={activeColor} />
            <Cell key="cell-1" fill={emptyColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* 중앙 텍스트 */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-1 text-center">
        <span className="text-3xl font-bold tracking-tight text-black block leading-none">
          {score}
        </span>
        <span className="text-[8px] text-gray-400 uppercase tracking-wider mt-1 block">
          RISK
        </span>
      </div>
    </div>
  )
}
