import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventTypesApi } from '../api/eventTypes'
import { fieldsApi } from '../api/fields'
import { metaFieldsApi } from '../api/metaFields'
import { relationsApi } from '../api/relations'
import { variablesApi } from '../api/variables'
import { dataSourcesApi } from '../api/dataSources'
import { scansApi } from '../api/scans'
import { useConfirm } from '../hooks/useConfirm'
import type { EventType, FieldDefinition, MetaFieldDefinition, EventTypeRelation, Variable, VariableType, DataSource, ScanConfig, ScanJob } from '../types'

type Tab = 'event-types' | 'meta-fields' | 'relations' | 'variables' | 'scans'

export default function ProjectSettingsPage() {
  const { slug, tab: urlTab } = useParams<{ slug: string; tab?: string }>()
  const navigate = useNavigate()
  const validTabs: Tab[] = ['event-types', 'meta-fields', 'relations', 'variables', 'scans']
  const initialTab = validTabs.includes(urlTab as Tab) ? (urlTab as Tab) : 'event-types'
  const [tab, setTab] = useState<Tab>(initialTab)

  useEffect(() => {
    if (urlTab && validTabs.includes(urlTab as Tab) && urlTab !== tab) {
      setTab(urlTab as Tab)
    }
  }, [urlTab])

  const changeTab = (t: Tab) => {
    setTab(t)
    navigate(`/p/${slug}/settings/${t}`, { replace: true })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'event-types', label: 'Event Types' },
    { key: 'meta-fields', label: 'Meta Fields' },
    { key: 'relations', label: 'Relations' },
    { key: 'variables', label: 'Variables' },
    { key: 'scans', label: 'Scans' },
  ]

  return (
    <div>
      <h1 className="page-title mb-6">Project Settings</h1>
      <div className="tabs mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
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
      {tab === 'scans' && slug && <ScansTab slug={slug} />}
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
  const [enumOptions, setEnumOptions] = useState<string[]>([])
  const [enumInput, setEnumInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editFieldType, setEditFieldType] = useState('')
  const [editIsRequired, setEditIsRequired] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [editEnumOptions, setEditEnumOptions] = useState<string[]>([])
  const [editEnumInput, setEditEnumInput] = useState('')
  const { confirm, dialog } = useConfirm()

  const sortedFields = [...eventType.field_definitions].sort((a, b) => a.order - b.order)

  const createMut = useMutation({
    mutationFn: () => fieldsApi.create(slug, eventType.id, {
      name, display_name: displayName, field_type: fieldType, is_required: isRequired,
      ...(fieldType === 'enum' && enumOptions.length > 0 ? { enum_options: enumOptions } : {}),
      order: sortedFields.length,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventTypes', slug] })
      setShowForm(false); setName(''); setDisplayName(''); setFieldType('string'); setIsRequired(false)
      setEnumOptions([]); setEnumInput('')
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
    setEditEnumOptions(f.enum_options ?? [])
    setEditEnumInput('')
  }

  const addEnumOption = (option: string, target: 'create' | 'edit') => {
    const trimmed = option.trim()
    if (!trimmed) return
    if (target === 'create') {
      if (!enumOptions.includes(trimmed)) setEnumOptions([...enumOptions, trimmed])
      setEnumInput('')
    } else {
      if (!editEnumOptions.includes(trimmed)) setEditEnumOptions([...editEnumOptions, trimmed])
      setEditEnumInput('')
    }
  }

  const saveEdit = (fid: string) => {
    updateMut.mutate({ fid, data: {
      display_name: editDisplayName, field_type: editFieldType as FieldDefinition['field_type'],
      is_required: editIsRequired, description: editDescription,
      ...(editFieldType === 'enum' ? { enum_options: editEnumOptions } : { enum_options: null }),
    } })
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
          {fieldType === 'enum' && (
            <div>
              <label className="field-label">Enum Options</label>
              <div className="flex gap-2 items-center">
                <input
                  value={enumInput}
                  onChange={e => setEnumInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEnumOption(enumInput, 'create') } }}
                  className="input-sm flex-1"
                  placeholder="Type option and press Enter"
                />
                <button type="button" onClick={() => addEnumOption(enumInput, 'create')} className="btn-secondary text-xs px-2 py-1">Add</button>
              </div>
              {enumOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {enumOptions.map(opt => (
                    <span key={opt} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
                      {opt}
                      <button type="button" onClick={() => setEnumOptions(enumOptions.filter(o => o !== opt))} className="text-indigo-400 hover:text-indigo-700">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
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
                <span><span className="field-type-badge">{f.field_type}</span>{f.field_type === 'enum' && f.enum_options && <span className="text-gray-400 text-[10px] ml-1">({f.enum_options.length})</span>}</span>
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
                  {editFieldType === 'enum' && (
                    <div>
                      <label className="field-label">Enum Options</label>
                      <div className="flex gap-2 items-center">
                        <input
                          value={editEnumInput}
                          onChange={e => setEditEnumInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEnumOption(editEnumInput, 'edit') } }}
                          className="input-sm flex-1"
                          placeholder="Type option and press Enter"
                        />
                        <button type="button" onClick={() => addEnumOption(editEnumInput, 'edit')} className="btn-secondary text-xs px-2 py-1">Add</button>
                      </div>
                      {editEnumOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {editEnumOptions.map(opt => (
                            <span key={opt} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
                              {opt}
                              <button type="button" onClick={() => setEditEnumOptions(editEnumOptions.filter(o => o !== opt))} className="text-indigo-400 hover:text-indigo-700">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
  const [enumOptions, setEnumOptions] = useState<string[]>([])
  const [enumInput, setEnumInput] = useState('')
  const [defaultValue, setDefaultValue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editFieldType, setEditFieldType] = useState('')
  const [editIsRequired, setEditIsRequired] = useState(false)
  const [editEnumOptions, setEditEnumOptions] = useState<string[]>([])
  const [editEnumInput, setEditEnumInput] = useState('')
  const [editDefaultValue, setEditDefaultValue] = useState('')
  const { confirm, dialog } = useConfirm()

  const metaFieldTypes = ['string', 'url', 'boolean', 'enum', 'date']

  const { data: metaFields = [] } = useQuery({
    queryKey: ['metaFields', slug],
    queryFn: () => metaFieldsApi.list(slug),
  })

  const createMut = useMutation({
    mutationFn: () => metaFieldsApi.create(slug, {
      name, display_name: displayName, field_type: fieldType, is_required: isRequired,
      ...(fieldType === 'enum' && enumOptions.length > 0 ? { enum_options: enumOptions } : {}),
      ...(defaultValue ? { default_value: defaultValue } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metaFields', slug] })
      setShowForm(false); setName(''); setDisplayName(''); setFieldType('string')
      setIsRequired(false); setEnumOptions([]); setEnumInput(''); setDefaultValue('')
    },
  })

  const updateMut = useMutation({
    mutationFn: (id: string) => metaFieldsApi.update(slug, id, {
      display_name: editDisplayName, field_type: editFieldType as MetaFieldDefinition['field_type'], is_required: editIsRequired,
      ...(editFieldType === 'enum' ? { enum_options: editEnumOptions } : { enum_options: null }),
      default_value: editDefaultValue || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['metaFields', slug] })
      setEditingId(null)
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

  const startEdit = (mf: MetaFieldDefinition) => {
    setEditingId(mf.id)
    setEditDisplayName(mf.display_name)
    setEditFieldType(mf.field_type)
    setEditIsRequired(mf.is_required)
    setEditEnumOptions(mf.enum_options ?? [])
    setEditEnumInput('')
    setEditDefaultValue(mf.default_value ?? '')
  }

  const addMetaEnumOption = (option: string, target: 'create' | 'edit') => {
    const trimmed = option.trim()
    if (!trimmed) return
    if (target === 'create') {
      if (!enumOptions.includes(trimmed)) setEnumOptions([...enumOptions, trimmed])
      setEnumInput('')
    } else {
      if (!editEnumOptions.includes(trimmed)) setEditEnumOptions([...editEnumOptions, trimmed])
      setEditEnumInput('')
    }
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
                {metaFieldTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="text-sm flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="checkbox" /> Required
              </label>
            </div>
          </div>
          {fieldType === 'enum' && (
            <div>
              <label className="field-label">Enum Options</label>
              <div className="flex gap-2 items-center">
                <input
                  value={enumInput}
                  onChange={e => setEnumInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMetaEnumOption(enumInput, 'create') } }}
                  className="input flex-1"
                  placeholder="Type option and press Enter"
                />
                <button type="button" onClick={() => addMetaEnumOption(enumInput, 'create')} className="btn-secondary">Add</button>
              </div>
              {enumOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {enumOptions.map(opt => (
                    <span key={opt} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
                      {opt}
                      <button type="button" onClick={() => setEnumOptions(enumOptions.filter(o => o !== opt))} className="text-indigo-400 hover:text-indigo-700">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="field-label">Default Value (optional)</label>
            <input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} className="input" placeholder="Optional default" />
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
              <th>Default</th>
              <th className="w-28"></th>
            </tr>
          </thead>
          <tbody>
            {metaFields.map((mf: MetaFieldDefinition) => (
              <tr key={mf.id}>
                <td className="cell-mono">{mf.name}</td>
                <td className="text-gray-600">{mf.display_name}</td>
                <td>
                  <span className="field-type-badge">{mf.field_type}</span>
                  {mf.field_type === 'enum' && mf.enum_options && <span className="text-gray-400 text-[10px] ml-1">({mf.enum_options.length})</span>}
                </td>
                <td>{mf.is_required ? <span className="text-green-600 font-medium">✓</span> : <span className="text-gray-300">—</span>}</td>
                <td className="cell-muted text-xs">{mf.default_value ?? '—'}</td>
                <td>
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => startEdit(mf)} className="btn-edit-sm">Edit</button>
                    <button onClick={() => handleDelete(mf)} className="btn-danger-sm">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {metaFields.length === 0 && (
              <tr><td colSpan={6} className="table-empty text-sm">No meta fields yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId && (() => {
        const mf = metaFields.find((m: MetaFieldDefinition) => m.id === editingId)
        if (!mf) return null
        return (
          <div className="card card-body space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">Editing: {mf.name}</h3>
            <div className="form-grid-4 items-end">
              <div>
                <label className="field-label">Display Name</label>
                <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="field-label">Type</label>
                <select value={editFieldType} onChange={e => setEditFieldType(e.target.value)} className="select">
                  {metaFieldTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Default Value</label>
                <input value={editDefaultValue} onChange={e => setEditDefaultValue(e.target.value)} className="input" placeholder="Optional" />
              </div>
              <div className="flex items-end pb-2">
                <label className="text-sm flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={editIsRequired} onChange={e => setEditIsRequired(e.target.checked)} className="checkbox" /> Required
                </label>
              </div>
            </div>
            {editFieldType === 'enum' && (
              <div>
                <label className="field-label">Enum Options</label>
                <div className="flex gap-2 items-center">
                  <input
                    value={editEnumInput}
                    onChange={e => setEditEnumInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMetaEnumOption(editEnumInput, 'edit') } }}
                    className="input flex-1"
                    placeholder="Type option and press Enter"
                  />
                  <button type="button" onClick={() => addMetaEnumOption(editEnumInput, 'edit')} className="btn-secondary">Add</button>
                </div>
                {editEnumOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editEnumOptions.map(opt => (
                      <span key={opt} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
                        {opt}
                        <button type="button" onClick={() => setEditEnumOptions(editEnumOptions.filter(o => o !== opt))} className="text-indigo-400 hover:text-indigo-700">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="form-actions">
              <button onClick={() => updateMut.mutate(mf.id)} className="btn-primary">Save</button>
              <button onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
            </div>
            {updateMut.isError && <p className="form-error-sm">{(updateMut.error as Error).message}</p>}
          </div>
        )
      })()}
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

/* ─── Scans Tab ─── */
function ScansTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingScanId, setEditingScanId] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  // Form state
  const [dsId, setDsId] = useState('')
  const [scanName, setScanName] = useState('')
  const [baseQuery, setBaseQuery] = useState('')
  const [eventTypeId, setEventTypeId] = useState('')
  const [eventTypeColumn, setEventTypeColumn] = useState('')
  const [cardinalityThreshold, setCardinalityThreshold] = useState(100)
  const [schedule, setSchedule] = useState('')

  // Edit state
  const [editName, setEditName] = useState('')
  const [editBaseQuery, setEditBaseQuery] = useState('')
  const [editEventTypeId, setEditEventTypeId] = useState('')
  const [editEventTypeColumn, setEditEventTypeColumn] = useState('')
  const [editCardinalityThreshold, setEditCardinalityThreshold] = useState(100)
  const [editSchedule, setEditSchedule] = useState('')

  const { data: dataSources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => dataSourcesApi.list(),
  })

  const { data: eventTypes = [] } = useQuery({
    queryKey: ['eventTypes', slug],
    queryFn: () => eventTypesApi.list(slug),
  })

  const { data: scanConfigs = [] } = useQuery({
    queryKey: ['scans', slug],
    queryFn: () => scansApi.list(slug),
  })

  // Build a lookup for data source names
  const dsMap = new Map(dataSources.map((ds: DataSource) => [ds.id, ds.name]))

  const createMut = useMutation({
    mutationFn: () =>
      scansApi.create(slug, {
        data_source_id: dsId,
        name: scanName,
        base_query: baseQuery,
        event_type_id: eventTypeId || null,
        event_type_column: eventTypeColumn || null,
        cardinality_threshold: cardinalityThreshold,
        schedule: schedule || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans', slug] })
      resetForm()
    },
  })

  const updateMut = useMutation({
    mutationFn: (scanId: string) =>
      scansApi.update(slug, scanId, {
        name: editName,
        base_query: editBaseQuery,
        event_type_id: editEventTypeId || null,
        event_type_column: editEventTypeColumn || null,
        cardinality_threshold: editCardinalityThreshold,
        schedule: editSchedule || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans', slug] })
      setEditingScanId(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (scanId: string) => scansApi.del(slug, scanId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scans', slug] }),
  })

  const handleDelete = async (sc: ScanConfig) => {
    const ok = await confirm({
      title: 'Delete scan config',
      message: `Delete "${sc.name}"?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(sc.id)
  }

  const startEditScan = (sc: ScanConfig) => {
    setEditingScanId(sc.id)
    setEditName(sc.name)
    setEditBaseQuery(sc.base_query)
    setEditEventTypeId(sc.event_type_id ?? '')
    setEditEventTypeColumn(sc.event_type_column ?? '')
    setEditCardinalityThreshold(sc.cardinality_threshold)
    setEditSchedule(sc.schedule ?? '')
  }

  const resetForm = () => {
    setShowForm(false)
    setDsId(''); setScanName(''); setBaseQuery('')
    setEventTypeId(''); setEventTypeColumn('')
    setCardinalityThreshold(100); setSchedule('')
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="section-title">Scan Configs</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
          disabled={dataSources.length === 0}
          title={dataSources.length === 0 ? 'Add a data source first' : ''}
        >
          + Add Scan Config
        </button>
      </div>

      {dataSources.length === 0 && (
        <div className="card card-body text-center text-gray-500 py-8">
          Add a data source connection first (via the global Data Sources page) to create scan configs.
        </div>
      )}

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="card card-body space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="field-label">Name</label>
              <input value={scanName} onChange={e => setScanName(e.target.value)} className="input" required placeholder="e.g. Main events scan" />
            </div>
            <div className="flex-1">
              <label className="field-label">Data Source</label>
              <select value={dsId} onChange={e => setDsId(e.target.value)} className="input" required>
                <option value="">Select…</option>
                {dataSources.map((ds: DataSource) => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">Base Query (used as subquery)</label>
            <textarea
              value={baseQuery}
              onChange={e => setBaseQuery(e.target.value)}
              className="input font-mono text-sm"
              rows={4}
              required
              placeholder="SELECT * FROM analytics.events"
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="field-label">Event Type (optional)</label>
              <select value={eventTypeId} onChange={e => setEventTypeId(e.target.value)} className="input">
                <option value="">Auto-detect</option>
                {eventTypes.map((et: EventType) => (
                  <option key={et.id} value={et.id}>{et.display_name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="field-label">Event Type Column (optional)</label>
              <input value={eventTypeColumn} onChange={e => setEventTypeColumn(e.target.value)} className="input" placeholder="e.g. event_name" />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="w-40">
              <label className="field-label">Cardinality Threshold</label>
              <input type="number" value={cardinalityThreshold} onChange={e => setCardinalityThreshold(Number(e.target.value))} className="input" min={1} />
            </div>
            <div className="flex-1">
              <label className="field-label">Schedule (cron, optional)</label>
              <input value={schedule} onChange={e => setSchedule(e.target.value)} className="input" placeholder="e.g. 0 */6 * * *" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {scanConfigs.map((sc: ScanConfig) => (
        <div key={sc.id} className="card overflow-hidden">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setExpandedId(expandedId === sc.id ? null : sc.id)}
          >
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900">{sc.name}</span>
              <span className="text-gray-500 text-sm">{dsMap.get(sc.data_source_id) ?? 'Unknown'}</span>
              {sc.schedule && <span className="count-pill">⏱ {sc.schedule}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); startEditScan(sc) }}
                className="btn-edit-sm"
              >
                Edit
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(sc) }}
                className="btn-danger-sm"
              >
                Delete
              </button>
              <span className="text-gray-400 text-xs ml-2">{expandedId === sc.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {editingScanId === sc.id && (
            <div className="border-t bg-indigo-50/30 p-4 space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="field-label">Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="input" />
                </div>
                <div className="flex-1">
                  <label className="field-label">Data Source</label>
                  <input value={dsMap.get(sc.data_source_id) ?? 'Unknown'} className="input bg-gray-50" disabled />
                </div>
              </div>
              <div>
                <label className="field-label">Base Query (used as subquery)</label>
                <textarea
                  value={editBaseQuery}
                  onChange={e => setEditBaseQuery(e.target.value)}
                  className="input font-mono text-sm"
                  rows={4}
                />
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="field-label">Event Type (optional)</label>
                  <select value={editEventTypeId} onChange={e => setEditEventTypeId(e.target.value)} className="input">
                    <option value="">Auto-detect</option>
                    {eventTypes.map((et: EventType) => (
                      <option key={et.id} value={et.id}>{et.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="field-label">Event Type Column (optional)</label>
                  <input value={editEventTypeColumn} onChange={e => setEditEventTypeColumn(e.target.value)} className="input" placeholder="e.g. event_name" />
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div className="w-40">
                  <label className="field-label">Cardinality Threshold</label>
                  <input type="number" value={editCardinalityThreshold} onChange={e => setEditCardinalityThreshold(Number(e.target.value))} className="input" min={1} />
                </div>
                <div className="flex-1">
                  <label className="field-label">Schedule (cron, optional)</label>
                  <input value={editSchedule} onChange={e => setEditSchedule(e.target.value)} className="input" placeholder="e.g. 0 */6 * * *" />
                </div>
              </div>
              <div className="form-actions">
                <button onClick={() => updateMut.mutate(sc.id)} className="btn-primary">Save</button>
                <button onClick={() => setEditingScanId(null)} className="btn-secondary">Cancel</button>
              </div>
              {updateMut.isError && <p className="form-error-sm">{(updateMut.error as Error).message}</p>}
            </div>
          )}

          {expandedId === sc.id && (
            <ScanDetail slug={slug} scanConfig={sc} eventTypes={eventTypes} />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Scan Detail (jobs) ─── */
function ScanDetail({ slug, scanConfig, eventTypes }: { slug: string; scanConfig: ScanConfig; eventTypes: EventType[] }) {
  const qc = useQueryClient()
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  const etName = eventTypes.find((et: EventType) => et.id === scanConfig.event_type_id)?.display_name

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['scanJobs', slug, scanConfig.id],
    queryFn: () => scansApi.listJobs(slug, scanConfig.id),
    refetchInterval: 5000,
  })

  const runMut = useMutation({
    mutationFn: () => scansApi.run(slug, scanConfig.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scanJobs', slug, scanConfig.id] }),
  })

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <div className="border-t p-4 space-y-4">
      {/* Query info panel */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Base Query (subquery)</span>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>Threshold: <strong>{scanConfig.cardinality_threshold}</strong></span>
            {scanConfig.event_type_column && <span>Group by: <strong>{scanConfig.event_type_column}</strong></span>}
            {etName && <span>Event Type: <strong>{etName}</strong></span>}
            {scanConfig.schedule && <span>Schedule: <strong>{scanConfig.schedule}</strong></span>}
          </div>
        </div>
        <pre className="p-3 text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-x-auto">{scanConfig.base_query}</pre>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Jobs</h3>
        <button
          onClick={() => runMut.mutate()}
          disabled={runMut.isPending}
          className="btn-primary text-xs"
        >
          {runMut.isPending ? 'Starting…' : '▶ Run Scan'}
        </button>
      </div>

      {runMut.isError && <p className="form-error-sm">{(runMut.error as Error).message}</p>}

      {isLoading && <p className="text-sm text-gray-400">Loading jobs…</p>}

      {jobs.length === 0 && !isLoading && (
        <p className="text-sm text-gray-400">No jobs yet. Click "Run Scan" to start.</p>
      )}

      {jobs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Started</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2 pr-4">Result</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job: ScanJob) => {
                const duration = job.started_at && job.completed_at
                  ? `${((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(1)}s`
                  : job.started_at && job.status === 'running' ? 'running…' : '—'
                return (
                  <tr key={job.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor[job.status] ?? ''}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600 text-xs">
                      {job.started_at ? new Date(job.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 text-xs">{duration}</td>
                    <td className="py-2 text-xs">
                      {job.status === 'failed' && (
                        <span className="text-red-600">{job.error_message}</span>
                      )}
                      {job.result_summary && (
                        <div className="flex gap-3">
                          {job.result_summary.events_created != null && (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs">
                              +{job.result_summary.events_created} events
                            </span>
                          )}
                          {job.result_summary.variables_created != null && job.result_summary.variables_created > 0 && (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">
                              +{job.result_summary.variables_created} vars
                            </span>
                          )}
                          {job.result_summary.events_skipped != null && job.result_summary.events_skipped > 0 && (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                              {job.result_summary.events_skipped} skipped
                            </span>
                          )}
                          {job.result_summary.columns_analyzed != null && (
                            <span className="text-gray-500">{job.result_summary.columns_analyzed} cols</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      {(job.result_summary?.details?.length || job.error_message) && (
                        <button
                          onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          {expandedJobId === job.id ? '▲' : '▼'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Expanded job details */}
          {expandedJobId && (() => {
            const job = jobs.find((j: ScanJob) => j.id === expandedJobId)
            if (!job) return null
            return (
              <div className="mt-2 bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Job Details</h4>
                {job.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 font-mono whitespace-pre-wrap">
                    {job.error_message}
                  </div>
                )}
                {job.result_summary && (
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="bg-white rounded border p-2 text-center">
                      <div className="text-lg font-bold text-green-600">{job.result_summary.events_created ?? 0}</div>
                      <div className="text-gray-500">Events created</div>
                    </div>
                    <div className="bg-white rounded border p-2 text-center">
                      <div className="text-lg font-bold text-blue-600">{job.result_summary.variables_created ?? 0}</div>
                      <div className="text-gray-500">Variables created</div>
                    </div>
                    <div className="bg-white rounded border p-2 text-center">
                      <div className="text-lg font-bold text-gray-600">{job.result_summary.events_skipped ?? 0}</div>
                      <div className="text-gray-500">Events skipped</div>
                    </div>
                    <div className="bg-white rounded border p-2 text-center">
                      <div className="text-lg font-bold text-indigo-600">{job.result_summary.columns_analyzed ?? 0}</div>
                      <div className="text-gray-500">Columns analyzed</div>
                    </div>
                  </div>
                )}
                {job.result_summary?.details && job.result_summary.details.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-gray-600 mb-1">Log</h5>
                    <div className="bg-white rounded border p-2 max-h-48 overflow-y-auto">
                      {job.result_summary.details.map((detail, i) => (
                        <div key={i} className="text-xs font-mono text-gray-600 py-0.5 border-b border-gray-50 last:border-0">{detail}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
