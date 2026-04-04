import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventTypesApi } from '../api/eventTypes'
import { fieldsApi } from '../api/fields'
import { metaFieldsApi } from '../api/metaFields'
import { relationsApi } from '../api/relations'
import { variablesApi } from '../api/variables'
import { useConfirm } from '../hooks/useConfirm'
import type { EventType, FieldDefinition, MetaFieldDefinition, EventTypeRelation, Variable, VariableType } from '../types'

type Tab = 'event-types' | 'meta-fields' | 'relations' | 'variables'

export default function ProjectSettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [tab, setTab] = useState<Tab>('event-types')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'event-types', label: 'Event Types' },
    { key: 'meta-fields', label: 'Meta Fields' },
    { key: 'relations', label: 'Relations' },
    { key: 'variables', label: 'Variables' },
  ]

  return (
    <div>
      <h1 className="page-title mb-6">Project Settings</h1>
      <div className="tabs mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'tab-active' : 'tab-inactive'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'event-types' && slug && <EventTypesTab slug={slug} />}
      {tab === 'meta-fields' && slug && <MetaFieldsTab slug={slug} />}
      {tab === 'relations' && slug && <RelationsTab slug={slug} />}
      {tab === 'variables' && slug && <VariablesTab slug={slug} />}
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
        <h2 className="section-title">Event Types</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Add Event Type
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="card card-body space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="field-label">Name (e.g. pv)</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" required />
            </div>
            <div className="flex-1">
              <label className="field-label">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input" required />
            </div>
            <div className="w-16">
              <label className="field-label">Color</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="color-input" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {eventTypes.map((et: EventType) => (
        <div key={et.id} className="card overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setExpandedId(expandedId === et.id ? null : et.id)}
          >
            <div className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: et.color }} />
              <span className="font-mono text-sm font-semibold text-gray-900">{et.name}</span>
              <span className="text-gray-500 text-sm">{et.display_name}</span>
              <span className="count-pill">{et.field_definitions.length} fields</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); startEdit(et) }}
                className="btn-edit-sm"
              >
                Edit
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(et) }}
                className="btn-danger-sm"
              >
                Delete
              </button>
              <span className="text-gray-400 text-xs ml-2">{expandedId === et.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {editingId === et.id && (
            <div className="border-t bg-indigo-50/30 p-4 space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="field-label">Display Name</label>
                  <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="input" />
                </div>
                <div className="flex-1">
                  <label className="field-label">Description</label>
                  <input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="input" />
                </div>
                <div className="w-16">
                  <label className="field-label">Color</label>
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="color-input" />
                </div>
              </div>
              <div className="form-actions">
                <button onClick={() => updateMut.mutate(et.id)} className="btn-primary">Save</button>
                <button onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
              </div>
              {updateMut.isError && <p className="form-error-sm">{(updateMut.error as Error).message}</p>}
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
        <span className="section-label">Fields</span>
        <button onClick={() => setShowForm(!showForm)} className="btn-link">
          + Add Field
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="bg-white p-3 rounded-lg border space-y-3 shadow-sm">
          <div className="form-grid-4">
            <div>
              <label className="field-label">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input-sm" required />
            </div>
            <div>
              <label className="field-label">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input-sm" required />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="select-sm">
                {fieldTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="checkbox" /> Required
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary text-xs px-3 py-1.5">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {sortedFields.length > 0 ? (
        <div className="space-y-0">
          <div className="grid grid-cols-[32px_1fr_1fr_80px_60px_100px] gap-2 grid-header">
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
                    className="move-btn"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => moveField(idx, 1)}
                    disabled={idx === sortedFields.length - 1 || reorderMut.isPending}
                    className="move-btn"
                    title="Move down"
                  >▼</button>
                </div>
                <span className="font-mono text-gray-900">{f.name}</span>
                <span className="text-gray-600">{f.display_name}</span>
                <span><span className="field-type-badge">{f.field_type}</span></span>
                <span>{f.is_required ? <span className="text-green-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}</span>
                <div className="flex gap-1.5 justify-end">
                  <button onClick={() => startEdit(f)} className="btn-edit-sm">Edit</button>
                  <button onClick={() => handleDeleteField(f)} className="btn-danger-sm">Delete</button>
                </div>
              </div>

              {editingId === f.id && (
                <div className="bg-indigo-50/40 border-t border-indigo-100 px-3 py-3 space-y-2">
                  <div className="form-grid-4">
                    <div>
                      <label className="field-label">Display Name</label>
                      <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="input-sm" />
                    </div>
                    <div>
                      <label className="field-label">Type</label>
                      <select value={editFieldType} onChange={e => setEditFieldType(e.target.value)} className="select-sm">
                        {fieldTypes.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Description</label>
                      <input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="input-sm" placeholder="Optional" />
                    </div>
                    <div className="flex items-end pb-0.5">
                      <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={editIsRequired} onChange={e => setEditIsRequired(e.target.checked)} className="checkbox" /> Required
                      </label>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button onClick={() => saveEdit(f.id)} className="btn-primary text-xs px-3 py-1">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1">Cancel</button>
                  </div>
                  {updateMut.isError && <p className="form-error-sm">{(updateMut.error as Error).message}</p>}
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
        <h2 className="section-title">Meta Fields</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Add Meta Field</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="card card-body space-y-3">
          <div className="form-grid-4 items-end">
            <div>
              <label className="field-label">Name (e.g. jira_link)</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="field-label">Display Name</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="select">
                {['string', 'url', 'boolean', 'enum', 'date'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="text-sm flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="checkbox" /> Required
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Display</th>
              <th>Type</th>
              <th>Required</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {metaFields.map((mf: MetaFieldDefinition) => (
              <tr key={mf.id}>
                <td className="cell-mono">{mf.name}</td>
                <td className="text-gray-600">{mf.display_name}</td>
                <td><span className="field-type-badge">{mf.field_type}</span></td>
                <td>{mf.is_required ? <span className="text-green-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}</td>
                <td><button onClick={() => handleDelete(mf)} className="btn-danger-sm">Delete</button></td>
              </tr>
            ))}
            {metaFields.length === 0 && (
              <tr><td colSpan={5} className="table-empty text-sm">No meta fields yet.</td></tr>
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
        <h2 className="section-title">Relations</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Add Relation</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="card card-body space-y-3">
          <div className="form-grid-2">
            <div>
              <label className="field-label">Source Event Type</label>
              <select value={srcEtId} onChange={e => { setSrcEtId(e.target.value); setSrcFieldId('') }} className="select">
                <option value="">Select...</option>
                {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Target Event Type</label>
              <select value={tgtEtId} onChange={e => { setTgtEtId(e.target.value); setTgtFieldId('') }} className="select">
                <option value="">Select...</option>
                {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Source Field</label>
              <select value={srcFieldId} onChange={e => setSrcFieldId(e.target.value)} className="select">
                <option value="">Select...</option>
                {srcEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Target Field</label>
              <select value={tgtFieldId} onChange={e => setTgtFieldId(e.target.value)} className="select">
                <option value="">Select...</option>
                {tgtEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={!srcFieldId || !tgtFieldId}>Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Source</th>
              <th className="w-8">→</th>
              <th>Target</th>
              <th>Type</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {relations.map((r: EventTypeRelation) => (
              <tr key={r.id}>
                <td className="cell-mono">{etMap[r.source_event_type_id]?.name ?? '?'}</td>
                <td className="text-gray-400">→</td>
                <td className="cell-mono">{etMap[r.target_event_type_id]?.name ?? '?'}</td>
                <td className="text-gray-600">{r.relation_type}</td>
                <td><button onClick={() => handleDelete(r)} className="btn-danger-sm">Delete</button></td>
              </tr>
            ))}
            {relations.length === 0 && (
              <tr><td colSpan={5} className="table-empty text-sm">No relations yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VariablesTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [varType, setVarType] = useState<VariableType>('string')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVarType, setEditVarType] = useState<VariableType>('string')
  const [editDescription, setEditDescription] = useState('')
  const { confirm, dialog } = useConfirm()

  const variableTypes: VariableType[] = ['string', 'number', 'boolean', 'date', 'datetime', 'json', 'string_array', 'number_array']
  const typeLabels: Record<VariableType, string> = {
    string: 'String', number: 'Number', boolean: 'Boolean', date: 'Date',
    datetime: 'Datetime', json: 'JSON', string_array: 'String[]', number_array: 'Number[]',
  }

  const { data: variables = [] } = useQuery({
    queryKey: ['variables', slug],
    queryFn: () => variablesApi.list(slug),
  })

  const createMut = useMutation({
    mutationFn: () => variablesApi.create(slug, { name, variable_type: varType, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variables', slug] })
      setShowForm(false); setName(''); setVarType('string'); setDescription('')
    },
  })

  const updateMut = useMutation({
    mutationFn: (id: string) => variablesApi.update(slug, id, { variable_type: editVarType, description: editDescription }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variables', slug] })
      setEditingId(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => variablesApi.del(slug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['variables', slug] }),
  })

  const handleDelete = async (v: Variable) => {
    const ok = await confirm({
      title: 'Delete variable',
      message: `Delete "${v.name}"? Any event fields referencing \${${v.name}} will keep the literal text.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(v.id)
  }

  const startEdit = (v: Variable) => {
    setEditingId(v.id)
    setEditVarType(v.variable_type)
    setEditDescription(v.description)
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="section-title">Variables</h2>
          <p className="text-xs text-gray-400 mt-0.5">Define template placeholders. Use <code className="bg-gray-100 px-1 rounded">{'${var_name}'}</code> in event field values.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">+ Add Variable</button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="card card-body space-y-3">
          <div className="form-grid-3">
            <div>
              <label className="field-label">Name (lowercase, e.g. spot_id)</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" required placeholder="my_variable" pattern="^[a-z][a-z0-9_]*$" />
            </div>
            <div>
              <label className="field-label">Type</label>
              <select value={varType} onChange={e => setVarType(e.target.value as VariableType)} className="select">
                {variableTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className="input" placeholder="Optional" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
              <th>Usage</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {variables.map((v: Variable) => (
              <tr key={v.id}>
                {editingId === v.id ? (
                  <>
                    <td className="cell-mono">{v.name}</td>
                    <td className="py-2">
                      <select value={editVarType} onChange={e => setEditVarType(e.target.value as VariableType)} className="select-sm">
                        {variableTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                      </select>
                    </td>
                    <td className="py-2">
                      <input value={editDescription} onChange={e => setEditDescription(e.target.value)} className="input-sm" />
                    </td>
                    <td>
                      <code className="var-code text-indigo-600 bg-indigo-50">{`\${${v.name}}`}</code>
                    </td>
                    <td>
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => updateMut.mutate(v.id)} className="btn-primary text-xs px-2.5 py-1">Save</button>
                        <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-2.5 py-1">Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="cell-mono">{v.name}</td>
                    <td><span className="field-type-badge">{typeLabels[v.variable_type]}</span></td>
                    <td className="cell-muted">{v.description}</td>
                    <td>
                      <code className="var-code text-indigo-600 bg-indigo-50">{`\${${v.name}}`}</code>
                    </td>
                    <td>
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => startEdit(v)} className="btn-edit-sm">Edit</button>
                        <button onClick={() => handleDelete(v)} className="btn-danger-sm">Delete</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {variables.length === 0 && (
              <tr><td colSpan={5} className="table-empty text-sm">No variables yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {updateMut.isError && <p className="form-error-sm mt-2">{(updateMut.error as Error).message}</p>}
    </div>
  )
}
