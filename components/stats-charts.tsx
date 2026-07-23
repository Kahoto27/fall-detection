'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { FallAlert } from '@/lib/mock-data'

const trendConfig = {
  falls: { label: 'Số lần té ngã', color: 'var(--chart-4)' },
  response: { label: 'Phản hồi (s)', color: 'var(--chart-1)' },
} satisfies ChartConfig

const hourlyConfig = {
  events: { label: 'Sự kiện', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function StatsCharts({ alerts = [] }: { alerts?: FallAlert[] }) {
  const trendData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dayStr = d.toLocaleDateString('vi-VN', { weekday: 'short' })
      days.push({ day: dayStr, dateStr: d.toDateString(), falls: 0, responseSum: 0, responseCount: 0 })
    }
    
    alerts.forEach(a => {
      if (a.severity === 'fall' || a.severity === 'emergency') {
        const aDate = new Date(a.timestamp).toDateString()
        const dayObj = days.find(d => d.dateStr === aDate)
        if (dayObj) {
          dayObj.falls++
          if (a.responseSeconds != null && a.responseSeconds > 0) {
            dayObj.responseSum += a.responseSeconds
            dayObj.responseCount++
          }
        }
      }
    })

    return days.map(d => ({
      day: d.day,
      falls: d.falls,
      response: d.responseCount > 0 ? Math.round(d.responseSum / d.responseCount) : 0
    }))
  }, [alerts])

  const hourlyData = useMemo(() => {
    const bins = [
      { range: '00:00-04:00', min: 0, max: 4, events: 0 },
      { range: '04:00-08:00', min: 4, max: 8, events: 0 },
      { range: '08:00-12:00', min: 8, max: 12, events: 0 },
      { range: '12:00-16:00', min: 12, max: 16, events: 0 },
      { range: '16:00-20:00', min: 16, max: 20, events: 0 },
      { range: '20:00-24:00', min: 20, max: 24, events: 0 },
    ]
    
    alerts.forEach(a => {
      if (a.severity === 'fall' || a.severity === 'emergency') {
        const h = new Date(a.timestamp).getHours()
        const bin = bins.find(b => h >= b.min && h < b.max)
        if (bin) bin.events++
      }
    })
    
    return bins.map(({ range, events }) => ({ range, events }))
  }, [alerts])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xu hướng 7 ngày</CardTitle>
          <CardDescription>
            Số lần té ngã và thời gian phản hồi trung bình mỗi ngày
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-[240px] w-full">
            <LineChart data={trendData} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="falls"
                type="monotone"
                stroke="var(--color-falls)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                dataKey="response"
                type="monotone"
                stroke="var(--color-response)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phân bố theo khung giờ</CardTitle>
          <CardDescription>
            Sự kiện cảnh báo thường xảy ra vào thời điểm nào trong ngày
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={hourlyConfig} className="h-[240px] w-full">
            <BarChart data={hourlyData} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="events"
                fill="var(--color-events)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
