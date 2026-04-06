import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '@/api/events'
import { eventTypesApi } from '@/api/eventTypes'
import { metaFieldsApi } from '@/api/metaFields'
import { variablesApi } from '@/api/variables'
import { useConfirm } from '@/hooks/useConfirm'
import type { Event as TEvent, EventType, FieldDefinition, MetaFieldDefinition, Variable } from '@/types'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { Calendar, Plus, Pencil, Trash2, Search, X, Filter, Archive, ArchiveRestore } from 'lucide-react'

export default function EventsPage() {
  const { slug, tab: urlTab, eventId: urlEventId } = useParams<{ slug: string; tab?: string; eventId?: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()

  // Derive active tab from URL (default 'all')
  const activeTab = urlTab || 'all'
  const setActiveTab = useCallback((tab: string) => {
    const path = tab === 'all' ? `/p/${slug}/events` : `/p/${slug}/events/${tab}`
    navigate(path + (searchParams.toString() ? `?${searchParams}` : ''), { replace: true })
  }, [slug, navigate, searchParams])

  // Derive filters from URL search params
  const search = searchParams.get('q') || ''
  const setSearch = useCallback((v: string) => {
    setSearchParams(prev => { v ? prev.set('q', v) : prev.delete('q'); return prev }, { replace: true })
  }, [setSearchParams])

  const filterImplemented = searchParams.has('implemented') ? searchParams.get('implemented') === 'true' : undefined
  const setFilterImplemented = useCallback((v: boolean | undefined) => {
    setSearchParams(prev => { v !== undefined ? prev.set('implemented', String(v)) : prev.delete('implemented'); return prev }, { replace: true })
  }, [setSearchParams])

  const filterTag = searchParams.get('tag') || ''
  const setFilterTag = useCallback((v: string) => {
    setSearchParams(prev => { v ? prev.set('tag', v) : prev.delete('tag'); return prev }, { replace: true })
  }, [setSearchParams])

  const filterReviewed = searchParams.has('reviewed') ? searchParams.get('reviewed') === 'true' : undefined
  const setFilterReviewed = useCallback((v: boolean | undefined) => {
    setSearchParams(prev => { v !== undefined ? prev.set('reviewed', String(v)) : prev.delete('reviewed'); return prev }, { replace: true })
  }, [setSearchParams])

  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [metaFilters, setMetaFilters] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TEvent | null>(null)
  const [expandedCell, setExpandedCell] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  // Open event from URL param
  const openEventId = urlEventId || null

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
  const { data: variables = [] } = useQuery({
    queryKey: ['variables', slug],
    queryFn: () => variablesApi.list(slug!),
    enabled: !!slug,
  })
  const { data: allTags = [] } = useQuery({
    queryKey: ['eventTags', slug],
    queryFn: () => eventsApi.tags(slug!),
    enabled: !!slug,
  })

  const filterEtId = activeTab === 'all' || activeTab === 'review' || activeTab === 'archived' ? undefined : activeTab
  const filterReviewedForQuery = activeTab === 'review' ? false : filterReviewed
  const filterArchivedForQuery = activeTab === 'archived' ? true : false

  const { data: eventsData } = useQuery({
    queryKey: ['events', slug, filterEtId, search, filterImplemented, filterTag, filterReviewedForQuery, filterArchivedForQuery],
    queryFn: () => eventsApi.list(slug!, {
      event_type_id: filterEtId,
      search: search || undefined,
      implemented: filterImplemented,
      reviewed: filterReviewedForQuery,
      archived: filterArchivedForQuery,
      tag: filterTag || undefined,
    }),
    enabled: !!slug,
  })

  const { data: unreviewedData } = useQuery({
    queryKey: ['events', slug, 'unreviewedCount'],
    queryFn: () => eventsApi.list(slug!, { reviewed: false, archived: false, limit: 1 }),
    enabled: !!slug,
  })
  const unreviewedCount = unreviewedData?.total ?? 0

  const { data: archivedData } = useQuery({
    queryKey: ['events', slug, 'archivedCount'],
    queryFn: () => eventsApi.list(slug!, { archived: true, limit: 1 }),
    enabled: !!slug,
  })
  const archivedCount = archivedData?.total ?? 0

  // Load event from URL if eventId is present
  const { data: urlEvent } = useQuery({
    queryKey: ['event', slug, openEventId],
    queryFn: () => eventsApi.get(slug!, openEventId!),
    enabled: !!slug && !!openEventId,
  })

  // Sync URL event to editingEvent state
  useEffect(() => {
    if (urlEvent && openEventId) {
      setEditingEvent(urlEvent)
    } else if (!openEventId) {
      setEditingEvent(null)
    }
  }, [urlEvent, openEventId])

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

  const handleDelete = async (ev: TEvent) => {
    const ok = await confirm({
      title: 'Delete event',
      message: `Are you sure you want to delete "${ev.name}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(ev.id)
  }

  const rawEvents = eventsData?.items ?? []
  const total = eventsData?.total ?? 0

  const activeEt = eventTypes.find((e: EventType) => e.id === activeTab) ?? null

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
        const fv = fieldFilters[col.id]
        if (!fv) continue
        const val = getFieldValue(ev, col)
        if (col.field_type === 'enum' || col.field_type === 'boolean') {
          if (val !== fv) return false
        } else {
          if (!val.toLowerCase().includes(fv.toLowerCase())) return false
        }
      }
      for (const mf of metaFields) {
        const mv = metaFilters[mf.id]
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

  const hasActiveFilters = filterImplemented !== undefined || filterTag !== '' || filterReviewed !== undefined ||
    Object.values(fieldFilters).some(v => v !== '') ||
    Object.values(metaFilters).some(v => v !== '')

  const clearAllFilters = () => {
    setFilterImplemented(undefined)
    setFilterReviewed(undefined)
    setFilterTag('')
    setFieldFilters({})
    setMetaFilters({})
  }

  return (
    <div>
      {dialog}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Events <span className="text-muted-foreground font-normal text-lg">({total})</span>
          </h1>
        </div>
        <Button onClick={() => {
          if (openEventId) {
            // Navigate away from event URL, then open new form
            const path = activeTab === 'all' ? `/p/${slug}/events` : `/p/${slug}/events/${activeTab}`
            navigate(path + (searchParams.toString() ? `?${searchParams}` : ''), { replace: true })
          }
          setEditingEvent(null)
          setShowForm(v => !v)
        }}>
          <Plus className="mr-2 h-4 w-4" />
          New Event
        </Button>
      </div>

      {/* Tabs + search */}
      <div className="flex items-end gap-4 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="review" className="text-xs gap-1.5">
              Review
              {unreviewedCount > 0 && (
                <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] leading-none">{unreviewedCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs gap-1.5">
              Archived
              {archivedCount > 0 && (
                <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] leading-none">{archivedCount}</Badge>
              )}
            </TabsTrigger>
            {eventTypes.map((et: EventType) => (
              <TabsTrigger key={et.id} value={et.id} className="text-xs gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: et.color }} />
                {et.display_name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 w-56"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                value={fieldFilters[f.id] ?? ''}
                onChange={e => setFieldFilters({ ...fieldFilters, [f.id]: e.target.value })}
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
                value={fieldFilters[f.id] ?? ''}
                onChange={e => setFieldFilters({ ...fieldFilters, [f.id]: e.target.value })}
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
                value={metaFilters[mf.id] ?? ''}
                onChange={e => setMetaFilters({ ...metaFilters, [mf.id]: e.target.value })}
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
                value={metaFilters[mf.id] ?? ''}
                onChange={e => setMetaFilters({ ...metaFilters, [mf.id]: e.target.value })}
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
              value={metaFilters[mf.id] ?? ''}
              onChange={e => setMetaFilters({ ...metaFilters, [mf.id]: e.target.value })}
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
      </div>

      {/* Event Form (Sheet) */}
      {(showForm || editingEvent) && slug && (
        <EventForm
          slug={slug}
          eventTypes={eventTypes}
          metaFields={metaFields}
          projectVariables={variables}
          event={editingEvent}
          defaultEventTypeId={activeTab !== 'all' ? activeTab : undefined}
          onClose={closeEvent}
        />
      )}

      {/* Events Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-16">Impl</TableHead>
              <TableHead className="w-16">Rev</TableHead>
              <TableHead>Tags</TableHead>
              {fieldColumns.map(f => (
                <TableHead key={f.id}>{f.display_name}</TableHead>
              ))}
              {metaFields.map((mf: MetaFieldDefinition) => (
                <TableHead key={mf.id} className="text-muted-foreground">{mf.display_name}</TableHead>
              ))}
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev: TEvent) => {
              const mvMap = Object.fromEntries(ev.meta_values.map(mv => [mv.meta_field_definition_id, mv.value]))

              return (
                <TableRow key={ev.id}>
                  <TableCell className="font-medium">
                    <button className="hover:underline underline-offset-4 text-left" onClick={() => openEvent(ev)}>
                      {ev.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1.5 font-mono text-[11px]" style={{
                      borderColor: ev.event_type.color + '40',
                      color: ev.event_type.color,
                      backgroundColor: ev.event_type.color + '0a',
                    }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ev.event_type.color }} />
                      {ev.event_type.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={ev.implemented}
                      onCheckedChange={checked =>
                        toggleImplementedMut.mutate({ id: ev.id, implemented: !!checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={ev.reviewed}
                      onCheckedChange={checked =>
                        toggleReviewedMut.mutate({ id: ev.id, reviewed: !!checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {ev.tags.map(t => (
                        <Badge key={t.id} variant="secondary" className="text-[10px]">{t.name}</Badge>
                      ))}
                      {ev.tags.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  {fieldColumns.map(f => {
                    let val = getFieldValue(ev, f)
                    // Format float-like values as integers when no fractional part
                    if (val && /^-?\d+\.0+$/.test(val)) val = String(parseInt(val, 10))
                    const cellKey = `${ev.id}-${f.id}`
                    const isExpanded = expandedCell === cellKey
                    const isLong = typeof val === 'string' && val.length > 30
                    return (
                      <TableCell
                        key={f.id}
                        className={`text-xs ${isLong ? 'cursor-pointer' : ''} ${isExpanded ? '' : 'max-w-40'}`}
                        onClick={isLong ? () => setExpandedCell(isExpanded ? null : cellKey) : undefined}
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
                  {metaFields.map((mf: MetaFieldDefinition) => (
                    <TableCell key={mf.id} className="text-muted-foreground max-w-40 truncate text-xs">
                      {mf.field_type === 'url' && mvMap[mf.id] ? (
                        <a href={mvMap[mf.id]} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
                          Link
                        </a>
                      ) : mf.field_type === 'boolean' && mvMap[mf.id] ? (
                        <Badge variant={mvMap[mf.id] === 'true' ? 'success' : 'secondary'} className="text-[10px]">
                          {mvMap[mf.id] === 'true' ? 'Yes' : 'No'}
                        </Badge>
                      ) : mvMap[mf.id] ?? ''}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => openEvent(ev)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
                        title={ev.archived ? 'Unarchive' : 'Archive'}
                        onClick={() => toggleArchivedMut.mutate({ id: ev.id, archived: !ev.archived })}
                      >
                        {ev.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(ev)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
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
                        <VariableInput
                          value={metaValues[mf.id] ?? ''}
                          onChange={v => setMetaValues({ ...metaValues, [mf.id]: v })}
                          variables={varSuggestions}
                          type={mf.field_type === 'url' ? 'url' : mf.field_type === 'date' ? 'date' : 'text'}
                        />
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
