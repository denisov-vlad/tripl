import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventTypesApi } from '../api/eventTypes'
import { fieldsApi } from '../api/fields'
import { metaFieldsApi } from '../api/metaFields'
import { relationsApi } from '../api/relations'
import { useConfirm } from '../hooks/useConfirm'
import type { EventType, FieldDefinition, MetaFieldDefinition, EventTypeRelation } from '../types'

type Tab = 'event-types' | 'meta-fields' | 'relations'

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition'
const inputSmClass = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition'
const btnPrimary = 'bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition'
const btnSecondary = 'px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition'
const btnDangerSm = 'px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition'

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
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const { confirm, dialog } = useConfirm()

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

  const updateMut = useMutation({
    mutationFn: (id: string) => eventTypesApi.update(slug, id, { display_name: editDisplayName, color: editColor, description: editDescription }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventTypes', slug] })
      setEditingId(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => eventTypesApi.del(slug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventTypes', slug] }),
  })

  const handleDelete = async (et: EventType) => {
    const ok = await confirm({
      title: 'Delete event type',
      message: `Delete "${et.display_name}"? All associated field definitions and events of this type will be removed.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(et.id)
  }

  const startEdit = (et: EventType) => {
    setEditingId(et.id)
    setEditDisplayName(et.display_name)
    setEditColor(et.color)
    setEditDescription(et.description)
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Event Types</h2>
        <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
          + Add Event Type
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Name (e.g. pv)</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputClass} required />
            </div>
            <div className="w-16">
              <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-[38px] rounded-lg border border-gray-300 cursor-pointer" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className={btnPrimary}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>Cancel</button>
          </div>
          {createMut.isError && <p className="text-red-600 text-xs">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {eventTypes.map((et: EventType) => (
        <div key={et.id} className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
            onClick={() => setExpandedId(expandedId === et.id ? null : et.id)}
          >
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: et.color }} />
              <span className="font-mono text-sm font-semibold text-gray-900">{et.name}</span>
              <span className="text-gray-500 text-sm">{et.display_name}</span>
              <span className="text-gray-400 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{et.field_definitions.length} fields</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); startEdit(et) }}
                className="px-2.5 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition"
              >
                Edit
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(et) }}
                className={btnDangerSm}
              >
                Delete
              </button>
              <span className="text-gray-400 text-xs ml-2">{expandedId === et.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Edit event type inline */}
          {editingId === et.id && (
            <div className="border-t bg-indigo-50/30 p-4 space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                  <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className={inputClass} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <input value={editDescription} onChange={e => setEditDescription(e.target.value)} className={inputClass} />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="w-full h-[38px] rounded-lg border border-gray-300 cursor-pointer" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => updateMut.mutate(et.id)} className={btnPrimary}>Save</button>
                <button onClick={() => setEditingId(null)} className={btnSecondary}>Cancel</button>
              </div>
              {updateMut.isError && <p className="text-red-600 text-xs">{(updateMut.error as Error).message}</p>}
            </div>
          )}

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editFieldType, setEditFieldType] = useState('')
  const [editIsRequired, setEditIsRequired] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const { confirm, dialog } = useConfirm()

  const sortedFields = [...eventType.field_definitions].sort((a, b) => a.order - b.order)

  const createMut = useMutation({
    mutationFn: () => fieldsApi.create(slug, eventType.id, { name, display_name: displayName, field_type: fieldType, is_required: isRequired, order: sortedFields.length }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventTypes', slug] })
      setShowForm(false); setName(''); setDisplayName(''); setFieldType('string'); setIsRequired(false)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ fid, data }: { fid: string; data: Partial<FieldDefinition> }) => fieldsApi.update(slug, eventType.id, fid, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventTypes', slug] })
      setEditingId(null)
    },
  })

  const reorderMut = useMutation({
    mutationFn: (fieldIds: string[]) => fieldsApi.reorder(slug, eventType.id, fieldIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventTypes', slug] }),
  })

  const deleteMut = useMutation({
    mutationFn: (fid: string) => fieldsApi.del(slug, eventType.id, fid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventTypes', slug] }),
  })

  const handleDeleteField = async (f: FieldDefinition) => {
    const ok = await confirm({
      title: 'Delete field',
      message: `Delete "${f.display_name}" from ${eventType.display_name}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(f.id)
  }

  const startEdit = (f: FieldDefinition) => {
    setEditingId(f.id)
    setEditDisplayName(f.display_name)
    setEditFieldType(f.field_type)
    setEditIsRequired(f.is_required)
    setEditDescription(f.description)
  }

  const saveEdit = (fid: string) => {
    updateMut.mutate({ fid, data: { display_name: editDisplayName, field_type: editFieldType as FieldDefinition['field_type'], is_required: editIsRequired, description: editDescription } })
  }

  const moveField = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= sortedFields.length) return
    const reordered = [...sortedFields]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)
    reorderMut.mutate(reordered.map(f => f.id))
  }

  const fieldTypes = ['string', 'number', 'boolean', 'json', 'enum', 'url']

  return (
    <div className="border-t px-4 py-4 bg-gray-50/50 space-y-3">
      {dialog}
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase">Fields</span>
        <button onClick={() => setShowForm(!showForm)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition">
          + Add Field
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white p-3 rounded-lg border space-y-3 shadow-sm">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputSmClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputSmClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)} className={inputSmClass}>
                {fieldTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="rounded text-indigo-600" /> Required
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
          </div>
          {createMut.isError && <p className="text-red-600 text-xs">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {sortedFields.length > 0 ? (
        <div className="space-y-0">
          <div className="grid grid-cols-[32px_1fr_1fr_80px_60px_100px] gap-2 text-xs text-gray-500 font-semibold py-1.5 px-1">
            <span></span>
            <span>Name</span>
            <span>Display</span>
            <span>Type</span>
            <span>Req</span>
            <span></span>
          </div>
          {sortedFields.map((f: FieldDefinition, idx: number) => (
            <div key={f.id}>
              <div className="grid grid-cols-[32px_1fr_1fr_80px_60px_100px] gap-2 items-center text-xs border-t border-gray-200 py-1.5 px-1">
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => moveField(idx, -1)}
                    disabled={idx === 0 || reorderMut.isPending}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed leading-none text-[10px]"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => moveField(idx, 1)}
                    disabled={idx === sortedFields.length - 1 || reorderMut.isPending}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed leading-none text-[10px]"
                    title="Move down"
                  >▼</button>
                </div>
                <span className="font-mono text-gray-900">{f.name}</span>
                <span className="text-gray-600">{f.display_name}</span>
                <span><span className="bg-gray-200 px-1.5 py-0.5 rounded text-xs font-medium">{f.field_type}</span></span>
                <span>{f.is_required ? <span className="text-green-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}</span>
                <div className="flex gap-1.5 justify-end">
                  <button onClick={() => startEdit(f)} className="px-2 py-0.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition">Edit</button>
                  <button onClick={() => handleDeleteField(f)} className={btnDangerSm}>Delete</button>
                </div>
              </div>

              {editingId === f.id && (
                <div className="bg-indigo-50/40 border-t border-indigo-100 px-3 py-3 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
                      <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className={inputSmClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select value={editFieldType} onChange={e => setEditFieldType(e.target.value)} className={inputSmClass}>
                        {fieldTypes.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                      <input value={editDescription} onChange={e => setEditDescription(e.target.value)} className={inputSmClass} placeholder="Optional" />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={editIsRequired} onChange={e => setEditIsRequired(e.target.checked)} className="rounded text-indigo-600" /> Required
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(f.id)} className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition">Save</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">Cancel</button>
                  </div>
                  {updateMut.isError && <p className="text-red-600 text-xs">{(updateMut.error as Error).message}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 py-2">No fields defined yet.</p>
      )}
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
  const { confirm, dialog } = useConfirm()

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

  const handleDelete = async (mf: MetaFieldDefinition) => {
    const ok = await confirm({
      title: 'Delete meta field',
      message: `Delete "${mf.display_name}"? Meta values for this field will be removed from all events.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(mf.id)
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Meta Fields</h2>
        <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>+ Add Meta Field</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name (e.g. jira_link)</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)} className={inputClass}>
                {['string', 'url', 'boolean', 'enum', 'date'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="text-sm flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="rounded text-indigo-600" /> Required
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className={btnPrimary}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>Cancel</button>
          </div>
          {createMut.isError && <p className="text-red-600 text-xs">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Display</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Required</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metaFields.map((mf: MetaFieldDefinition) => (
              <tr key={mf.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-mono text-gray-900">{mf.name}</td>
                <td className="px-4 py-3 text-gray-600">{mf.display_name}</td>
                <td className="px-4 py-3">
                  <span className="bg-gray-200 px-2 py-0.5 rounded text-xs font-medium">{mf.field_type}</span>
                </td>
                <td className="px-4 py-3">{mf.is_required ? <span className="text-green-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(mf)} className={btnDangerSm}>Delete</button>
                </td>
              </tr>
            ))}
            {metaFields.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No meta fields yet.</td></tr>
            )}
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
  const { confirm, dialog } = useConfirm()

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

  const handleDelete = async (r: EventTypeRelation) => {
    const ok = await confirm({
      title: 'Delete relation',
      message: 'Are you sure you want to remove this relation?',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(r.id)
  }

  const etMap = Object.fromEntries(eventTypes.map((e: EventType) => [e.id, e]))

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-gray-700">Relations</h2>
        <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>+ Add Relation</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Source Event Type</label>
              <select value={srcEtId} onChange={e => { setSrcEtId(e.target.value); setSrcFieldId('') }} className={inputClass}>
                <option value="">Select...</option>
                {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Event Type</label>
              <select value={tgtEtId} onChange={e => { setTgtEtId(e.target.value); setTgtFieldId('') }} className={inputClass}>
                <option value="">Select...</option>
                {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Source Field</label>
              <select value={srcFieldId} onChange={e => setSrcFieldId(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {srcEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Field</label>
              <select value={tgtFieldId} onChange={e => setTgtFieldId(e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                {tgtEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className={btnPrimary} disabled={!srcFieldId || !tgtFieldId}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>Cancel</button>
          </div>
          {createMut.isError && <p className="text-red-600 text-xs">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-8">→</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {relations.map((r: EventTypeRelation) => (
              <tr key={r.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-mono text-gray-900">{etMap[r.source_event_type_id]?.name ?? '?'}</td>
                <td className="px-4 py-3 text-gray-400">→</td>
                <td className="px-4 py-3 font-mono text-gray-900">{etMap[r.target_event_type_id]?.name ?? '?'}</td>
                <td className="px-4 py-3 text-gray-600">{r.relation_type}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(r)} className={btnDangerSm}>Delete</button>
                </td>
              </tr>
            ))}
            {relations.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No relations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
