import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { eventsApi } from '@/api/events'
import { metricsApi } from '@/api/metrics'
import { eventTypesApi } from '@/api/eventTypes'
import { metaFieldsApi } from '@/api/metaFields'
import type { EventType, FieldDefinition, MetaFieldDefinition } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { MetricsChart } from '@/components/ui/chart'
import { aggregateMetricPoints, type MetricsGranularity } from '@/lib/metrics'
import { ArrowLeft, CircleCheck, Eye, Tag } from 'lucide-react'

const RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

const GRANULARITY_OPTIONS: { value: MetricsGranularity; label: string }[] = [
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
]

export default function EventDetailPage() {
  const { slug, eventId } = useParams<{ slug: string; eventId: string }>()
  const navigate = useNavigate()
  const [rangeDays, setRangeDays] = useState(30)
  const [granularity, setGranularity] = useState<MetricsGranularity>('hour')

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', slug, eventId],
    queryFn: () => eventsApi.get(slug!, eventId!),
    enabled: !!slug && !!eventId,
  })

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['eventTypes', slug],
    queryFn: () => eventTypesApi.list(slug!),
    enabled: !!slug,
  })

  const { data: metaFields = [] } = useQuery({
    queryKey: ['metaFields', slug],
    queryFn: () => metaFieldsApi.list(slug!),
    enabled: !!slug,
  })

  const timeRange = useMemo(() => {
    const to = new Date()
    const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [rangeDays])

  const { data: metrics } = useQuery({
    queryKey: ['eventMetrics', slug, eventId, rangeDays],
    queryFn: () => metricsApi.getEventMetrics(slug!, eventId!, timeRange),
    enabled: !!slug && !!eventId,
    refetchInterval: 60000,
  })
  const chartData = useMemo(
    () => aggregateMetricPoints(metrics?.data ?? [], granularity),
    [granularity, metrics?.data],
  )

  if (eventLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  if (!event) {
    return <div className="p-6 text-muted-foreground">Event not found</div>
  }

  const eventType = eventTypes.find((et: EventType) => et.id === event.event_type_id)
  const fieldDefs = eventType?.field_definitions ?? []
  const fieldDefMap = new Map(fieldDefs.map((fd: FieldDefinition) => [fd.id, fd]))
  const metaFieldMap = new Map(metaFields.map((mf: MetaFieldDefinition) => [mf.id, mf]))

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(`/p/${slug}/events`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to events
      </Button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{event.name}</h1>
          {eventType && (
            <Badge style={{ backgroundColor: eventType.color, color: '#fff' }}>
              {eventType.display_name}
            </Badge>
          )}
          {event.implemented && (
            <Badge variant="outline" className="gap-1">
              <CircleCheck className="h-3 w-3" /> Implemented
            </Badge>
          )}
          {event.reviewed && (
            <Badge variant="outline" className="gap-1">
              <Eye className="h-3 w-3" /> Reviewed
            </Badge>
          )}
        </div>
        {event.description && (
          <p className="text-muted-foreground">{event.description}</p>
        )}
        {event.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {event.tags.map(t => (
              <Badge key={t.id} variant="secondary" className="gap-1 text-xs">
                <Tag className="h-3 w-3" /> {t.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Metrics Chart — Event Level */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Event Volume</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {RANGE_OPTIONS.map(opt => (
                  <Button
                    key={opt.days}
                    variant={rangeDays === opt.days ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRangeDays(opt.days)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
              <Select
                value={granularity}
                onValueChange={(value: MetricsGranularity) => setGranularity(value)}
              >
                <SelectTrigger className="h-8 w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRANULARITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <MetricsChart
            data={chartData}
            height={280}
            color={eventType?.color || undefined}
            granularity={granularity}
          />
          {metrics?.interval && (
            <p className="text-xs text-muted-foreground mt-2">
              Collection interval: {metrics.interval}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Field Values */}
      {event.field_values.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Field Values</h2>
            <div className="grid gap-3">
              {event.field_values.map(fv => {
                const fd = fieldDefMap.get(fv.field_definition_id)
                return (
                  <div key={fv.id} className="flex gap-4 text-sm">
                    <span className="text-muted-foreground min-w-[140px] font-medium">
                      {fd?.display_name ?? fd?.name ?? 'Unknown'}
                    </span>
                    <span className="font-mono text-foreground/80 break-all">
                      {fv.value || '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meta Values */}
      {event.meta_values.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Meta Fields</h2>
            <div className="grid gap-3">
              {event.meta_values.map(mv => {
                const mf = metaFieldMap.get(mv.meta_field_definition_id)
                return (
                  <div key={mv.id} className="flex gap-4 text-sm">
                    <span className="text-muted-foreground min-w-[140px] font-medium">
                      {mf?.display_name ?? mf?.name ?? 'Unknown'}
                    </span>
                    <span className="font-mono text-foreground/80 break-all">
                      {mf?.field_type === 'url' && mv.value ? (
                        <a href={mv.value} target="_blank" rel="noopener noreferrer" className="text-primary underline">{mv.value}</a>
                      ) : mf?.field_type === 'boolean' ? (
                        mv.value === 'true' ? '✓' : '✗'
                      ) : (
                        mv.value || '—'
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
