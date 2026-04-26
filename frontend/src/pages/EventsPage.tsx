import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { eventsApi } from '@/api/events'
import { metricsApi } from '@/api/metrics'
import { eventTypesApi } from '@/api/eventTypes'
import { metaFieldsApi } from '@/api/metaFields'
import { variablesApi } from '@/api/variables'
import { useConfirm } from '@/hooks/useConfirm'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useVirtualizer } from '@tanstack/react-virtual'
import type {
  Event as TEvent,
  EventListResponse,
  EventMetricPoint,
  EventType,
  FieldDefinition,
  MetaFieldDefinition,
  MonitoringSignal,
  Variable,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MetricsChart, MiniMetricsChart } from '@/components/ui/chart'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Chip } from '@/components/primitives/chip'
import { Dot } from '@/components/primitives/dot'
import { MiniStat, MiniStatDivider } from '@/components/primitives/mini-stat'
import { Sparkline } from '@/components/primitives/sparkline'
import { META_FIELD_LINK_PLACEHOLDER, resolveMetaFieldHref } from '@/lib/metaFields'
import { aggregateMetricPoints, type MetricsGranularity } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Archive,
  ArchiveRestore,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  Eye,
  Filter,
  GripVertical,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'

const TAB_METRICS_RANGE_DAYS_DEFAULT = 7
const ROW_METRICS_RANGE_HOURS = 48
const ROW_METRICS_LABEL = `${ROW_METRICS_RANGE_HOURS}h`
const TAB_METRICS_RANGE_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const
const TAB_METRICS_GRANULARITY_OPTIONS: { value: MetricsGranularity; label: string }[] = [
  { value: 'hour', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
]
const EMPTY_EVENT_TYPES: EventType[] = []
const EMPTY_META_FIELDS: MetaFieldDefinition[] = []
const EMPTY_VARIABLES: Variable[] = []
const EMPTY_TAGS: string[] = []
const EMPTY_SIGNALS: MonitoringSignal[] = []
const EMPTY_EVENT_WINDOW_METRICS: {
  event_id: string
  scan_config_id: string | null
  interval: string
  total_count: number
  data: EventMetricPoint[]
}[] = []
const EMPTY_WINDOW_POINTS: EventMetricPoint[] = []
const compactCountFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 0,
})

function formatCompactCount(value: number) {
  return compactCountFormatter.format(value).toLowerCase()
}

function getSignalTone(signal: MonitoringSignal) {
  if (signal.state === 'latest_scan') {
    return {
      compact: 'text-destructive',
      regular: 'bg-destructive text-destructive-foreground',
      button: 'destructive' as const,
      buttonClassName: '',
      title: 'Open latest scan anomaly',
    }
  }

  return {
    compact: 'text-amber-500',
    regular: 'bg-amber-400 text-amber-950 ring-1 ring-amber-500/70',
    button: 'outline' as const,
    buttonClassName: 'border-amber-500/60 bg-amber-400/15 text-amber-800 hover:bg-amber-400/20',
    title: 'Open recent anomaly',
  }
}

function getMonitoringPath(slug: string, signal: MonitoringSignal) {
  if (signal.scope_type === 'project_total') {
    return `/p/${slug}/monitoring/project-total/${signal.scope_ref}`
  }
  if (signal.scope_type === 'event_type') {
    return `/p/${slug}/monitoring/event-type/${signal.scope_ref}`
  }
  return `/p/${slug}/monitoring/event/${signal.scope_ref}`
}

function pickLatestSignal(signals: MonitoringSignal[], scopeType: MonitoringSignal['scope_type']) {
  return signals
    .filter(signal => signal.scope_type === scopeType)
    .sort((left, right) => right.bucket.localeCompare(left.bucket))[0] ?? null
}

function mapLatestSignals(signals: MonitoringSignal[], scopeType: MonitoringSignal['scope_type']) {
  const entries = new Map<string, MonitoringSignal>()
  signals
    .filter(signal => signal.scope_type === scopeType)
    .sort((left, right) => right.bucket.localeCompare(left.bucket))
    .forEach(signal => {
      if (!entries.has(signal.scope_ref)) entries.set(signal.scope_ref, signal)
    })
  return entries
}

function deriveRowSignalFromMetrics(
  eventId: string,
  scanConfigId: string | null | undefined,
  points: EventMetricPoint[],
): MonitoringSignal | null {
  const anomalyPoints = points.filter(
    point => point.is_anomaly && point.anomaly_direction !== null,
  )
  if (!anomalyPoints.length) return null

  const latestAnomaly = anomalyPoints[anomalyPoints.length - 1]
  const latestBucket = points[points.length - 1]?.bucket ?? latestAnomaly.bucket

  return {
    scan_config_id: scanConfigId ?? '',
    scope_type: 'event',
    scope_ref: eventId,
    state: latestAnomaly.bucket === latestBucket ? 'latest_scan' : 'recent',
    event_id: eventId,
    event_type_id: null,
    bucket: latestAnomaly.bucket,
    actual_count: latestAnomaly.count,
    expected_count: latestAnomaly.expected_count ?? latestAnomaly.count,
    stddev: 0,
    z_score: latestAnomaly.z_score ?? 0,
    direction: latestAnomaly.anomaly_direction ?? 'drop',
  }
}

function SignalLink({
  slug,
  signal,
  compact = false,
}: {
  slug: string
  signal: MonitoringSignal | null | undefined
  compact?: boolean
}) {
  if (!signal) return null

  const tone = getSignalTone(signal)
  const CompactIcon = signal.direction === 'spike' ? ArrowUp : ArrowDown

  return (
    <Link
      to={getMonitoringPath(slug, signal)}
      className={compact
        ? `relative top-px inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center ${tone.compact}`
        : `inline-flex h-5 w-5 items-center justify-center rounded-full ${tone.regular}`}
      title={tone.title}
      aria-label={tone.title}
    >
      {compact ? <CompactIcon className="h-3.5 w-3.5 stroke-[2.25]" /> : <AlertTriangle className="h-3 w-3" />}
    </Link>
  )
}

function ColumnsMenu({
  open,
  onOpenChange,
  tagsHidden,
  fieldColumns,
  metaFields,
  hiddenColumns,
  onToggle,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tagsHidden: boolean
  fieldColumns: FieldDefinition[]
  metaFields: MetaFieldDefinition[]
  hiddenColumns: Set<string>
  onToggle: (key: string) => void
}) {
  const hasToggleable = fieldColumns.length > 0 || metaFields.length > 0 || true
  if (!hasToggleable) return null
  const totalHidden =
    (tagsHidden ? 1 : 0) +
    fieldColumns.filter((f) => hiddenColumns.has(`f:${f.id}`)).length +
    metaFields.filter((mf) => hiddenColumns.has(`m:${mf.id}`)).length
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          <LayoutGrid className="h-3 w-3" />
          Columns
          {totalHidden > 0 && (
            <span
              className="mono ml-1 tnum text-[10.5px]"
              style={{ color: 'var(--fg-subtle)' }}
            >
              −{totalHidden}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        <div
          className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: 'var(--fg-subtle)' }}
        >
          Toggle columns
        </div>
        <ColumnToggle
          label="Tags"
          pinned={false}
          checked={!tagsHidden}
          onChange={() => onToggle('tags')}
        />
        {fieldColumns.length > 0 && (
          <>
            <div
              className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: 'var(--fg-faint)' }}
            >
              Fields
            </div>
            {fieldColumns.map((f) => (
              <ColumnToggle
                key={f.id}
                label={f.display_name}
                pinned={false}
                checked={!hiddenColumns.has(`f:${f.id}`)}
                onChange={() => onToggle(`f:${f.id}`)}
              />
            ))}
          </>
        )}
        {metaFields.length > 0 && (
          <>
            <div
              className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: 'var(--fg-faint)' }}
            >
              Meta
            </div>
            {metaFields.map((mf) => (
              <ColumnToggle
                key={mf.id}
                label={mf.display_name}
                pinned={false}
                checked={!hiddenColumns.has(`m:${mf.id}`)}
                onChange={() => onToggle(`m:${mf.id}`)}
              />
            ))}
          </>
        )}
        <div
          className="border-t px-2 pb-1 pt-2 text-[10px]"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--fg-faint)' }}
        >
          Event, Type, {ROW_METRICS_LABEL}, Actions are pinned
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColumnToggle({
  label,
  pinned,
  checked,
  onChange,
}: {
  label: string
  pinned: boolean
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      disabled={pinned}
      onClick={onChange}
      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12px] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed"
      style={{ color: pinned ? 'var(--fg-faint)' : 'var(--fg)' }}
    >
      <span
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border"
        style={{
          background: checked ? 'var(--accent)' : 'transparent',
          borderColor: checked ? 'var(--accent)' : 'var(--border-strong)',
        }}
      >
        {checked && <Check className="h-2.5 w-2.5" style={{ color: 'var(--accent-fg)' }} />}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {pinned && (
        <span
          className="text-[9px] uppercase tracking-[0.05em]"
          style={{ color: 'var(--fg-faint)' }}
        >
          pinned
        </span>
      )}
    </button>
  )
}

const EventWindowMetricsCell = memo(function EventWindowMetricsCell({
  eventName,
  color,
  totalCount,
  data,
  anomalyIdx,
  signalTone,
}: {
  eventName: string
  color: string
  totalCount: number | undefined
  data: EventMetricPoint[]
  anomalyIdx?: number | null
  signalTone?: 'danger' | 'warning' | null
}) {
  const label = totalCount == null ? '—' : formatCompactCount(totalCount)
  const counts = data.map((p) => p.count)
  const sparkColor =
    signalTone === 'danger'
      ? 'var(--danger)'
      : signalTone === 'warning'
        ? 'var(--warning)'
        : color || 'var(--accent)'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="tnum mono inline-flex items-center gap-2 text-[11.5px] font-medium hover:text-foreground"
          style={{ color: signalTone ? sparkColor : 'var(--fg-muted)' }}
        >
          {counts.length > 1 && (
            <Sparkline
              data={counts}
              color={sparkColor}
              width={60}
              height={16}
              anomalyIdx={anomalyIdx ?? null}
            />
          )}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent
        className="w-[22rem] max-w-[calc(100vw-2rem)] border bg-background p-0 text-foreground shadow-md"
        side="top"
      >
        <div className="space-y-3 p-3">
          <div className="space-y-1">
            <p className="truncate text-xs font-medium">{eventName}</p>
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Last 48 hours</span>
              <span>{formatCompactCount(totalCount ?? 0)} events</span>
            </div>
          </div>
          <MiniMetricsChart data={data} color={color} height={104} />
        </div>
      </TooltipContent>
    </Tooltip>
  )
})

const EventRowActions = memo(function EventRowActions({
  event,
  slug,
  canMoveUp,
  canMoveDown,
  onEdit,
  onMoveUp,
  onMoveDown,
  onToggleReviewed,
  onToggleImplemented,
  onToggleArchived,
  onDelete,
}: {
  event: TEvent
  slug: string
  canMoveUp: boolean
  canMoveDown: boolean
  onEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleReviewed: () => void
  onToggleImplemented: () => void
  onToggleArchived: () => void
  onDelete: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openActions = useCallback(() => {
    clearCloseTimer()
    setIsExpanded(true)
  }, [clearCloseTimer])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setIsExpanded(false)
      closeTimerRef.current = null
    }, 140)
  }, [clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-end"
      onMouseLeave={scheduleClose}
      onBlur={event_ => {
        if (!containerRef.current?.contains(event_.relatedTarget as Node | null)) {
          scheduleClose()
        }
      }}
    >
      <div className="relative flex items-center justify-end">
        <div
          className={`absolute right-[calc(100%-1px)] top-1/2 z-50 flex -translate-y-1/2 items-center gap-1 rounded-l-lg border border-r-0 bg-background/95 p-1 shadow-lg backdrop-blur-sm transition-all duration-200 ease-out ${
            isExpanded
              ? 'pointer-events-auto translate-x-0 opacity-100'
              : 'pointer-events-none translate-x-2 opacity-0'
          }`}
          onMouseEnter={openActions}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Move event up"
            aria-label="Move event up"
            onClick={onMoveUp}
            disabled={!canMoveUp}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Move event down"
            aria-label="Move event down"
            onClick={onMoveDown}
            disabled={!canMoveDown}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={event.implemented ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            title={event.implemented ? 'Implemented' : 'Not implemented'}
            aria-label="Toggle implemented status"
            onClick={onToggleImplemented}
          >
            <CircleCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View metrics"
            aria-label="View metrics"
            asChild
          >
            <Link to={`/p/${slug}/monitoring/event/${event.id}`}>
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            title={event.archived ? 'Unarchive' : 'Archive'}
            aria-label={event.archived ? 'Unarchive event' : 'Archive event'}
            onClick={onToggleArchived}
          >
            {event.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete event"
            aria-label="Delete event"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className={`relative z-10 flex items-center gap-1 rounded-lg border bg-background/95 p-1 backdrop-blur-sm transition-shadow ${isExpanded ? 'shadow-lg' : 'shadow-sm'}`}>
          <Button
            variant={event.reviewed ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            title={event.reviewed ? 'Reviewed' : 'Not reviewed'}
            aria-label="Toggle review status"
            onClick={onToggleReviewed}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Edit event"
            aria-label="Edit event"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="More actions"
            aria-label="More actions"
            onMouseEnter={openActions}
            onFocus={openActions}
            onClick={() => {
              if (isExpanded) {
                scheduleClose()
              } else {
                openActions()
              }
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
})

type RowAction =
  | 'edit'
  | 'navigate-monitoring'
  | 'move-up'
  | 'move-down'
  | 'toggle-reviewed'
  | 'toggle-implemented'
  | 'toggle-archived'
  | 'delete'

type EventRowProps = {
  ev: TEvent
  selected: boolean
  hideType: boolean
  hideTags: boolean
  fieldColumns: FieldDefinition[]
  metaFields: MetaFieldDefinition[]
  slug: string
  canMoveUp: boolean
  canMoveDown: boolean
  expandedFieldId: string | null
  rowSignal: MonitoringSignal | undefined
  windowTotal: number | undefined
  windowData: EventMetricPoint[]
  getFieldValue: (ev: TEvent, f: FieldDefinition) => string
  onToggleSelected: (id: string, checked: boolean) => void
  onToggleExpanded: (cellKey: string | null) => void
  onRowAction: (action: RowAction, ev: TEvent) => void
}

const EventRow = memo(function EventRow({
  ev,
  selected,
  hideType,
  hideTags,
  fieldColumns,
  metaFields,
  slug,
  canMoveUp,
  canMoveDown,
  expandedFieldId,
  rowSignal,
  windowTotal,
  windowData,
  getFieldValue,
  onToggleSelected,
  onToggleExpanded,
  onRowAction,
}: EventRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ev.id })
  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  }

  const mvMap = useMemo(
    () => Object.fromEntries(ev.meta_values.map((mv) => [mv.meta_field_definition_id, mv.value])),
    [ev.meta_values],
  )
  const anomalyIdx = windowData.findIndex((p) => p.is_anomaly)
  const signalTone: 'danger' | 'warning' | null = rowSignal
    ? rowSignal.state === 'latest_scan'
      ? 'danger'
      : 'warning'
    : null
  const statusTone: 'success' | 'warning' | 'neutral' = ev.archived
    ? 'neutral'
    : ev.implemented
      ? 'success'
      : ev.reviewed
        ? 'warning'
        : 'neutral'

  return (
    <TableRow ref={setNodeRef} style={dragStyle} data-state={selected ? 'selected' : undefined}>
      <TableCell className="w-8 px-1">
        <button
          type="button"
          className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Drag to reorder ${ev.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </TableCell>
      <TableCell className="tripl-pin-l pl-5">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onToggleSelected(ev.id, checked === true)}
          aria-label={`Select ${ev.name}`}
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="inline-flex max-w-full items-center gap-2 align-middle">
          <Dot tone={signalTone ?? statusTone} pulse={!!signalTone} size={6} />
          <button
            className="mono truncate text-left text-[12.5px] hover:underline underline-offset-4"
            onClick={() => onRowAction('navigate-monitoring', ev)}
            title={ev.name}
          >
            {ev.name}
          </button>
        </div>
      </TableCell>
      {!hideType && (
        <TableCell>
          <Chip size="xs">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: ev.event_type.color }}
            />
            {ev.event_type.name}
          </Chip>
        </TableCell>
      )}
      <TableCell className="text-right">
        <div className="inline-flex items-center justify-end gap-2 align-middle">
          <SignalLink slug={slug} signal={rowSignal} compact />
          <EventWindowMetricsCell
            eventName={ev.name}
            color={ev.event_type.color}
            totalCount={windowTotal}
            data={windowData}
            anomalyIdx={anomalyIdx >= 0 ? anomalyIdx : null}
            signalTone={signalTone}
          />
        </div>
      </TableCell>
      {!hideTags && (
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {ev.tags.map((t) => (
              <Chip key={t.id} size="xs">{t.name}</Chip>
            ))}
            {ev.tags.length === 0 && (
              <span className="text-[11px]" style={{ color: 'var(--fg-faint)' }}>—</span>
            )}
          </div>
        </TableCell>
      )}
      {fieldColumns.map((f) => {
        let val = getFieldValue(ev, f)
        if (val && /^-?\d+\.0+$/.test(val)) val = String(parseInt(val, 10))
        const cellKey = `${ev.id}-${f.id}`
        const isExpanded = expandedFieldId === f.id
        const isLong = typeof val === 'string' && val.length > 30
        return (
          <TableCell
            key={f.id}
            className={`text-xs ${isLong ? 'cursor-pointer' : ''} ${isExpanded ? '' : 'max-w-40'}`}
            onClick={isLong ? () => onToggleExpanded(cellKey) : undefined}
          >
            {isExpanded ? (
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] max-w-sm">{(() => {
                try { return JSON.stringify(JSON.parse(val), null, 2) } catch { return val }
              })()}</pre>
            ) : (
              <span className={isLong ? 'block truncate' : ''}>{val}</span>
            )}
          </TableCell>
        )
      })}
      {metaFields.map((mf) => (
          <TableCell key={mf.id} className="text-muted-foreground max-w-40 truncate text-xs">
            {resolveMetaFieldHref(mf, mvMap[mf.id] ?? '') ? (
              <a
                href={resolveMetaFieldHref(mf, mvMap[mf.id] ?? '') ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-primary underline-offset-4 hover:underline"
                title={mvMap[mf.id]}
              >
                {mvMap[mf.id]}
              </a>
            ) : mf.field_type === 'boolean' && mvMap[mf.id] ? (
              <Badge variant={mvMap[mf.id] === 'true' ? 'success' : 'secondary'} className="text-[10px]">
                {mvMap[mf.id] === 'true' ? 'Yes' : 'No'}
              </Badge>
            ) : mvMap[mf.id] ?? ''}
          </TableCell>
        ))}
      <TableCell className="sticky right-0 z-10 border-l bg-background/95 pl-3 pr-2 backdrop-blur-sm hover:z-40 focus-within:z-40">
        <EventRowActions
          event={ev}
          slug={slug}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onEdit={() => onRowAction('edit', ev)}
          onMoveUp={() => onRowAction('move-up', ev)}
          onMoveDown={() => onRowAction('move-down', ev)}
          onToggleReviewed={() => onRowAction('toggle-reviewed', ev)}
          onToggleImplemented={() => onRowAction('toggle-implemented', ev)}
          onToggleArchived={() => onRowAction('toggle-archived', ev)}
          onDelete={() => onRowAction('delete', ev)}
        />
      </TableCell>
    </TableRow>
  )
})

export default function EventsPage() {
  const { slug, tab: urlTab, eventId: urlEventId } = useParams<{ slug: string; tab?: string; eventId?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()

  // Derive active tab from URL (default 'all')
  const activeTab = urlTab || 'all'

  // Derive filters from URL search params
  const search = searchParams.get('q') || ''
  const setSearch = useCallback((v: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) {
        next.set('q', v)
      } else {
        next.delete('q')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const filterImplemented = searchParams.has('implemented') ? searchParams.get('implemented') === 'true' : undefined
  const setFilterImplemented = useCallback((v: boolean | undefined) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v !== undefined) {
        next.set('implemented', String(v))
      } else {
        next.delete('implemented')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const filterTag = searchParams.get('tag') || ''
  const setFilterTag = useCallback((v: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (v) {
        next.set('tag', v)
      } else {
        next.delete('tag')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const filterReviewed = searchParams.has('reviewed') ? searchParams.get('reviewed') === 'true' : undefined

  // Derive field/meta filters from URL (prefixed f. and m.) — keyed by name
  const fieldFilters = useMemo(() => {
    const out: Record<string, string> = {}
    searchParams.forEach((v, k) => { if (k.startsWith('f.')) out[k.slice(2)] = v })
    return out
  }, [searchParams])

  const updateFieldFilter = useCallback((name: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(`f.${name}`, value)
      } else {
        next.delete(`f.${name}`)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const metaFilters = useMemo(() => {
    const out: Record<string, string> = {}
    searchParams.forEach((v, k) => { if (k.startsWith('m.')) out[k.slice(2)] = v })
    return out
  }, [searchParams])

  const updateMetaFilter = useCallback((name: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(`m.${name}`, value)
      } else {
        next.delete(`m.${name}`)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TEvent | null>(null)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const [openCharts, setOpenCharts] = useState<Record<string, boolean>>({})
  const [tabMetricsRangeDays, setTabMetricsRangeDays] = useState(TAB_METRICS_RANGE_DAYS_DEFAULT)
  const [tabMetricsGranularity, setTabMetricsGranularity] = useState<MetricsGranularity>('hour')
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('tripl.eventsHiddenCols')
      if (!raw) return new Set()
      return new Set(JSON.parse(raw) as string[])
    } catch { return new Set() }
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const toggleColumn = useCallback((key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem('tripl.eventsHiddenCols', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])
  const { confirm, dialog } = useConfirm()

  // Open event from URL param
  const openEventId = urlEventId || null

  const eventTypesQuery = useQuery({
    queryKey: ['eventTypes', slug],
    queryFn: () => eventTypesApi.list(slug!),
    enabled: !!slug,
  })
  const eventTypes = eventTypesQuery.data ?? EMPTY_EVENT_TYPES
  const metaFieldsQuery = useQuery({
    queryKey: ['metaFields', slug],
    queryFn: () => metaFieldsApi.list(slug!),
    enabled: !!slug,
  })
  const metaFields = metaFieldsQuery.data ?? EMPTY_META_FIELDS
  const variablesQuery = useQuery({
    queryKey: ['variables', slug],
    queryFn: () => variablesApi.list(slug!),
    enabled: !!slug,
  })
  const variables = variablesQuery.data ?? EMPTY_VARIABLES
  const allTagsQuery = useQuery({
    queryKey: ['eventTags', slug],
    queryFn: () => eventsApi.tags(slug!),
    enabled: !!slug,
  })
  const allTags = allTagsQuery.data ?? EMPTY_TAGS

  const specialTabs = ['all', 'review', 'archived']
  const filterEtId = specialTabs.includes(activeTab) ? undefined : eventTypes.find((e: EventType) => e.name === activeTab)?.id
  const filterReviewedForQuery = activeTab === 'review' ? false : filterReviewed
  const filterArchivedForQuery = activeTab === 'archived' ? true : false
  const tabMetricsRange = useMemo(() => {
    const to = new Date()
    const from = new Date(to.getTime() - tabMetricsRangeDays * 24 * 60 * 60 * 1000)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [tabMetricsRangeDays])
  const rowMetricsRange = useMemo(() => {
    const to = new Date()
    const from = new Date(to.getTime() - ROW_METRICS_RANGE_HOURS * 60 * 60 * 1000)
    return { time_from: from.toISOString(), time_to: to.toISOString() }
  }, [])

  const debouncedSearch = useDebouncedValue(search, 200)

  const eventsQuery = useQuery({
    queryKey: ['events', slug, filterEtId, debouncedSearch, filterImplemented, filterTag, filterReviewedForQuery, filterArchivedForQuery],
    queryFn: () => eventsApi.list(slug!, {
      event_type_id: filterEtId,
      search: debouncedSearch || undefined,
      implemented: filterImplemented,
      reviewed: filterReviewedForQuery,
      archived: filterArchivedForQuery,
      tag: filterTag || undefined,
      limit: 2000,
    }),
    enabled: !!slug,
    placeholderData: (prev) => prev,
  })
  const eventsData = eventsQuery.data

  const { data: tabMetrics, isLoading: tabMetricsLoading } = useQuery({
    queryKey: ['eventsMetrics', slug, filterEtId, debouncedSearch, filterImplemented, filterTag, filterReviewedForQuery, filterArchivedForQuery, tabMetricsRange.from, tabMetricsRange.to],
    queryFn: () => metricsApi.getEventsMetrics(slug!, {
      event_type_id: filterEtId,
      search: debouncedSearch || undefined,
      implemented: filterImplemented,
      reviewed: filterReviewedForQuery,
      archived: filterArchivedForQuery,
      tag: filterTag || undefined,
      from: tabMetricsRange.from,
      to: tabMetricsRange.to,
    }),
    enabled: !!slug,
    refetchInterval: 60000,
    placeholderData: (prev) => prev,
  })

  const eventIdsForSignals = useMemo(
    () => (eventsData?.items ?? []).map(event => event.id),
    [eventsData?.items],
  )

  const tabSignalsQuery = useQuery({
    queryKey: ['activeSignals', slug, 'tabs'],
    queryFn: () => metricsApi.getActiveSignals(slug!),
    enabled: !!slug,
    refetchInterval: 60000,
  })
  const tabSignals = tabSignalsQuery.data ?? EMPTY_SIGNALS

  const rowSignalsQuery = useQuery({
    queryKey: ['activeSignals', slug, 'rows', eventIdsForSignals],
    queryFn: () => metricsApi.getActiveSignals(slug!, eventIdsForSignals),
    enabled: !!slug && eventIdsForSignals.length > 0,
    refetchInterval: 60000,
  })
  const rowSignals = rowSignalsQuery.data ?? EMPTY_SIGNALS

  const unreviewedDataQuery = useQuery({
    queryKey: ['events', slug, 'unreviewedCount'],
    queryFn: () => eventsApi.list(slug!, { reviewed: false, archived: false, limit: 1 }),
    enabled: !!slug,
  })
  const unreviewedCount = unreviewedDataQuery.data?.total ?? 0

  // Load event from URL if eventId is present
  const urlEventQuery = useQuery({
    queryKey: ['event', slug, openEventId],
    queryFn: () => eventsApi.get(slug!, openEventId!),
    enabled: !!slug && !!openEventId,
  })
  const urlEvent = urlEventQuery.data

  const openEvent = useCallback((ev: TEvent) => {
    navigate(`/p/${slug}/events/${activeTab}/${ev.id}${searchParams.toString() ? `?${searchParams}` : ''}`)
  }, [slug, activeTab, navigate, searchParams])

  const closeEvent = useCallback(() => {
    const path = activeTab === 'all' ? `/p/${slug}/events` : `/p/${slug}/events/${activeTab}`
    navigate(path + (searchParams.toString() ? `?${searchParams}` : ''), { replace: true })
    setShowForm(false)
    setEditingEvent(null)
  }, [slug, activeTab, navigate, searchParams])

  const deleteMut = useMutation({
    mutationFn: (id: string) => eventsApi.del(slug!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const bulkDeleteMut = useMutation({
    mutationFn: (eventIds: string[]) => eventsApi.bulkDelete(slug!, eventIds),
    onSuccess: () => {
      setSelectedEventIds([])
      qc.invalidateQueries({ queryKey: ['events', slug] })
    },
  })

  const toggleImplementedMut = useMutation({
    mutationFn: ({ id, implemented }: { id: string; implemented: boolean }) =>
      eventsApi.update(slug!, id, { implemented }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const toggleReviewedMut = useMutation({
    mutationFn: ({ id, reviewed }: { id: string; reviewed: boolean }) =>
      eventsApi.update(slug!, id, { reviewed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const toggleArchivedMut = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      eventsApi.update(slug!, id, { archived }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const moveEventMut = useMutation({
    mutationFn: ({
      id,
      direction,
      visibleEventIds,
    }: {
      id: string
      direction: 'up' | 'down'
      visibleEventIds: string[]
    }) => eventsApi.move(slug!, id, { direction, visible_event_ids: visibleEventIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const reorderEventsMut = useMutation({
    mutationFn: (eventIds: string[]) => eventsApi.reorder(slug!, eventIds),
    onMutate: async (eventIds) => {
      await qc.cancelQueries({ queryKey: ['events', slug] })
      const snapshots = qc.getQueriesData<EventListResponse>({ queryKey: ['events', slug] })
      qc.setQueriesData<EventListResponse>({ queryKey: ['events', slug] }, (data) => {
        if (!data) return data
        const indexById = new Map(eventIds.map((id, i) => [id, i]))
        const idSet = new Set(eventIds)
        const reorderedIns = data.items
          .filter((event) => idSet.has(event.id))
          .sort((left, right) => indexById.get(left.id)! - indexById.get(right.id)!)
        let pointer = 0
        const items = data.items.map((event) =>
          idSet.has(event.id) ? reorderedIns[pointer++] : event,
        )
        return { ...data, items }
      })
      return { snapshots }
    },
    onError: (_error, _vars, ctx) => {
      if (!ctx?.snapshots) return
      for (const [key, data] of ctx.snapshots) {
        qc.setQueryData(key as QueryKey, data)
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const rawEvents = useMemo(() => eventsData?.items ?? [], [eventsData?.items])
  const total = eventsData?.total ?? 0

  const activeEt = eventTypes.find((e: EventType) => e.name === activeTab) ?? null
  const openedEvent = openEventId ? (urlEvent ?? null) : editingEvent
  const isTabChartOpen = openCharts[activeTab] ?? false
  const setIsTabChartOpen = useCallback((open: boolean) => {
    setOpenCharts(prev => ({ ...prev, [activeTab]: open }))
  }, [activeTab])
  const tabMetricsData = useMemo(
    () => aggregateMetricPoints(tabMetrics?.data ?? [], tabMetricsGranularity),
    [tabMetrics?.data, tabMetricsGranularity],
  )
  const projectTotalSignal = useMemo(
    () => pickLatestSignal(tabSignals, 'project_total'),
    [tabSignals],
  )
  const eventTypeSignals = useMemo(
    () => mapLatestSignals(tabSignals, 'event_type'),
    [tabSignals],
  )
  const eventSignals = useMemo(
    () => mapLatestSignals(rowSignals, 'event'),
    [rowSignals],
  )
  const activeTabSignal = useMemo(() => {
    if (activeTab === 'all') return projectTotalSignal
    if (!activeEt) return null
    return eventTypeSignals.get(activeEt.id) ?? null
  }, [activeEt, activeTab, eventTypeSignals, projectTotalSignal])
  const activeTabLabel = useMemo(() => {
    if (activeEt) return activeEt.display_name
    if (activeTab === 'review') return 'Review Queue'
    if (activeTab === 'archived') return 'Archived Events'
    return 'All Events'
  }, [activeEt, activeTab])

  const fieldColumns: FieldDefinition[] = useMemo(() => {
    if (activeEt) return [...activeEt.field_definitions].sort((a, b) => a.order - b.order)
    const seen = new Map<string, FieldDefinition>()
    for (const et of eventTypes) {
      for (const fd of [...et.field_definitions].sort((a, b) => a.order - b.order)) {
        if (!seen.has(fd.name)) seen.set(fd.name, fd)
      }
    }
    return Array.from(seen.values())
  }, [activeEt, eventTypes])

  const allFieldDefs = useMemo(() => {
    const map = new Map<string, FieldDefinition>()
    for (const et of eventTypes) {
      for (const fd of et.field_definitions) {
        map.set(fd.id, fd)
      }
    }
    return map
  }, [eventTypes])

  // Collect enum/boolean options per field column for filter dropdowns
  const fieldEnumOptions = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const col of fieldColumns) {
      if (col.field_type === 'enum' && col.enum_options) {
        map[col.id] = new Set(col.enum_options)
      } else if (col.field_type === 'boolean') {
        map[col.id] = new Set(['true', 'false'])
      }
    }
    return map
  }, [fieldColumns])

  const getFieldValue = useCallback((ev: TEvent, col: FieldDefinition) => {
    const fvMap = Object.fromEntries(ev.field_values.map(fv => [fv.field_definition_id, fv.value]))
    if (fvMap[col.id] !== undefined) return fvMap[col.id]
    for (const fv of ev.field_values) {
      const def = allFieldDefs.get(fv.field_definition_id)
      if (def && def.name === col.name) return fv.value
    }
    return ''
  }, [allFieldDefs])

  // Client-side filtering by field values and meta values
  const events = useMemo(() => {
    const hasFieldFilter = Object.values(fieldFilters).some(v => v !== '')
    const hasMetaFilter = Object.values(metaFilters).some(v => v !== '')
    if (!hasFieldFilter && !hasMetaFilter) return rawEvents

    return rawEvents.filter(ev => {
      for (const col of fieldColumns) {
        const fv = fieldFilters[col.name]
        if (!fv) continue
        const val = getFieldValue(ev, col)
        if (col.field_type === 'enum' || col.field_type === 'boolean') {
          if (val !== fv) return false
        } else {
          if (!val.toLowerCase().includes(fv.toLowerCase())) return false
        }
      }
      for (const mf of metaFields) {
        const mv = metaFilters[mf.name]
        if (!mv) continue
        const val = ev.meta_values.find(m => m.meta_field_definition_id === mf.id)?.value ?? ''
        if (mf.field_type === 'enum' || mf.field_type === 'boolean') {
          if (val !== mv) return false
        } else {
          if (!val.toLowerCase().includes(mv.toLowerCase())) return false
        }
      }
      return true
    })
  }, [rawEvents, fieldFilters, metaFilters, fieldColumns, metaFields, getFieldValue])

  const visibleFieldColumns = useMemo(
    () => fieldColumns.filter(f => !hiddenColumns.has(`f:${f.id}`)),
    [fieldColumns, hiddenColumns],
  )
  const visibleMetaFields = useMemo(
    () => metaFields.filter(mf => !hiddenColumns.has(`m:${mf.id}`)),
    [metaFields, hiddenColumns],
  )
  const hideTags = hiddenColumns.has('tags')

  // Row virtualization — kicks in past VIRTUAL_THRESHOLD events, leaving small lists
  // and tests (jsdom can't measure layout) on the plain full-render path.
  const VIRTUAL_THRESHOLD = 100
  const ROW_H_ESTIMATE = 36
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const virtualize = events.length > VIRTUAL_THRESHOLD
  const rowVirtualizer = useVirtualizer({
    count: virtualize ? events.length : 0,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => ROW_H_ESTIMATE,
    overscan: 12,
  })
  const virtualItems = virtualize ? rowVirtualizer.getVirtualItems() : []
  const totalVirtualSize = virtualize ? rowVirtualizer.getTotalSize() : 0
  const colCount =
    1 /* drag handle */ +
    1 /* checkbox */ +
    1 /* event */ +
    (activeEt ? 0 : 1) /* type */ +
    1 /* 48h */ +
    (hideTags ? 0 : 1) /* tags */ +
    visibleFieldColumns.length +
    visibleMetaFields.length +
    1 /* actions */

  const visibleEventIds = useMemo(
    () => events.map(event => event.id),
    [events],
  )
  const visibleIndexById = useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < visibleEventIds.length; i += 1) {
      map.set(visibleEventIds[i], i)
    }
    return map
  }, [visibleEventIds])
  const visibleEventIdsSet = useMemo(() => new Set(visibleEventIds), [visibleEventIds])
  const selectedVisibleEventIds = useMemo(
    () => selectedEventIds.filter(eventId => visibleEventIdsSet.has(eventId)),
    [selectedEventIds, visibleEventIdsSet],
  )
  const allVisibleSelected = events.length > 0 && selectedVisibleEventIds.length === events.length
  const someVisibleSelected = selectedVisibleEventIds.length > 0

  const toggleEventSelected = useCallback((eventId: string, checked: boolean) => {
    setSelectedEventIds(current => (
      checked
        ? (current.includes(eventId) ? current : [...current, eventId])
        : current.filter(id => id !== eventId)
    ))
  }, [])

  const toggleAllVisibleSelected = useCallback((checked: boolean) => {
    setSelectedEventIds(current => {
      if (!checked) {
        return current.filter(id => !visibleEventIdsSet.has(id))
      }
      const next = new Set(current)
      visibleEventIds.forEach(id => next.add(id))
      return Array.from(next)
    })
  }, [visibleEventIds, visibleEventIdsSet])

  const selectedSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds])

  const onToggleExpandedCell = useCallback((cellKey: string | null) => {
    setExpandedCell(prev => (prev === cellKey ? null : cellKey))
  }, [])

  // Stable dispatcher for row-level actions — keeps EventRow memo valid across parent re-renders.
  const rowCtxRef = useRef({
    slug,
    navigate,
    openEvent,
    moveEventMut,
    toggleReviewedMut,
    toggleImplementedMut,
    toggleArchivedMut,
    deleteMut,
    confirm,
    visibleEventIds,
  })
  useEffect(() => {
    rowCtxRef.current = {
      slug,
      navigate,
      openEvent,
      moveEventMut,
      toggleReviewedMut,
      toggleImplementedMut,
      toggleArchivedMut,
      deleteMut,
      confirm,
      visibleEventIds,
    }
  })

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = visibleEventIds.indexOf(String(active.id))
      const newIndex = visibleEventIds.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return
      const next = arrayMove(visibleEventIds, oldIndex, newIndex)
      reorderEventsMut.mutate(next)
    },
    [visibleEventIds, reorderEventsMut],
  )

  const onRowAction = useCallback((action: RowAction, ev: TEvent) => {
    const ctx = rowCtxRef.current
    switch (action) {
      case 'edit':
        ctx.openEvent(ev)
        return
      case 'navigate-monitoring':
        ctx.navigate(`/p/${ctx.slug}/monitoring/event/${ev.id}`)
        return
      case 'move-up':
        ctx.moveEventMut.mutate({ id: ev.id, direction: 'up', visibleEventIds: ctx.visibleEventIds })
        return
      case 'move-down':
        ctx.moveEventMut.mutate({ id: ev.id, direction: 'down', visibleEventIds: ctx.visibleEventIds })
        return
      case 'toggle-reviewed':
        ctx.toggleReviewedMut.mutate({ id: ev.id, reviewed: !ev.reviewed })
        return
      case 'toggle-implemented':
        ctx.toggleImplementedMut.mutate({ id: ev.id, implemented: !ev.implemented })
        return
      case 'toggle-archived':
        ctx.toggleArchivedMut.mutate({ id: ev.id, archived: !ev.archived })
        return
      case 'delete': {
        void (async () => {
          const ok = await ctx.confirm({
            title: 'Delete event',
            message: `Are you sure you want to delete "${ev.name}"?`,
            confirmLabel: 'Delete',
            variant: 'danger',
          })
          if (ok) ctx.deleteMut.mutate(ev.id)
        })()
        return
      }
    }
  }, [])

  const handleBulkDelete = useCallback(async () => {
    if (!selectedVisibleEventIds.length) return
    const ok = await confirm({
      title: 'Delete selected events',
      message: `Delete ${selectedVisibleEventIds.length} selected events?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) bulkDeleteMut.mutate(selectedVisibleEventIds)
  }, [bulkDeleteMut, confirm, selectedVisibleEventIds])

  const hasActiveFilters = filterImplemented !== undefined || filterTag !== '' || filterReviewed !== undefined ||
    Object.values(fieldFilters).some(v => v !== '') ||
    Object.values(metaFilters).some(v => v !== '')

  const eventIdsForWindowMetrics = useMemo(
    () => events.map(event => event.id),
    [events],
  )

  const eventWindowMetricsQuery = useQuery({
    queryKey: [
      'eventWindowMetrics',
      slug,
      eventIdsForWindowMetrics,
      rowMetricsRange.time_from,
      rowMetricsRange.time_to,
    ],
    queryFn: () => metricsApi.getEventsWindowMetrics(slug!, {
      event_ids: eventIdsForWindowMetrics,
      ...rowMetricsRange,
    }),
    enabled: !!slug && eventIdsForWindowMetrics.length > 0,
    refetchInterval: 60000,
  })
  const eventWindowMetrics = eventWindowMetricsQuery.data ?? EMPTY_EVENT_WINDOW_METRICS

  const eventWindowMetricsByEvent = useMemo(
    () => new Map(eventWindowMetrics.map(metric => [metric.event_id, metric])),
    [eventWindowMetrics],
  )
  const eventRowSignals = useMemo(() => {
    const entries = new Map<string, MonitoringSignal>()
    for (const event of events) {
      const activeSignal = eventSignals.get(event.id)
      if (activeSignal) {
        entries.set(event.id, activeSignal)
        continue
      }
      const metric = eventWindowMetricsByEvent.get(event.id)
      const derivedSignal = deriveRowSignalFromMetrics(
        event.id,
        metric?.scan_config_id,
        metric?.data ?? [],
      )
      if (derivedSignal) {
        entries.set(event.id, derivedSignal)
      }
    }
    return entries
  }, [eventSignals, eventWindowMetricsByEvent, events])

  const clearAllFilters = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('implemented')
      next.delete('reviewed')
      next.delete('tag')
      Array.from(next.keys()).filter(k => k.startsWith('f.') || k.startsWith('m.')).forEach(k => next.delete(k))
      return next
    }, { replace: true })
  }

  const blockingError =
    eventsQuery.error ??
    eventTypesQuery.error ??
    metaFieldsQuery.error ??
    variablesQuery.error ??
    allTagsQuery.error ??
    urlEventQuery.error

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      {dialog}

      {/* Header */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <h1 className="m-0 text-[20px] font-semibold tracking-[-0.01em]">Events</h1>
          <span className="mono text-[13px]" style={{ color: 'var(--fg-subtle)' }}>{total}</span>
        </div>
        <div className="flex items-center gap-4">
          <MiniStat label="Total" value={String(total)} />
          <MiniStatDivider />
          <MiniStat
            label="Review"
            value={String(unreviewedCount)}
            delta={unreviewedCount > 0 ? 'pending' : undefined}
            tone={unreviewedCount > 0 ? 'warning' : 'success'}
          />
          <MiniStatDivider />
          <MiniStat
            label="Signals"
            value={String(eventTypeSignals.size + (projectTotalSignal ? 1 : 0))}
            delta={(eventTypeSignals.size > 0 || projectTotalSignal) ? 'live' : 'quiet'}
            tone={(eventTypeSignals.size > 0 || projectTotalSignal) ? 'danger' : 'success'}
            pulse={eventTypeSignals.size > 0 || !!projectTotalSignal}
          />
          <Button onClick={() => {
            if (openEventId) {
              const path = activeTab === 'all' ? `/p/${slug}/events` : `/p/${slug}/events/${activeTab}`
              navigate(path + (searchParams.toString() ? `?${searchParams}` : ''), { replace: true })
            }
            setEditingEvent(null)
            setShowForm(v => !v)
          }}
          size="sm">
            <Plus className="h-3.5 w-3.5" />
            New Event
          </Button>
        </div>
      </div>

      {blockingError && (
        <ErrorState
          title="Failed to load events"
          description="The events page could not fetch the required data from the backend."
          error={blockingError}
          onRetry={() => {
            const refetches: Promise<unknown>[] = [
              eventsQuery.refetch(),
              eventTypesQuery.refetch(),
              metaFieldsQuery.refetch(),
              variablesQuery.refetch(),
              allTagsQuery.refetch(),
              unreviewedDataQuery.refetch(),
            ]
            if (openEventId) {
              refetches.push(urlEventQuery.refetch())
            }
            void Promise.all(refetches)
          }}
        />
      )}

      {!blockingError && (
        <>
          {/* Filters */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-56 pl-8 text-xs"
              />
            </div>
            <Select
              value={filterImplemented === undefined ? '__all__' : String(filterImplemented)}
              onValueChange={v => setFilterImplemented(v === '__all__' ? undefined : v === 'true')}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                <SelectItem value="true">Implemented</SelectItem>
                <SelectItem value="false">Not implemented</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterTag || '__all__'}
              onValueChange={v => setFilterTag(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tags</SelectItem>
                {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            {fieldColumns.map(f => {
              const enumOpts = fieldEnumOptions[f.id]
              if (enumOpts) {
                return (
                  <select
                    key={f.id}
                    value={fieldFilters[f.name] ?? ''}
                    onChange={e => updateFieldFilter(f.name, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">{f.display_name}: All</option>
                    {Array.from(enumOpts).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )
              }
              if (f.field_type !== 'json') {
                return (
                  <Input
                    key={f.id}
                    value={fieldFilters[f.name] ?? ''}
                    onChange={e => updateFieldFilter(f.name, e.target.value)}
                    className="h-8 w-28 text-xs"
                    placeholder={f.display_name}
                  />
                )
              }
              return null
            })}
            {metaFields.map((mf: MetaFieldDefinition) => {
              if (mf.field_type === 'enum' && mf.enum_options) {
                return (
                  <select
                    key={mf.id}
                    value={metaFilters[mf.name] ?? ''}
                    onChange={e => updateMetaFilter(mf.name, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">{mf.display_name}: All</option>
                    {mf.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )
              }
              if (mf.field_type === 'boolean') {
                return (
                  <select
                    key={mf.id}
                    value={metaFilters[mf.name] ?? ''}
                    onChange={e => updateMetaFilter(mf.name, e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">{mf.display_name}: All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                )
              }
              return (
                <Input
                  key={mf.id}
                  value={metaFilters[mf.name] ?? ''}
                  onChange={e => updateMetaFilter(mf.name, e.target.value)}
                  className="h-8 w-28 text-xs"
                  placeholder={mf.display_name}
                />
              )
            })}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 text-xs">
                <X className="mr-1 h-3 w-3" />
                Clear
              </Button>
            )}
            <div className="ml-auto">
              <ColumnsMenu
                open={colMenuOpen}
                onOpenChange={setColMenuOpen}
                tagsHidden={hiddenColumns.has('tags')}
                fieldColumns={fieldColumns}
                metaFields={metaFields}
                hiddenColumns={hiddenColumns}
                onToggle={toggleColumn}
              />
            </div>
          </div>

      {selectedVisibleEventIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{selectedVisibleEventIds.length} selected</span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { void handleBulkDelete() }}
            disabled={bulkDeleteMut.isPending}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete selected
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEventIds([])}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Event Form (Sheet) */}
      {(showForm || openedEvent) && slug && (
        <EventForm
          slug={slug}
          eventTypes={eventTypes}
          metaFields={metaFields}
          projectVariables={variables}
          event={openedEvent}
          defaultEventTypeId={activeEt?.id}
          onClose={closeEvent}
        />
      )}

      <Collapsible open={isTabChartOpen} onOpenChange={setIsTabChartOpen}>
        <Card className="mb-3 gap-0 rounded-lg py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold leading-tight">{activeTabLabel} Dynamics</h2>
              <p className="text-[11px] leading-tight text-muted-foreground">
                Last {tabMetricsRangeDays} days, grouped by {tabMetricsGranularity}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border bg-background p-1">
                {TAB_METRICS_RANGE_OPTIONS.map(option => (
                  <Button
                    key={option.days}
                    type="button"
                    variant={tabMetricsRangeDays === option.days ? 'default' : 'ghost'}
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setTabMetricsRangeDays(option.days)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <Select
                value={tabMetricsGranularity}
                onValueChange={value => setTabMetricsGranularity(value as MetricsGranularity)}
              >
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAB_METRICS_GRANULARITY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeTabSignal && (
                <Button
                  variant={getSignalTone(activeTabSignal).button}
                  size="sm"
                  className={cn('h-7 px-2 text-xs', getSignalTone(activeTabSignal).buttonClassName)}
                  asChild
                >
                  <Link to={getMonitoringPath(slug!, activeTabSignal)}>
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                    View signal
                  </Link>
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  {isTabChartOpen ? 'Hide chart' : 'Show chart'}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isTabChartOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent>
            <CardContent className="border-t px-4 py-3">
              {tabMetricsLoading ? (
                <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
                  Loading metrics…
                </div>
              ) : (
                <>
                  <MetricsChart
                    data={tabMetricsData}
                    height={160}
                    color={activeEt?.color || 'var(--chart-3)'}
                    granularity={tabMetricsGranularity}
                  />
                  {tabMetrics?.interval && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Collection interval: {tabMetrics.interval}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Events Table */}
      <TooltipProvider delayDuration={0}>
      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleEventIds} strategy={verticalListSortingStrategy}>
      <div
        ref={tableScrollRef}
        className="tripl-table-wrap"
        style={{
          maxHeight: isTabChartOpen
            ? 'max(320px, calc(100vh - 455px))'
            : 'max(420px, calc(100vh - 285px))',
          overflowY: 'auto',
        }}
      >
        <Table className="tripl-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-1" aria-label="Reorder" />
              <TableHead className="tripl-pin-l w-10 pl-5">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={checked => toggleAllVisibleSelected(checked === true)}
                  aria-label="Select all visible events"
                />
              </TableHead>
              <TableHead>Event</TableHead>
              {!activeEt && <TableHead>Type</TableHead>}
              <TableHead className="w-32 text-right">{ROW_METRICS_LABEL}</TableHead>
              {!hideTags && <TableHead>Tags</TableHead>}
              {visibleFieldColumns.map(f => (
                <TableHead key={f.id}>{f.display_name}</TableHead>
              ))}
              {visibleMetaFields.map((mf: MetaFieldDefinition) => (
                <TableHead key={mf.id} className="text-muted-foreground">{mf.display_name}</TableHead>
              ))}
              <TableHead className="sticky right-0 z-20 w-[7.5rem] border-l bg-background text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {virtualize && virtualItems.length > 0 && virtualItems[0].start > 0 && (
              <tr aria-hidden style={{ height: virtualItems[0].start }}>
                <td colSpan={colCount} />
              </tr>
            )}
            {(virtualize ? virtualItems.map(vi => events[vi.index]) : events).map((ev: TEvent) => {
              const idx = visibleIndexById.get(ev.id) ?? -1
              const expandedFieldId =
                expandedCell && expandedCell.startsWith(ev.id + '-')
                  ? expandedCell.slice(ev.id.length + 1)
                  : null
              const windowMetric = eventWindowMetricsByEvent.get(ev.id)
              return (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  selected={selectedSet.has(ev.id)}
                  hideType={!!activeEt}
                  hideTags={hideTags}
                  fieldColumns={visibleFieldColumns}
                  metaFields={visibleMetaFields}
                  slug={slug!}
                  canMoveUp={idx > 0}
                  canMoveDown={idx >= 0 && idx < visibleEventIds.length - 1}
                  expandedFieldId={expandedFieldId}
                  rowSignal={eventRowSignals.get(ev.id)}
                  windowTotal={windowMetric?.total_count}
                  windowData={windowMetric?.data ?? EMPTY_WINDOW_POINTS}
                  getFieldValue={getFieldValue}
                  onToggleSelected={toggleEventSelected}
                  onToggleExpanded={onToggleExpandedCell}
                  onRowAction={onRowAction}
                />
              )
            })}
            {virtualize && virtualItems.length > 0 && totalVirtualSize > virtualItems[virtualItems.length - 1].end && (
              <tr aria-hidden style={{ height: totalVirtualSize - virtualItems[virtualItems.length - 1].end }}>
                <td colSpan={colCount} />
              </tr>
            )}
            {events.length === 0 && (
              <TableRow>
                <TableCell colSpan={99}>
                  <EmptyState icon={Calendar} title="No events yet" description="Create your first event to get started." />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      </SortableContext>
      </DndContext>
      </TooltipProvider>
        </>
      )}
    </div>
  )
}

/* ── Event Form ────────────────────────────────────────────────────────── */

function EventForm({
  slug,
  eventTypes,
  metaFields,
  projectVariables,
  event,
  defaultEventTypeId,
  onClose,
}: {
  slug: string
  eventTypes: EventType[]
  metaFields: MetaFieldDefinition[]
  projectVariables: Variable[]
  event: TEvent | null
  defaultEventTypeId?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [etId, setEtId] = useState(event?.event_type_id ?? defaultEventTypeId ?? '')
  const [name, setName] = useState(event?.name ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [implemented, setImplemented] = useState(event?.implemented ?? false)
  const [tags, setTags] = useState<string[]>(event?.tags?.map(t => t.name) ?? [])
  const [tagInput, setTagInput] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!event) return {}
    return Object.fromEntries(event.field_values.map(fv => [fv.field_definition_id, fv.value]))
  })
  const [metaValues, setMetaValues] = useState<Record<string, string>>(() => {
    if (!event) return {}
    return Object.fromEntries(event.meta_values.map(mv => [mv.meta_field_definition_id, mv.value]))
  })

  const selectedEt = eventTypes.find(e => e.id === etId)
  const sortedFields = useMemo(
    () => selectedEt ? [...selectedEt.field_definitions].sort((a, b) => a.order - b.order) : [],
    [selectedEt],
  )

  const varSuggestions = useMemo(() => {
    return projectVariables.map(v => ({ name: v.name, label: v.description || v.name }))
  }, [projectVariables])

  const createMut = useMutation({
    mutationFn: () => {
      const payload = {
        event_type_id: etId,
        name,
        description,
        implemented,
        tags,
        field_values: Object.entries(fieldValues)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => ({ field_definition_id: k, value: v })),
        meta_values: Object.entries(metaValues)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => ({ meta_field_definition_id: k, value: v })),
      }
      return event
        ? eventsApi.update(slug, event.id, payload)
        : eventsApi.create(slug, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', slug] })
      qc.invalidateQueries({ queryKey: ['eventTags', slug] })
      onClose()
    },
  })

  return (
    <Sheet open onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="flex flex-col gap-4 h-full">
          <SheetHeader>
            <SheetTitle>{event ? 'Edit Event' : 'New Event'}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 px-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Event Type</Label>
                <select
                  value={etId}
                  onChange={e => { setEtId(e.target.value); setFieldValues({}) }}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  required
                  disabled={!!event}
                >
                  <option value="">Select type...</option>
                  {eventTypes.map(et => <option key={et.id} value={et.id}>{et.display_name}</option>)}
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Home Page View" required />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="form-impl"
                checked={implemented}
                onCheckedChange={c => setImplemented(!!c)}
              />
              <Label htmlFor="form-impl" className="text-sm cursor-pointer">Implemented</Label>
            </div>

            {/* Tags */}
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div className="flex gap-1 flex-wrap mb-1">
                {tags.map(t => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="text-muted-foreground hover:text-foreground ml-0.5">&times;</button>
                  </Badge>
                ))}
                {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
              </div>
              <Input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    const t = tagInput.trim().toLowerCase()
                    if (!tags.includes(t)) setTags([...tags, t])
                    setTagInput('')
                  }
                }}
                placeholder="Type tag + Enter"
              />
            </div>

            {/* Dynamic fields */}
            {sortedFields.length > 0 && (
              <div>
                <Separator className="mb-3" />
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Fields</h4>
                <div className="grid grid-cols-2 gap-3">
                  {sortedFields.map(f => (
                    <div key={f.id} className="grid gap-1.5">
                      <Label className="text-xs">
                        {f.display_name}
                        {f.is_required && <span className="text-destructive ml-0.5">*</span>}
                        <span className="ml-1 text-muted-foreground font-normal">({f.field_type})</span>
                      </Label>
                      {f.field_type === 'boolean' ? (
                        <select
                          value={fieldValues[f.id] ?? ''}
                          onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                          required={f.is_required}
                        >
                          <option value="">—</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : f.field_type === 'enum' && f.enum_options ? (
                        <select
                          value={fieldValues[f.id] ?? ''}
                          onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                          required={f.is_required}
                        >
                          <option value="">—</option>
                          {f.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : f.field_type === 'json' ? (
                        <JsonEditor
                          value={fieldValues[f.id] ?? ''}
                          onChange={v => setFieldValues({ ...fieldValues, [f.id]: v })}
                          required={f.is_required}
                          variables={varSuggestions}
                        />
                      ) : (
                        <VariableInput
                          value={fieldValues[f.id] ?? ''}
                          onChange={v => setFieldValues({ ...fieldValues, [f.id]: v })}
                          variables={varSuggestions}
                          required={f.is_required}
                          type={f.field_type === 'number' ? 'number' : f.field_type === 'url' ? 'url' : 'text'}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic meta fields */}
            {metaFields.length > 0 && (
              <div>
                <Separator className="mb-3" />
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Meta</h4>
                <div className="grid grid-cols-2 gap-3">
                  {metaFields.map(mf => (
                    <div key={mf.id} className="grid gap-1.5">
                      <Label className="text-xs">
                        {mf.display_name}
                        {mf.is_required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      {mf.field_type === 'boolean' ? (
                        <select
                          value={metaValues[mf.id] ?? ''}
                          onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                        >
                          <option value="">—</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : mf.field_type === 'enum' && mf.enum_options ? (
                        <select
                          value={metaValues[mf.id] ?? ''}
                          onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                        >
                          <option value="">—</option>
                          {mf.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <>
                          <VariableInput
                            value={metaValues[mf.id] ?? ''}
                            onChange={v => setMetaValues({ ...metaValues, [mf.id]: v })}
                            variables={varSuggestions}
                            type={mf.field_type === 'url' ? 'url' : mf.field_type === 'date' ? 'date' : 'text'}
                          />
                          {mf.link_template && (
                            <p className="text-[11px] text-muted-foreground">
                              Uses link template with <span className="font-mono">{META_FIELD_LINK_PLACEHOLDER}</span>.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
          </div>

          <SheetFooter className="px-6 pb-6">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>{event ? 'Update' : 'Create'}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/* ── Variable-aware text input ─────────────────────────────────────────── */

function VariableInput({
  value, onChange, variables, required, type,
}: {
  value: string
  onChange: (v: string) => void
  variables: { name: string; label: string }[]
  required?: boolean
  type?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [filter, setFilter] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [insertPos, setInsertPos] = useState(0)

  const filtered = useMemo(
    () => variables.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()) || v.label.toLowerCase().includes(filter.toLowerCase())),
    [variables, filter],
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const insert = useCallback((varName: string) => {
    const before = value.slice(0, insertPos)
    const after = value.slice(ref.current?.selectionEnd ?? insertPos)
    const dollarIdx = before.lastIndexOf('$')
    const newValue = before.slice(0, dollarIdx) + '${' + varName + '}' + after
    onChange(newValue)
    setShowMenu(false)
    setTimeout(() => {
      const pos = dollarIdx + varName.length + 3
      ref.current?.setSelectionRange(pos, pos)
      ref.current?.focus()
    }, 0)
  }, [value, insertPos, onChange])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    const cursor = e.target.selectionStart ?? v.length
    onChange(v)

    const before = v.slice(0, cursor)
    const dollarIdx = before.lastIndexOf('$')
    if (dollarIdx >= 0) {
      const afterDollar = before.slice(dollarIdx + 1)
      if (!afterDollar.includes('}') && !/\s/.test(afterDollar)) {
        setFilter(afterDollar.replace(/^\{/, ''))
        setInsertPos(cursor)
        setShowMenu(true)
        setHighlightIdx(0)
        return
      }
    }
    setShowMenu(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMenu) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered.length > 0) {
        e.preventDefault()
        insert(filtered[highlightIdx].name)
      }
    } else if (e.key === 'Escape') {
      setShowMenu(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        required={required}
        type={type}
      />
      {showMenu && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {filtered.map((v, i) => (
            <button
              key={v.name}
              type="button"
              onMouseDown={e => { e.preventDefault(); insert(v.name) }}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${i === highlightIdx ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'}`}
            >
              <code className="font-mono text-primary">${'{'}${v.name}{'}'}</code>
              <span className="text-muted-foreground">{v.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── JSON field editor ─────────────────────────────────────────────────── */

function validateJsonWithVars(text: string): string | null {
  if (!text.trim()) return null
  if (!text.includes('${')) {
    try { JSON.parse(text); return null } catch (e) { return (e as Error).message }
  }
  const safe = text.replace(/\$\{[^}]*\}/g, '"__var__"')
  try { JSON.parse(safe); return null } catch (e) { return (e as Error).message }
}

function JsonEditor({
  value, onChange, required, variables = [],
}: {
  value: string
  onChange: (v: string) => void
  required?: boolean
  variables?: { name: string; label: string }[]
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [filter, setFilter] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [insertPos, setInsertPos] = useState(0)
  const [raw, setRaw] = useState(() => {
    if (!value) return ''
    if (!value.includes('${')) {
      try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
    }
    return value
  })

  const filtered = useMemo(
    () => variables.filter(v => v.name.toLowerCase().includes(filter.toLowerCase()) || v.label.toLowerCase().includes(filter.toLowerCase())),
    [variables, filter],
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const insertVar = useCallback((varName: string) => {
    const before = raw.slice(0, insertPos)
    const after = raw.slice(textareaRef.current?.selectionEnd ?? insertPos)
    const dollarIdx = before.lastIndexOf('$')
    const newValue = before.slice(0, dollarIdx) + '${' + varName + '}' + after
    setRaw(newValue)
    const err = validateJsonWithVars(newValue)
    onChange(newValue)
    setError(err)
    setShowMenu(false)
    setTimeout(() => {
      const pos = dollarIdx + varName.length + 3
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }, [raw, insertPos, onChange])

  const handleChange = (v: string) => {
    const cursor = textareaRef.current?.selectionStart ?? v.length
    setRaw(v)
    if (!v.trim()) {
      onChange('')
      setError(null)
      setShowMenu(false)
      return
    }
    const err = validateJsonWithVars(v)
    onChange(v)
    setError(err)

    if (variables.length > 0) {
      const before = v.slice(0, cursor)
      const dollarIdx = before.lastIndexOf('$')
      if (dollarIdx >= 0) {
        const afterDollar = before.slice(dollarIdx + 1)
        if (!afterDollar.includes('}') && !/\s/.test(afterDollar)) {
          setFilter(afterDollar.replace(/^\{/, ''))
          setInsertPos(cursor)
          setShowMenu(true)
          setHighlightIdx(0)
          return
        }
      }
      setShowMenu(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMenu) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filtered.length > 0) {
        e.preventDefault()
        insertVar(filtered[highlightIdx].name)
      }
    } else if (e.key === 'Escape') {
      setShowMenu(false)
    }
  }

  const handleFormat = () => {
    if (!raw.trim()) return
    if (!raw.includes('${')) {
      try {
        const formatted = JSON.stringify(JSON.parse(raw), null, 2)
        setRaw(formatted)
        onChange(formatted)
        setError(null)
      } catch { /* keep as is */ }
      return
    }
    const placeholders: string[] = []
    const safe = raw.replace(/\$\{[^}]*\}/g, (match) => {
      const idx = placeholders.length
      placeholders.push(match)
      return `"__TRIPL_VAR_${idx}__"`
    })
    try {
      let formatted = JSON.stringify(JSON.parse(safe), null, 2)
      placeholders.forEach((ph, idx) => {
        formatted = formatted.replace(`"__TRIPL_VAR_${idx}__"`, ph)
      })
      setRaw(formatted)
      onChange(formatted)
      setError(null)
    } catch { /* keep as is */ }
  }

  return (
    <div className="space-y-1">
      <div ref={wrapperRef} className="relative">
        <Textarea
          ref={textareaRef}
          value={raw}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`font-mono text-xs ${error ? 'border-destructive' : ''}`}
          rows={4}
          placeholder='{ "key": "value" }'
          required={required}
          spellCheck={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleFormat}
          className="absolute right-1.5 top-1.5 h-6 text-[10px]"
        >
          Format
        </Button>
        {showMenu && filtered.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
            {filtered.map((v, i) => (
              <button
                key={v.name}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertVar(v.name) }}
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs ${i === highlightIdx ? 'bg-accent text-accent-foreground' : 'text-popover-foreground hover:bg-accent/50'}`}
              >
                <code className="font-mono text-primary">${'{'}${v.name}{'}'}</code>
                <span className="text-muted-foreground">{v.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
