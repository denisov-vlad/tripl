import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '../api/events'
import { eventTypesApi } from '../api/eventTypes'
import { metaFieldsApi } from '../api/metaFields'
import { useConfirm } from '../hooks/useConfirm'
import type { Event as TEvent, EventType, FieldDefinition, MetaFieldDefinition } from '../types'

export default function EventsPage() {
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [search, setSearch] = useState('')
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

  const filterEtId = activeTab === 'all' ? undefined : activeTab

  const { data: eventsData } = useQuery({
    queryKey: ['events', slug, filterEtId, search],
    queryFn: () => eventsApi.list(slug!, {
      event_type_id: filterEtId,
      search: search || undefined,
    }),
    enabled: !!slug,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eventsApi.del(slug!, id),
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

  const events = eventsData?.items ?? []
  const total = eventsData?.total ?? 0

  // When a specific event type tab is selected, show its fields as columns
  const activeEt = eventTypes.find((e: EventType) => e.id === activeTab) ?? null
  // When "All" tab: collect unique fields across all types (by name)
  const fieldColumns: FieldDefinition[] = useMemo(() => {
    if (activeEt) return activeEt.field_definitions
    // Merge all field definitions, grouped by name to avoid duplicates
    const seen = new Map<string, FieldDefinition>()
    for (const et of eventTypes) {
      for (const fd of et.field_definitions) {
        if (!seen.has(fd.name)) seen.set(fd.name, fd)
      }
    }
    return Array.from(seen.values())
  }, [activeEt, eventTypes])

  // Build field definition lookup by id across all event types for the "all" view
  const allFieldDefs = useMemo(() => {
    const map = new Map<string, FieldDefinition>()
    for (const et of eventTypes) {
      for (const fd of et.field_definitions) {
        map.set(fd.id, fd)
      }
    }
    return map
  }, [eventTypes])

  return (
    <div>
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Events <span className="text-gray-400 text-lg font-normal">({total})</span>
        </h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditingEvent(null) }}
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
        >
          + New Event
        </button>
      </div>

      {/* Event type tabs + search */}
      <div className="flex items-end gap-4 mb-4">
        <div className="flex gap-1 border-b flex-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All
          </button>
          {eventTypes.map((et: EventType) => (
            <button
              key={et.id}
              onClick={() => setActiveTab(et.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition inline-flex items-center gap-2 ${
                activeTab === et.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: et.color }} />
              {et.display_name}
            </button>
          ))}
        </div>
        <input
          placeholder="Search events..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        />
      </div>

      {/* Event Form */}
      {(showForm || editingEvent) && slug && (
        <EventForm
          slug={slug}
          eventTypes={eventTypes}
          metaFields={metaFields}
          event={editingEvent}
          defaultEventTypeId={activeTab !== 'all' ? activeTab : undefined}
          onClose={() => { setShowForm(false); setEditingEvent(null) }}
        />
      )}

      {/* Events Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              {fieldColumns.map(f => (
                <th key={f.id} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{f.display_name}</th>
              ))}
              {metaFields.map((mf: MetaFieldDefinition) => (
                <th key={mf.id} className="px-4 py-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider">{mf.display_name}</th>
              ))}
              <th className="px-4 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((ev: TEvent) => {
              const fvMap = Object.fromEntries(ev.field_values.map(fv => [fv.field_definition_id, fv.value]))
              const mvMap = Object.fromEntries(ev.meta_values.map(mv => [mv.meta_field_definition_id, mv.value]))

              // For "all" tab, match field columns by name across different event types
              const getFieldValue = (col: FieldDefinition) => {
                // Direct match by id
                if (fvMap[col.id] !== undefined) return fvMap[col.id]
                // Match by name across event types (for "all" view)
                for (const fv of ev.field_values) {
                  const def = allFieldDefs.get(fv.field_definition_id)
                  if (def && def.name === col.name) return fv.value
                }
                return ''
              }

              return (
                <tr key={ev.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium text-gray-900">{ev.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md"
                      style={{ backgroundColor: ev.event_type.color + '18', color: ev.event_type.color }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ev.event_type.color }} />
                      {ev.event_type.name}
                    </span>
                  </td>
                  {fieldColumns.map(f => (
                    <td key={f.id} className="px-4 py-3 text-gray-600 max-w-52 truncate">
                      {getFieldValue(f)}
                    </td>
                  ))}
                  {metaFields.map((mf: MetaFieldDefinition) => (
                    <td key={mf.id} className="px-4 py-3 text-gray-500 max-w-52 truncate">
                      {mf.field_type === 'url' && mvMap[mf.id] ? (
                        <a href={mvMap[mf.id]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline">
                          Link
                        </a>
                      ) : mf.field_type === 'boolean' && mvMap[mf.id] ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${mvMap[mf.id] === 'true' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {mvMap[mf.id] === 'true' ? 'Yes' : 'No'}
                        </span>
                      ) : mvMap[mf.id] ?? ''}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingEvent(ev); setShowForm(false) }}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ev)}
                        className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr><td colSpan={99} className="text-center py-12 text-gray-400">No events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EventForm({
  slug,
  eventTypes,
  metaFields,
  event,
  defaultEventTypeId,
  onClose,
}: {
  slug: string
  eventTypes: EventType[]
  metaFields: MetaFieldDefinition[]
  event: TEvent | null
  defaultEventTypeId?: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [etId, setEtId] = useState(event?.event_type_id ?? defaultEventTypeId ?? '')
  const [name, setName] = useState(event?.name ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (!event) return {}
    return Object.fromEntries(event.field_values.map(fv => [fv.field_definition_id, fv.value]))
  })
  const [metaValues, setMetaValues] = useState<Record<string, string>>(() => {
    if (!event) return {}
    return Object.fromEntries(event.meta_values.map(mv => [mv.meta_field_definition_id, mv.value]))
  })

  const selectedEt = eventTypes.find(e => e.id === etId)

  const createMut = useMutation({
    mutationFn: () => {
      const payload = {
        event_type_id: etId,
        name,
        description,
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
      onClose()
    },
  })

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition'

  return (
    <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white border rounded-xl p-5 mb-6 space-y-5 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{event ? 'Edit Event' : 'New Event'}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Event Type</label>
          <select
            value={etId}
            onChange={e => { setEtId(e.target.value); setFieldValues({}) }}
            className={inputClass}
            required
            disabled={!!event}
          >
            <option value="">Select type...</option>
            {eventTypes.map(et => <option key={et.id} value={et.id}>{et.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Home Page View"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className={inputClass}
          rows={2}
        />
      </div>

      {/* Dynamic fields based on event type */}
      {selectedEt && selectedEt.field_definitions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Fields</h4>
          <div className="grid grid-cols-2 gap-4">
            {selectedEt.field_definitions.map(f => (
              <div key={f.id}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {f.display_name}
                  {f.is_required && <span className="text-red-500 ml-0.5">*</span>}
                  <span className="ml-1 text-gray-400">({f.field_type})</span>
                </label>
                {f.field_type === 'boolean' ? (
                  <select
                    value={fieldValues[f.id] ?? ''}
                    onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                    className={inputClass}
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
                    className={inputClass}
                    required={f.is_required}
                  >
                    <option value="">—</option>
                    {f.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    value={fieldValues[f.id] ?? ''}
                    onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                    className={inputClass}
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
          <h4 className="text-xs font-semibold text-indigo-500 uppercase mb-3">Meta</h4>
          <div className="grid grid-cols-2 gap-4">
            {metaFields.map(mf => (
              <div key={mf.id}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {mf.display_name}
                  {mf.is_required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {mf.field_type === 'boolean' ? (
                  <select
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : mf.field_type === 'enum' && mf.enum_options ? (
                  <select
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {mf.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className={inputClass}
                    type={mf.field_type === 'url' ? 'url' : mf.field_type === 'date' ? 'date' : 'text'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition">
          {event ? 'Update' : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
          Cancel
        </button>
      </div>
      {createMut.isError && <p className="text-red-600 text-sm">{(createMut.error as Error).message}</p>}
    </form>
  )
}
