import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventsApi } from '../api/events'
import { eventTypesApi } from '../api/eventTypes'
import { metaFieldsApi } from '../api/metaFields'
import type { Event as TEvent, EventType, FieldDefinition, MetaFieldDefinition } from '../types'

export default function EventsPage() {
  const { slug } = useParams<{ slug: string }>()
  const qc = useQueryClient()
  const [filterEtId, setFilterEtId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<TEvent | null>(null)

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
  const { data: eventsData } = useQuery({
    queryKey: ['events', slug, filterEtId, search],
    queryFn: () => eventsApi.list(slug!, {
      event_type_id: filterEtId || undefined,
      search: search || undefined,
    }),
    enabled: !!slug,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eventsApi.del(slug!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events', slug] }),
  })

  const events = eventsData?.items ?? []
  const total = eventsData?.total ?? 0

  // Build dynamic column headers
  const activeEt = filterEtId ? eventTypes.find((e: EventType) => e.id === filterEtId) : null
  const fieldColumns: FieldDefinition[] = activeEt?.field_definitions ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Events <span className="text-gray-400 text-lg font-normal">({total})</span></h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditingEvent(null) }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
        >
          + New Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filterEtId}
          onChange={e => setFilterEtId(e.target.value)}
          className="border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">All event types</option>
          {eventTypes.map((et: EventType) => (
            <option key={et.id} value={et.id}>{et.display_name}</option>
          ))}
        </select>
        <input
          placeholder="Search events..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded px-3 py-2 text-sm flex-1"
        />
      </div>

      {/* Event Form */}
      {(showForm || editingEvent) && slug && (
        <EventForm
          slug={slug}
          eventTypes={eventTypes}
          metaFields={metaFields}
          event={editingEvent}
          onClose={() => { setShowForm(false); setEditingEvent(null) }}
        />
      )}

      {/* Events Table */}
      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              {fieldColumns.map(f => (
                <th key={f.id} className="px-3 py-2">{f.display_name}</th>
              ))}
              {metaFields.map((mf: MetaFieldDefinition) => (
                <th key={mf.id} className="px-3 py-2 text-indigo-400">{mf.display_name}</th>
              ))}
              <th className="px-3 py-2 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev: TEvent) => {
              const fvMap = Object.fromEntries(ev.field_values.map(fv => [fv.field_definition_id, fv.value]))
              const mvMap = Object.fromEntries(ev.meta_values.map(mv => [mv.meta_field_definition_id, mv.value]))
              return (
                <tr key={ev.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{ev.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: ev.event_type.color + '20', color: ev.event_type.color }}
                    >
                      {ev.event_type.name}
                    </span>
                  </td>
                  {fieldColumns.map(f => (
                    <td key={f.id} className="px-3 py-2 text-gray-600 max-w-48 truncate">{fvMap[f.id] ?? ''}</td>
                  ))}
                  {metaFields.map((mf: MetaFieldDefinition) => (
                    <td key={mf.id} className="px-3 py-2 text-gray-500 max-w-48 truncate">
                      {mf.field_type === 'url' && mvMap[mf.id] ? (
                        <a href={mvMap[mf.id]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
                          Link
                        </a>
                      ) : mvMap[mf.id] ?? ''}
                    </td>
                  ))}
                  <td className="px-3 py-2 flex gap-2">
                    <button onClick={() => { setEditingEvent(ev); setShowForm(false) }} className="text-indigo-500 hover:text-indigo-700 text-xs">Edit</button>
                    <button onClick={() => { if (confirm(`Delete "${ev.name}"?`)) deleteMut.mutate(ev.id) }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr><td colSpan={99} className="text-center py-8 text-gray-400">No events yet.</td></tr>
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
  onClose,
}: {
  slug: string
  eventTypes: EventType[]
  metaFields: MetaFieldDefinition[]
  event: TEvent | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [etId, setEtId] = useState(event?.event_type_id ?? '')
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

  return (
    <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white border rounded-lg p-4 mb-6 space-y-4">
      <h3 className="font-semibold text-gray-800">{event ? 'Edit Event' : 'New Event'}</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Event Type</label>
          <select
            value={etId}
            onChange={e => { setEtId(e.target.value); setFieldValues({}) }}
            className="border rounded px-3 py-2 text-sm w-full"
            required
            disabled={!!event}
          >
            <option value="">Select type...</option>
            {eventTypes.map(et => <option key={et.id} value={et.id}>{et.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full"
            placeholder="e.g. Home Page View"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="border rounded px-3 py-2 text-sm w-full"
          rows={2}
        />
      </div>

      {/* Dynamic fields based on event type */}
      {selectedEt && selectedEt.field_definitions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Fields</h4>
          <div className="grid grid-cols-2 gap-3">
            {selectedEt.field_definitions.map(f => (
              <div key={f.id}>
                <label className="text-xs text-gray-500 block mb-1">
                  {f.display_name}
                  {f.is_required && <span className="text-red-500 ml-0.5">*</span>}
                  <span className="ml-1 text-gray-400">({f.field_type})</span>
                </label>
                {f.field_type === 'boolean' ? (
                  <select
                    value={fieldValues[f.id] ?? ''}
                    onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full"
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
                    className="border rounded px-3 py-2 text-sm w-full"
                    required={f.is_required}
                  >
                    <option value="">—</option>
                    {f.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    value={fieldValues[f.id] ?? ''}
                    onChange={e => setFieldValues({ ...fieldValues, [f.id]: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full"
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
          <h4 className="text-xs font-semibold text-indigo-500 uppercase mb-2">Meta</h4>
          <div className="grid grid-cols-2 gap-3">
            {metaFields.map(mf => (
              <div key={mf.id}>
                <label className="text-xs text-gray-500 block mb-1">
                  {mf.display_name}
                  {mf.is_required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {mf.field_type === 'boolean' ? (
                  <select
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full"
                  >
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : mf.field_type === 'enum' && mf.enum_options ? (
                  <select
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full"
                  >
                    <option value="">—</option>
                    {mf.enum_options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    value={metaValues[mf.id] ?? ''}
                    onChange={e => setMetaValues({ ...metaValues, [mf.id]: e.target.value })}
                    className="border rounded px-3 py-2 text-sm w-full"
                    type={mf.field_type === 'url' ? 'url' : mf.field_type === 'date' ? 'date' : 'text'}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
          {event ? 'Update' : 'Create'}
        </button>
        <button type="button" onClick={onClose} className="text-gray-500 text-sm">Cancel</button>
      </div>
      {createMut.isError && <p className="text-red-500 text-sm">{(createMut.error as Error).message}</p>}
    </form>
  )
}
