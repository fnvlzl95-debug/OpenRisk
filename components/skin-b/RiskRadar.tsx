'use client'

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, PolarRadiusAxis } from 'recharts'

interface RadarMetric {
  subject: string
  score: number
  fullMark: number
}

interface RiskRadarProps {
  data: RadarMetric[]
}

export default function RiskRadar({ data }: RiskRadarProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#D1D5DB" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#000', fontSize: 11, fontWeight: 600 }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#000"
            strokeWidth={2}
            fill="#000"
            fillOpacity={0.15}
            dot={{ fill: '#000', r: 3 }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
