'use client'

import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'

interface TimePattern {
  morning: number
  day: number
  night: number
}

interface TrafficChartProps {
  data: TimePattern
}

export default function TrafficChart({ data }: TrafficChartProps) {
  const chartData = [
    { name: '06시', value: data.morning * 0.5, label: '오전' },
    { name: '09시', value: data.morning },
    { name: '12시', value: data.day },
    { name: '18시', value: data.night },
    { name: '22시', value: data.night * 0.6 },
  ]

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 5, left: 5, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#111" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: '#999' }}
            axisLine={false}
            tickLine={false}
            dy={5}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#111"
            strokeWidth={1.5}
            fill="url(#trafficGradient)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
