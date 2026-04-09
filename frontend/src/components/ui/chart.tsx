import { useId } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { MetricsGranularity } from '@/lib/metrics'

interface MetricsChartProps {
  data: { bucket: string; count: number }[]
  className?: string
  color?: string
  height?: number
  granularity?: MetricsGranularity
  seriesLabel?: string
}

function formatTick(dateStr: string, granularity: MetricsGranularity) {
  const d = new Date(dateStr)

  switch (granularity) {
    case 'hour':
      return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' })
    case 'day':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'week':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    case 'month':
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
}

function formatTooltipLabel(dateStr: string, granularity: MetricsGranularity) {
  const d = new Date(dateStr)

  switch (granularity) {
    case 'hour':
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    case 'day':
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    case 'week':
      return `Week of ${d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    case 'month':
      return d.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
  }
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

function CustomTooltip({
  active,
  payload,
  label,
  granularity,
  seriesLabel,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string | number
  granularity: MetricsGranularity
  seriesLabel: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{formatTooltipLabel(String(label ?? ''), granularity)}</p>
      <p className="text-sm font-semibold">{payload[0].value.toLocaleString()} {seriesLabel}</p>
    </div>
  )
}

export function MetricsChart({
  data,
  className,
  color,
  height = 300,
  granularity = 'hour',
  seriesLabel = 'events',
}: MetricsChartProps) {
  const chartColor = color || 'var(--chart-1)'
  const gradientId = useId().replace(/:/g, '')

  if (!data.length) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground text-sm', className)} style={{ height }}>
        No metrics data available
      </div>
    )
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={value => formatTick(String(value), granularity)}
            className="text-xs fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={formatCount}
            className="text-xs fill-muted-foreground"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={48}
          />
          <Tooltip content={<CustomTooltip granularity={granularity} seriesLabel={seriesLabel} />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={chartColor}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
