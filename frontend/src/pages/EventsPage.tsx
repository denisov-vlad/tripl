import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '../api/events'
import { eventTypesApi } from '../api/eventTypes'
import { metaFieldsApi } from '../api/metaFields'
import { variablesApi } from '../api/variables'
import { useConfirm } from '../hooks/useConfirm'
import type { Event as TEvent, EventType, FieldDefinition, MetaFieldDefinition, Variable } from '../types'

export default function EventsPage() {
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterImplemented, setFilterImplemented] = useState<boolean | undefined>(undefined)
  const [filterTag, setFilterTag] = useState<string>('')
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [metaFilters, setMetaFilters] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TEvent | null>(null)
  const { confirm, dialog } = useConfirm()

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

  const filterEtId = activeTab === 'all' ? undefined : activeTab

  const { data: eventsData } = useQuery({
    queryKey: ['events', slug, filterEtId, search, filterImplemented, filterTag],
    queryFn: () => eventsApi.list(slug!, {
      event_type_id: filterEtId,
      search: search || undefined,
      implemented: filterImplemented,
      tag: filterTag || undefined,
    }),
    enabled: !!slug,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eventsApi.del(slug!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const toggleImplementedMut = useMutation({
    mutationFn: ({ id, implemented }: { id: string; implemented: boolean }) =>
      eventsApi.update(slug!, id, { implemented }),
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
    let filtered = rawEvents
    const hasFieldFilter = Object.values(fieldFilters).some(v => v !== '')
    const hasMetaFilter = Object.values(metaFilters).some(v => v !== '')
    if (!hasFieldFilter && !hasMetaFilter) return filtered

    return filtered.filter(ev => {
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

  const hasActiveFilters = filterImplemented !== undefined || filterTag !== '' ||
    Object.values(fieldFilters).some(v => v !== '') ||
    Object.values(metaFilters).some(v => v !== '')

  const clearAllFilters = () => {
    setFilterImplemented(undefined)
    setFilterTag('')
    setFieldFilters({})
    setMetaFilters({})
  }

  return (
    <div>
      {dialog}

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          Events <span className="page-subtitle">({total})</span>
        </h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditingEvent(null) }}
          className="btn-primary"
        >
          + New Event
        </button>
      </div>

      {/* Tabs + search */}
      <div className="flex items-end gap-4 mb-4">
        <div className="tabs flex-1">
          <button
            onClick={() => setActiveTab('all')}
            className={activeTab === 'all' ? 'tab-active' : 'tab-inactive'}
          >
            All
          </button>
          {eventTypes.map((et: EventType) => (
            <button
              key={et.id}
              onClick={() => setActiveTab(et.id)}
              className={activeTab === et.id ? 'tab-active' : 'tab-inactive'}
            >
              <span className="type-dot-lg" style={{ backgroundColor: et.color }} />
              {et.display_name}
            </button>
          ))}
        </div>
        <input
          placeholder="Search events..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filters */}
      <div className="filter-bar mb-4">
        <span className="section-label">Filters:</span>
        <select
          value={filterImplemented === undefined ? '' : String(filterImplemented)}
          onChange={e => setFilterImplemented(e.target.value === '' ? undefined : e.target.value === 'true')}
          className="filter-select"
        >
          <option value="">All statuses</option>
          <option value="true">Implemented</option>
          <option value="false">Not implemented</option>
        </select>
        <select
          value={filterTag}
          onChange={e => setFilterTag(e.target.value)}
          className="filter-select"
        >
          <option value="">All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="filter-clear">
            Clear filters
          </button>
        )}
      </div>

      {/* Event Form */}
      {(showForm || editingEvent) && slug && (
        <EventForm
          slug={slug}
          eventTypes={eventTypes}
          metaFields={metaFields}
          projectVariables={variables}
          event={editingEvent}
          defaultEventTypeId={activeTab !== 'all' ? activeTab : undefined}
          onClose={() => { setShowForm(false); setEditingEvent(null) }}
        />
      )}

      {/* Events Table */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th className="w-16">Impl</th>
              <th>Tags</th>
              {fieldColumns.map(f => (
                <th key={f.id}>{f.display_name}</th>
              ))}
              {metaFields.map((mf: MetaFieldDefinition) => (
                <th key={mf.id} className="meta-col">{mf.display_name}</th>
              ))}
              <th className="w-28"></th>
            </tr>
            {/* Column filter row */}
            {(fieldColumns.length > 0 || metaFields.length > 0) && (
              <tr className="bg-gray-50/40">
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                {fieldColumns.map(f => (
                  <td key={f.id} className="py-1.5 px-4">
                    {fieldEnumOptions[f.id] ? (
                      <select
                        value={fieldFilters[f.id] ?? ''}
                        onChange={e => setFieldFilters({ ...fieldFilters, [f.id]: e.target.value })}
                        className="filter-select text-[11px]"
                      >
                        <option value="">All</option>
                        {Array.from(fieldEnumOptions[f.id]).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : f.field_type !== 'json' ? (
                      <input
                        value={fieldFilters[f.id] ?? ''}
                        onChange={e => setFieldFilters({ ...fieldFilters, [f.id]: e.target.value })}
                        className="filter-input text-[11px]"
                        placeholder="Filter..."
                      />
                    ) : null}
                  </td>
                ))}
                {metaFields.map((mf: MetaFieldDefinition) => (
                  <td key={mf.id} className="py-1.5 px-4">
                    {mf.field_type === 'enum' && mf.enum_options ? (
                      <select
                        value={metaFilters[mf.id] ?? ''}
                        onChange={e => setMetaFilters({ ...metaFilters, [mf.id]: e.target.value })}
                        className="filter-select text-[11px]"
                      >
                        <option value="">All</option>
                        {mf.enum_options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : mf.field_type === 'boolean' ? (
                      <select
                        value={metaFilters[mf.id] ?? ''}
                        onChange={e => setMetaFilters({ ...metaFilters, [mf.id]: e.target.value })}
                        className="filter-select text-[11px]"
                      >
                        <option value="">All</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        value={metaFilters[mf.id] ?? ''}
                        onChange={e => setMetaFilters({ ...metaFilters, [mf.id]: e.target.value })}
                        className="filter-input text-[11px]"
                        placeholder="Filter..."
                      />
                    )}
                  </td>
                ))}
                <td></td>
              </tr>
            )}
          </thead>
          <tbody>
            {events.map((ev: TEvent) => {
              const mvMap = Object.fromEntries(ev.meta_values.map(mv => [mv.meta_field_definition_id, mv.value]))

              return (
                <tr key={ev.id}>
                  <td className="cell-name">{ev.name}</td>
                  <td>
                    <span
                      className="event-type-badge"
                      style={{ backgroundColor: ev.event_type.color + '18', color: ev.event_type.color }}
                    >
                      <span className="type-dot" style={{ backgroundColor: ev.event_type.color }} />
                      {ev.event_type.name}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => toggleImplementedMut.mutate({ id: ev.id, implemented: !ev.implemented })}
                      className={ev.implemented ? 'impl-check-on' : 'impl-check-off'}
                      title={ev.implemented ? 'Implemented' : 'Not implemented'}
                    >
                      {ev.implemented && <span className="text-xs leading-none">✓</span>}
                    </button>
                  </td>
                  <td>
                    <div className="tags-wrap">
                      {ev.tags.map(t => (
                        <span key={t.id} className="tag-neutral">{t.name}</span>
                      ))}
                      {ev.tags.length === 0 && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  {fieldColumns.map(f => (
                    <td key={f.id} className="cell-truncate">
                      {getFieldValue(ev, f)}
                    </td>
                  ))}
                  {metaFields.map((mf: MetaFieldDefinition) => (
                    <td key={mf.id} className="cell-muted max-w-52 truncate">
                      {mf.field_type === 'url' && mvMap[mf.id] ? (
                        <a href={mvMap[mf.id]} target="_blank" rel="noopener noreferrer" className="link">
                          Link
                        </a>
                      ) : mf.field_type === 'boolean' && mvMap[mf.id] ? (
                        <span className={mvMap[mf.id] === 'true' ? 'badge-green' : 'badge-gray'}>
                          {mvMap[mf.id] === 'true' ? 'Yes' : 'No'}
                        </span>
                      ) : mvMap[mf.id] ?? ''}
                    </td>
                  ))}
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingEvent(ev); setShowForm(false) }}
                        className="btn-edit-sm"
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDelete(ev)} className="btn-danger-sm">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr><td colSpan={99} className="table-empty">No events yet.</td></tr>
            )}
          </tbody>
        </table>
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
    <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="form-card">
      <h3 className="text-lg font-semibold text-gray-900">{event ? 'Edit Event' : 'New Event'}</h3>

      <div className="form-grid-2">
        <div>
          <label className="field-label">Event Type</label>
          <select
            value={etId}
            onChange={e => { setEtId(e.target.value); setFieldValues({}) }}
            className="select"
            required
            disabled={!!event}
          >
            <option value="">Select type...</option>
            {eventTypes.map(et => <option key={et.id} value={et.id}>{et.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="input"
            placeholder="e.g. Home Page View"
            required
          />
        </div>
      </div>

      <div>
        <label className="field-label">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="textarea"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="text-sm flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={implemented}
            onChange={e => setImplemented(e.target.checked)}
            className="checkbox"
          />
          <span className="text-gray-700">Implemented</span>
        </label>
      </div>

      {/* Tags */}
      <div>
        <label className="field-label">Tags</label>
        <div className="tags-wrap mb-2">
          {tags.map(t => (
            <span key={t} className="tag">
              {t}
              <button type="button" onClick={() => setTags(tags.filter(x => x !== t))} className="tag-remove">&times;</button>
            </span>
          ))}
          {tags.length === 0 && <span className="text-xs text-gray-400">No tags added</span>}
        </div>
        <input
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
          className="input"
          placeholder="Type a tag and press Enter"
        />
      </div>

      {/* Dynamic fields */}
      {sortedFields.length > 0 && (
        <div>
          <h4 className="section-label mb-3">Fields</h4>
          <div className="form-grid-2">
            {sortedFields.map(f => (
              <div key={f.id}>
                <label className={`field-label${f.is_required ? ' field-label-required' : ''}`}>
                  {f.display_name}
                  <span className="ml-1 text-gray-400">({f.field_type})</span>
                </label>
                {f.field_type === 'boolean' ? (
                  <select
                    value={fieldValues[f.id] ?? ''}
                    onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                    className="select"
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
                    className="select"
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
          <h4 className="section-label text-indigo-500 mb-3">Meta</h4>
          <div className="form-grid-2">
            {metaFields.map(mf => (
              <div key={mf.id}>
                <label className={`field-label${mf.is_required ? ' field-label-required' : ''}`}>
                  {mf.display_name}
                </label>
                {mf.field_type === 'boolean' ? (
                  <select
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className="select"
                  >
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : mf.field_type === 'enum' && mf.enum_options ? (
                  <select
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className="select"
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

      <div className="form-actions">
        <button type="submit" className="btn-primary">
          {event ? 'Update' : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary">
          Cancel
        </button>
      </div>
      {createMut.isError && <p className="form-error">{(createMut.error as Error).message}</p>}
    </form>
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
      <input
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="input"
        required={required}
        type={type}
      />
      {showMenu && filtered.length > 0 && (
        <div className="dropdown-menu">
          {filtered.map((v, i) => (
            <button
              key={v.name}
              type="button"
              onMouseDown={e => { e.preventDefault(); insert(v.name) }}
              className={i === highlightIdx ? 'dropdown-item-active' : 'dropdown-item-inactive'}
            >
              <code className="var-code">${'{'}${v.name}{'}'}</code>
              <span className="var-label">{v.label}</span>
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
        <textarea
          ref={textareaRef}
          value={raw}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`textarea-mono ${error ? 'input-error' : ''}`}
          rows={4}
          placeholder='{ "key": "value" }'
          required={required}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={handleFormat}
          className="json-format-btn"
          title="Format JSON"
        >
          Format
        </button>
        {showMenu && filtered.length > 0 && (
          <div className="dropdown-menu">
            {filtered.map((v, i) => (
              <button
                key={v.name}
                type="button"
                onMouseDown={e => { e.preventDefault(); insertVar(v.name) }}
                className={i === highlightIdx ? 'dropdown-item-active' : 'dropdown-item-inactive'}
              >
                <code className="var-code">${'{'}${v.name}{'}'}</code>
                <span className="var-label">{v.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="json-error">{error}</p>}
    </div>
  )
}
