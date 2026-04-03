import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventTypesApi } from '../api/eventTypes'
import { fieldsApi } from '../api/fields'
import { metaFieldsApi } from '../api/metaFields'
import { relationsApi } from '../api/relations'
import type { EventType, FieldDefinition, MetaFieldDefinition, EventTypeRelation } from '../types'

type Tab = 'event-types' | 'meta-fields' | 'relations'

export default function ProjectSettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [tab, setTab] = useState<Tab>('event-types')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'event-types', label: 'Event Types' },
    { key: 'meta-fields', label: 'Meta Fields' },
    { key: 'relations', label: 'Relations' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Project Settings</h1>
      <div className="flex gap-1 border-b mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'event-types' && slug && <EventTypesTab slug={slug} />}
      {tab === 'meta-fields' && slug && <MetaFieldsTab slug={slug} />}
      {tab === 'relations' && slug && <RelationsTab slug={slug} />}
    </div>
  )
}

function EventTypesTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['eventTypes', slug],
    queryFn: () => eventTypesApi.list(slug),
  })

  const createMut = useMutation({
    mutationFn: () => eventTypesApi.create(slug, { name, display_name: displayName, color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventTypes', slug] })
      setShowForm(false); setName(''); setDisplayName(''); setColor('#6366f1')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eventTypesApi.del(slug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventTypes', slug] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Event Types</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm">
          + Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-gray-50 border rounded p-3 space-y-2">
          <div className="flex gap-2">
            <input placeholder="name (e.g. pv)" value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1" required />
            <input placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1" required />
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-sm">Cancel</button>
          </div>
          {createMut.isError && <p className="text-red-500 text-xs">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {eventTypes.map((et: EventType) => (
        <div key={et.id} className="bg-white border rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpandedId(expandedId === et.id ? null : et.id)}
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: et.color }} />
              <span className="font-mono text-sm font-semibold">{et.name}</span>
              <span className="text-gray-500 text-sm">{et.display_name}</span>
              <span className="text-gray-400 text-xs">({et.field_definitions.length} fields)</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${et.name}"?`)) deleteMut.mutate(et.id) }} className="text-red-400 hover:text-red-600 text-xs">
                Delete
              </button>
              <span className="text-gray-400 text-xs">{expandedId === et.id ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedId === et.id && <FieldsEditor slug={slug} eventType={et} />}
        </div>
      ))}
    </div>
  )
}

function FieldsEditor({ slug, eventType }: { slug: string; eventType: EventType }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldType, setFieldType] = useState('string')
  const [isRequired, setIsRequired] = useState(false)

  const createMut = useMutation({
    mutationFn: () => fieldsApi.create(slug, eventType.id, { name, display_name: displayName, field_type: fieldType, is_required: isRequired }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventTypes', slug] })
      setShowForm(false); setName(''); setDisplayName(''); setFieldType('string'); setIsRequired(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (fid: string) => fieldsApi.del(slug, eventType.id, fid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventTypes', slug] }),
  })

  return (
    <div className="border-t px-3 py-3 bg-gray-50 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase">Fields</span>
        <button onClick={() => setShowForm(!showForm)} className="text-indigo-600 text-xs font-medium">+ Add Field</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="flex gap-2 items-end flex-wrap bg-white p-2 rounded border">
          <input placeholder="name" value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 text-xs w-24" required />
          <input placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="border rounded px-2 py-1 text-xs w-32" required />
          <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="border rounded px-2 py-1 text-xs">
            {['string', 'number', 'boolean', 'json', 'enum', 'url'].map(t => <option key={t}>{t}</option>)}
          </select>
          <label className="text-xs flex items-center gap-1">
            <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} /> Required
          </label>
          <button type="submit" className="bg-indigo-600 text-white px-2 py-1 rounded text-xs">Add</button>
          <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-xs">Cancel</button>
        </form>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Name</th><th>Display</th><th>Type</th><th>Required</th><th></th>
          </tr>
        </thead>
        <tbody>
          {eventType.field_definitions.map((f: FieldDefinition) => (
            <tr key={f.id} className="border-t">
              <td className="py-1 font-mono">{f.name}</td>
              <td>{f.display_name}</td>
              <td><span className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">{f.field_type}</span></td>
              <td>{f.is_required ? '✓' : ''}</td>
              <td><button onClick={() => deleteMut.mutate(f.id)} className="text-red-400 hover:text-red-600">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetaFieldsTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [fieldType, setFieldType] = useState('string')
  const [isRequired, setIsRequired] = useState(false)

  const { data: metaFields = [] } = useQuery({
    queryKey: ['metaFields', slug],
    queryFn: () => metaFieldsApi.list(slug),
  })

  const createMut = useMutation({
    mutationFn: () => metaFieldsApi.create(slug, { name, display_name: displayName, field_type: fieldType, is_required: isRequired }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metaFields', slug] })
      setShowForm(false); setName(''); setDisplayName(''); setFieldType('string')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => metaFieldsApi.del(slug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metaFields', slug] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Meta Fields</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm">+ Add</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-gray-50 border rounded p-3 flex gap-2 items-end flex-wrap">
          <input placeholder="name (e.g. jira_link)" value={name} onChange={e => setName(e.target.value)} className="border rounded px-2 py-1 text-sm" required />
          <input placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} className="border rounded px-2 py-1 text-sm" required />
          <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="border rounded px-2 py-1 text-sm">
            {['string', 'url', 'boolean', 'enum', 'date'].map(t => <option key={t}>{t}</option>)}
          </select>
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} /> Required
          </label>
          <button type="submit" className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Create</button>
          <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-sm">Cancel</button>
        </form>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-2">Name</th><th>Display</th><th>Type</th><th>Required</th><th></th>
            </tr>
          </thead>
          <tbody>
            {metaFields.map((mf: MetaFieldDefinition) => (
              <tr key={mf.id} className="border-t">
                <td className="px-3 py-2 font-mono">{mf.name}</td>
                <td>{mf.display_name}</td>
                <td><span className="bg-gray-200 px-1.5 py-0.5 rounded text-xs">{mf.field_type}</span></td>
                <td>{mf.is_required ? '✓' : ''}</td>
                <td><button onClick={() => { if (confirm(`Delete "${mf.name}"?`)) deleteMut.mutate(mf.id) }} className="text-red-400 hover:text-red-600">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RelationsTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [srcEtId, setSrcEtId] = useState('')
  const [tgtEtId, setTgtEtId] = useState('')
  const [srcFieldId, setSrcFieldId] = useState('')
  const [tgtFieldId, setTgtFieldId] = useState('')

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['eventTypes', slug],
    queryFn: () => eventTypesApi.list(slug),
  })
  const { data: relations = [] } = useQuery({
    queryKey: ['relations', slug],
    queryFn: () => relationsApi.list(slug),
  })

  const srcEt = eventTypes.find((e: EventType) => e.id === srcEtId)
  const tgtEt = eventTypes.find((e: EventType) => e.id === tgtEtId)

  const createMut = useMutation({
    mutationFn: () => relationsApi.create(slug, {
      source_event_type_id: srcEtId, target_event_type_id: tgtEtId,
      source_field_id: srcFieldId, target_field_id: tgtFieldId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['relations', slug] })
      setShowForm(false); setSrcEtId(''); setTgtEtId(''); setSrcFieldId(''); setTgtFieldId('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => relationsApi.del(slug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['relations', slug] }),
  })

  const etMap = Object.fromEntries(eventTypes.map((e: EventType) => [e.id, e]))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Relations</h2>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm">+ Add</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-gray-50 border rounded p-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Source Event Type</label>
              <select value={srcEtId} onChange={e => { setSrcEtId(e.target.value); setSrcFieldId('') }} className="border rounded px-2 py-1 text-sm w-full">
                <option value="">Select...</option>
                {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Target Event Type</label>
              <select value={tgtEtId} onChange={e => { setTgtEtId(e.target.value); setTgtFieldId('') }} className="border rounded px-2 py-1 text-sm w-full">
                <option value="">Select...</option>
                {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Source Field</label>
              <select value={srcFieldId} onChange={e => setSrcFieldId(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
                <option value="">Select...</option>
                {srcEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Target Field</label>
              <select value={tgtFieldId} onChange={e => setTgtFieldId(e.target.value)} className="border rounded px-2 py-1 text-sm w-full">
                <option value="">Select...</option>
                {tgtEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-3 py-1 rounded text-sm" disabled={!srcFieldId || !tgtFieldId}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-2">Source</th><th>→</th><th>Target</th><th>Type</th><th></th>
            </tr>
          </thead>
          <tbody>
            {relations.map((r: EventTypeRelation) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 font-mono">{etMap[r.source_event_type_id]?.name ?? '?'}</td>
                <td>→</td>
                <td className="font-mono">{etMap[r.target_event_type_id]?.name ?? '?'}</td>
                <td>{r.relation_type}</td>
                <td><button onClick={() => deleteMut.mutate(r.id)} className="text-red-400 hover:text-red-600">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
