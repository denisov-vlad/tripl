import type { EventMetricPoint } from '@/types'

export type MetricsGranularity = 'hour' | 'day' | 'week' | 'month'

function getBucketStart(dateStr: string, granularity: MetricsGranularity): string {
  const date = new Date(dateStr)
  let normalized: Date

  switch (granularity) {
    case 'hour':
      normalized = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
      ))
      break
    case 'day':
      normalized = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ))
      break
    case 'week': {
      const start = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ))
      const daysFromMonday = (start.getUTCDay() + 6) % 7
      start.setUTCDate(start.getUTCDate() - daysFromMonday)
      normalized = start
      break
    }
    case 'month':
      normalized = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        1,
      ))
      break
  }

  return normalized.toISOString()
}

export function aggregateMetricPoints(
  points: EventMetricPoint[],
  granularity: MetricsGranularity,
): EventMetricPoint[] {
  const grouped = new Map<string, number>()

  for (const point of points) {
    const bucket = getBucketStart(point.bucket, granularity)
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + point.count)
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucket, count]) => ({ bucket, count }))
}
