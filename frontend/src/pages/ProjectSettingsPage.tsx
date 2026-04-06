import { useState, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventTypesApi } from '@/api/eventTypes'
import { fieldsApi } from '@/api/fields'
import { metaFieldsApi } from '@/api/metaFields'
import { relationsApi } from '@/api/relations'
import { variablesApi } from '@/api/variables'
import { dataSourcesApi } from '@/api/dataSources'
import { scansApi } from '@/api/scans'
import { useConfirm } from '@/hooks/useConfirm'
import type { EventType, FieldDefinition, MetaFieldDefinition, EventTypeRelation, Variable, VariableType, DataSource, ScanConfig, ScanJob } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { Plus, Pencil, Trash2, ChevronDown, ArrowUp, ArrowDown, Play, Layers, Link2, Variable as VariableIcon, List, Search } from 'lucide-react'

type SettingsTab = 'event-types' | 'meta-fields' | 'relations' | 'variables' | 'scans'

export default function ProjectSettingsPage() {
  const { slug, tab: urlTab } = useParams<{ slug: string; tab?: string }>()
  const navigate = useNavigate()
  const validTabs: SettingsTab[] = ['event-types', 'meta-fields', 'relations', 'variables', 'scans']
  const tab: SettingsTab = validTabs.includes(urlTab as SettingsTab) ? (urlTab as SettingsTab) : 'event-types'

  const changeTab = (t: string) => {
    navigate(`/p/${slug}/settings/${t}`, { replace: true })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Project Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure event types, fields, and scanning</p>
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="event-types">Event Types</TabsTrigger>
          <TabsTrigger value="meta-fields">Meta Fields</TabsTrigger>
          <TabsTrigger value="relations">Relations</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
          <TabsTrigger value="scans">Scans</TabsTrigger>
        </TabsList>
      </Tabs>

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
  const [editingEt, setEditingEt] = useState<EventType | null>(null)
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
      setEditingEt(null)
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
    setEditingEt(et)
    setEditDisplayName(et.display_name)
    setEditColor(et.color)
    setEditDescription(et.description)
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Event Types</h2>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Event Type
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader><DialogTitle>New Event Type</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label>Name (e.g. pv)</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="col-span-2 grid gap-2">
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input" />
                </div>
              </div>
              {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingEt} onOpenChange={v => { if (!v) setEditingEt(null) }}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); if (editingEt) updateMut.mutate(editingEt.id) }}>
            <DialogHeader><DialogTitle>Edit Event Type</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label>Display Name</Label>
                  <Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
                </div>
                <div className="col-span-2 grid gap-2">
                  <Label>Description</Label>
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Color</Label>
                  <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-input" />
                </div>
              </div>
              {updateMut.isError && <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingEt(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {eventTypes.length === 0 && (
        <EmptyState icon={Layers} title="No event types" description="Create event types to categorize your events." />
      )}

      {eventTypes.map((et: EventType) => (
        <Collapsible key={et.id} open={expandedId === et.id} onOpenChange={v => setExpandedId(v ? et.id : null)}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardContent className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: et.color }} />
                  <span className="font-mono text-sm font-semibold">{et.name}</span>
                  <span className="text-muted-foreground text-sm">{et.display_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{et.field_definitions.length} fields</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); startEdit(et) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); handleDelete(et) }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === et.id ? 'rotate-180' : ''}`} />
                </div>
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <FieldsEditor slug={slug} eventType={et} />
            </CollapsibleContent>
          </Card>
        </Collapsible>
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
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null)
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
      setEditingField(null)
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
    setEditingField(f)
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
    <div className="border-t px-4 py-4 bg-muted/30 space-y-3">
      {dialog}
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fields</span>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)} className="h-7 text-xs">
          <Plus className="mr-1 h-3 w-3" />
          Add Field
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader><DialogTitle>New Field</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                <div className="grid gap-2"><Label>Display Name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {fieldTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="field-req" checked={isRequired} onCheckedChange={c => setIsRequired(!!c)} />
                    <Label htmlFor="field-req" className="cursor-pointer">Required</Label>
                  </div>
                </div>
              </div>
              {fieldType === 'enum' && (
                <div className="grid gap-2">
                  <Label>Enum Options</Label>
                  <div className="flex gap-2">
                    <Input
                      value={enumInput}
                      onChange={e => setEnumInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEnumOption(enumInput, 'create') } }}
                      placeholder="Type option and press Enter" className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addEnumOption(enumInput, 'create')}>Add</Button>
                  </div>
                  {enumOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {enumOptions.map(opt => (
                        <Badge key={opt} variant="secondary" className="gap-1">
                          {opt}
                          <button type="button" onClick={() => setEnumOptions(enumOptions.filter(o => o !== opt))} className="hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingField} onOpenChange={v => { if (!v) setEditingField(null) }}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); if (editingField) saveEdit(editingField.id) }}>
            <DialogHeader><DialogTitle>Edit Field</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Display Name</Label><Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} /></div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <select value={editFieldType} onChange={e => setEditFieldType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {fieldTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Description</Label><Input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Optional" /></div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-field-req" checked={editIsRequired} onCheckedChange={c => setEditIsRequired(!!c)} />
                    <Label htmlFor="edit-field-req" className="cursor-pointer">Required</Label>
                  </div>
                </div>
              </div>
              {editFieldType === 'enum' && (
                <div className="grid gap-2">
                  <Label>Enum Options</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editEnumInput}
                      onChange={e => setEditEnumInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEnumOption(editEnumInput, 'edit') } }}
                      placeholder="Type option and press Enter" className="flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addEnumOption(editEnumInput, 'edit')}>Add</Button>
                  </div>
                  {editEnumOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editEnumOptions.map(opt => (
                        <Badge key={opt} variant="secondary" className="gap-1">
                          {opt}
                          <button type="button" onClick={() => setEditEnumOptions(editEnumOptions.filter(o => o !== opt))} className="hover:text-destructive">×</button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {updateMut.isError && <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {sortedFields.length > 0 ? (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Display</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-16">Req</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedFields.map((f: FieldDefinition, idx: number) => (
                <TableRow key={f.id}>
                  <TableCell className="py-1">
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveField(idx, -1)} disabled={idx === 0 || reorderMut.isPending}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveField(idx, 1)} disabled={idx === sortedFields.length - 1 || reorderMut.isPending}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{f.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{f.display_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{f.field_type}</Badge>
                    {f.field_type === 'enum' && f.enum_options && <span className="text-muted-foreground text-[10px] ml-1">({f.enum_options.length})</span>}
                  </TableCell>
                  <TableCell>{f.is_required ? <span className="text-green-600 font-medium text-xs">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(f)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteField(f)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">No fields defined yet.</p>
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
  const [editingMf, setEditingMf] = useState<MetaFieldDefinition | null>(null)
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
      setEditingMf(null)
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
    setEditingMf(mf)
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
        <h2 className="text-lg font-semibold">Meta Fields</h2>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Meta Field</Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader><DialogTitle>New Meta Field</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Name (e.g. jira_link)</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                <div className="grid gap-2"><Label>Display Name</Label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <select value={fieldType} onChange={e => setFieldType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {metaFieldTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="meta-req" checked={isRequired} onCheckedChange={c => setIsRequired(!!c)} />
                    <Label htmlFor="meta-req" className="cursor-pointer">Required</Label>
                  </div>
                </div>
              </div>
              {fieldType === 'enum' && (
                <div className="grid gap-2">
                  <Label>Enum Options</Label>
                  <div className="flex gap-2">
                    <Input value={enumInput} onChange={e => setEnumInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMetaEnumOption(enumInput, 'create') } }}
                      placeholder="Type option and press Enter" className="flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => addMetaEnumOption(enumInput, 'create')}>Add</Button>
                  </div>
                  {enumOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {enumOptions.map(opt => (
                        <Badge key={opt} variant="secondary" className="gap-1">{opt}<button type="button" onClick={() => setEnumOptions(enumOptions.filter(o => o !== opt))} className="hover:text-destructive">×</button></Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-2"><Label>Default Value (optional)</Label><Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="Optional default" /></div>
              {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingMf} onOpenChange={v => { if (!v) setEditingMf(null) }}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); if (editingMf) updateMut.mutate(editingMf.id) }}>
            <DialogHeader><DialogTitle>Edit: {editingMf?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Display Name</Label><Input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} /></div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <select value={editFieldType} onChange={e => setEditFieldType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {metaFieldTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Default Value</Label><Input value={editDefaultValue} onChange={e => setEditDefaultValue(e.target.value)} placeholder="Optional" /></div>
                <div className="flex items-end pb-2">
                  <div className="flex items-center gap-2">
                    <Checkbox id="edit-meta-req" checked={editIsRequired} onCheckedChange={c => setEditIsRequired(!!c)} />
                    <Label htmlFor="edit-meta-req" className="cursor-pointer">Required</Label>
                  </div>
                </div>
              </div>
              {editFieldType === 'enum' && (
                <div className="grid gap-2">
                  <Label>Enum Options</Label>
                  <div className="flex gap-2">
                    <Input value={editEnumInput} onChange={e => setEditEnumInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMetaEnumOption(editEnumInput, 'edit') } }}
                      placeholder="Type option and press Enter" className="flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={() => addMetaEnumOption(editEnumInput, 'edit')}>Add</Button>
                  </div>
                  {editEnumOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editEnumOptions.map(opt => (
                        <Badge key={opt} variant="secondary" className="gap-1">{opt}<button type="button" onClick={() => setEditEnumOptions(editEnumOptions.filter(o => o !== opt))} className="hover:text-destructive">×</button></Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {updateMut.isError && <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingMf(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {metaFields.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Display</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-16">Req</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metaFields.map((mf: MetaFieldDefinition) => (
                <TableRow key={mf.id}>
                  <TableCell className="font-mono text-xs">{mf.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{mf.display_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{mf.field_type}</Badge>
                    {mf.field_type === 'enum' && mf.enum_options && <span className="text-muted-foreground text-[10px] ml-1">({mf.enum_options.length})</span>}
                  </TableCell>
                  <TableCell>{mf.is_required ? <span className="text-green-600 font-medium text-xs">✓</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{mf.default_value ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(mf)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(mf)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={List} title="No meta fields" description="Define meta fields to add structured metadata to your events." action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Meta Field</Button>} />
      )}
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
        <h2 className="text-lg font-semibold">Relations</h2>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Relation</Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader><DialogTitle>New Relation</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Source Event Type</Label>
                  <select value={srcEtId} onChange={e => { setSrcEtId(e.target.value); setSrcFieldId('') }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">Select...</option>
                    {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Target Event Type</Label>
                  <select value={tgtEtId} onChange={e => { setTgtEtId(e.target.value); setTgtFieldId('') }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">Select...</option>
                    {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Source Field</Label>
                  <select value={srcFieldId} onChange={e => setSrcFieldId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">Select...</option>
                    {srcEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Target Field</Label>
                  <select value={tgtFieldId} onChange={e => setTgtFieldId(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    <option value="">Select...</option>
                    {tgtEt?.field_definitions.map(f => <option key={f.id} value={f.id}>{f.display_name}</option>)}
                  </select>
                </div>
              </div>
              {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={!srcFieldId || !tgtFieldId || createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {relations.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relations.map((r: EventTypeRelation) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{etMap[r.source_event_type_id]?.name ?? '?'}</TableCell>
                  <TableCell className="text-muted-foreground">→</TableCell>
                  <TableCell className="font-mono text-xs">{etMap[r.target_event_type_id]?.name ?? '?'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.relation_type}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(r)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={Link2} title="No relations" description="Create relations to link event types by their fields." action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Relation</Button>} />
      )}
    </div>
  )
}

function VariablesTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [varType, setVarType] = useState<VariableType>('string')
  const [description, setDescription] = useState('')
  const [editingVar, setEditingVar] = useState<Variable | null>(null)
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
      setEditingVar(null)
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
    setEditingVar(v)
    setEditVarType(v.variable_type)
    setEditDescription(v.description)
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Variables</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Define template placeholders. Use <code className="bg-muted px-1 rounded">{'${var_name}'}</code> in event field values.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Variable</Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader><DialogTitle>New Variable</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name (lowercase, e.g. spot_id)</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="my_variable" pattern="^[a-z][a-z0-9_]*$" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <select value={varType} onChange={e => setVarType(e.target.value as VariableType)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {variableTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingVar} onOpenChange={v => { if (!v) setEditingVar(null) }}>
        <DialogContent>
          <form onSubmit={e => { e.preventDefault(); if (editingVar) updateMut.mutate(editingVar.id) }}>
            <DialogHeader><DialogTitle>Edit: {editingVar?.name}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <select value={editVarType} onChange={e => setEditVarType(e.target.value as VariableType)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                    {variableTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <Input value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
              </div>
              {updateMut.isError && <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingVar(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {variables.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((v: Variable) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{typeLabels[v.variable_type]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.description}</TableCell>
                  <TableCell><code className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{`\${${v.name}}`}</code></TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(v)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(v)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={VariableIcon} title="No variables" description="Define template placeholders to reuse across event field values." action={<Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" />Add Variable</Button>} />
      )}
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

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Scan Configs</h2>
        <Button onClick={() => setShowForm(true)} disabled={dataSources.length === 0}
          title={dataSources.length === 0 ? 'Add a data source first' : ''}>
          <Plus className="mr-2 h-4 w-4" />Add Scan Config
        </Button>
      </div>

      {dataSources.length === 0 && (
        <EmptyState icon={Search} title="No data sources" description="Add a data source connection first (via the global Data Sources page) to create scan configs." />
      )}

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) resetForm(); else setShowForm(true) }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader><DialogTitle>New Scan Config</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Name</Label><Input value={scanName} onChange={e => setScanName(e.target.value)} required placeholder="e.g. Main events scan" /></div>
                <div className="grid gap-2">
                  <Label>Data Source</Label>
                  <select value={dsId} onChange={e => setDsId(e.target.value)} className={selectClass} required>
                    <option value="">Select…</option>
                    {dataSources.map((ds: DataSource) => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Base Query (used as subquery)</Label>
                <Textarea value={baseQuery} onChange={e => setBaseQuery(e.target.value)} className="font-mono text-sm" rows={4} required placeholder="SELECT * FROM analytics.events" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Event Type (optional)</Label>
                  <select value={eventTypeId} onChange={e => setEventTypeId(e.target.value)} className={selectClass}>
                    <option value="">Auto-detect</option>
                    {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
                  </select>
                </div>
                <div className="grid gap-2"><Label>Event Type Column (optional)</Label><Input value={eventTypeColumn} onChange={e => setEventTypeColumn(e.target.value)} placeholder="e.g. event_name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Cardinality Threshold</Label><Input type="number" value={cardinalityThreshold} onChange={e => setCardinalityThreshold(Number(e.target.value))} min={1} /></div>
                <div className="grid gap-2"><Label>Schedule (cron, optional)</Label><Input value={schedule} onChange={e => setSchedule(e.target.value)} placeholder="e.g. 0 */6 * * *" /></div>
              </div>
              {createMut.isError && <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingScanId} onOpenChange={v => { if (!v) setEditingScanId(null) }}>
        <DialogContent className="max-w-lg">
          <form onSubmit={e => { e.preventDefault(); if (editingScanId) updateMut.mutate(editingScanId) }}>
            <DialogHeader><DialogTitle>Edit Scan Config</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2"><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
              <div className="grid gap-2">
                <Label>Base Query (used as subquery)</Label>
                <Textarea value={editBaseQuery} onChange={e => setEditBaseQuery(e.target.value)} className="font-mono text-sm" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Event Type (optional)</Label>
                  <select value={editEventTypeId} onChange={e => setEditEventTypeId(e.target.value)} className={selectClass}>
                    <option value="">Auto-detect</option>
                    {eventTypes.map((et: EventType) => <option key={et.id} value={et.id}>{et.display_name}</option>)}
                  </select>
                </div>
                <div className="grid gap-2"><Label>Event Type Column (optional)</Label><Input value={editEventTypeColumn} onChange={e => setEditEventTypeColumn(e.target.value)} placeholder="e.g. event_name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Cardinality Threshold</Label><Input type="number" value={editCardinalityThreshold} onChange={e => setEditCardinalityThreshold(Number(e.target.value))} min={1} /></div>
                <div className="grid gap-2"><Label>Schedule (cron, optional)</Label><Input value={editSchedule} onChange={e => setEditSchedule(e.target.value)} placeholder="e.g. 0 */6 * * *" /></div>
              </div>
              {updateMut.isError && <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingScanId(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {scanConfigs.map((sc: ScanConfig) => (
        <Collapsible key={sc.id} open={expandedId === sc.id} onOpenChange={open => setExpandedId(open ? sc.id : null)}>
          <Card>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{sc.name}</span>
                  <span className="text-muted-foreground text-sm">{dsMap.get(sc.data_source_id) ?? 'Unknown'}</span>
                  {sc.schedule && <Badge variant="outline" className="text-xs">⏱ {sc.schedule}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); startEditScan(sc) }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={e => { e.stopPropagation(); handleDelete(sc) }}><Trash2 className="h-3 w-3" /></Button>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedId === sc.id ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScanDetail slug={slug} scanConfig={sc} eventTypes={eventTypes} />
            </CollapsibleContent>
          </Card>
        </Collapsible>
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

  const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    pending: 'outline',
    running: 'secondary',
    completed: 'default',
    failed: 'destructive',
  }

  return (
    <div className="border-t p-4 space-y-4">
      {/* Query info panel */}
      <div className="rounded-lg border bg-muted/30 overflow-hidden">
        <div className="px-3 py-2 bg-muted/50 border-b flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Base Query (subquery)</span>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Threshold: <strong className="text-foreground">{scanConfig.cardinality_threshold}</strong></span>
            {scanConfig.event_type_column && <span>Group by: <strong className="text-foreground">{scanConfig.event_type_column}</strong></span>}
            {etName && <span>Event Type: <strong className="text-foreground">{etName}</strong></span>}
            {scanConfig.schedule && <span>Schedule: <strong className="text-foreground">{scanConfig.schedule}</strong></span>}
          </div>
        </div>
        <pre className="p-3 text-xs font-mono text-foreground/80 whitespace-pre-wrap overflow-x-auto">{scanConfig.base_query}</pre>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Jobs</h3>
        <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
          <Play className="mr-1 h-3 w-3" />
          {runMut.isPending ? 'Starting…' : 'Run Scan'}
        </Button>
      </div>

      {runMut.isError && <p className="text-sm text-destructive">{(runMut.error as Error).message}</p>}

      {isLoading && <p className="text-sm text-muted-foreground">Loading jobs…</p>}

      {jobs.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No jobs yet. Click "Run Scan" to start.</p>
      )}

      {jobs.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job: ScanJob) => {
                const duration = job.started_at && job.completed_at
                  ? `${((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000).toFixed(1)}s`
                  : job.started_at && job.status === 'running' ? 'running…' : '—'
                return (
                  <Fragment key={job.id}>
                  <TableRow>
                    <TableCell>
                      <Badge variant={statusVariant[job.status] ?? 'outline'} className="text-xs">{job.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {job.started_at ? new Date(job.started_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{duration}</TableCell>
                    <TableCell className="text-xs">
                      {job.status === 'failed' && (
                        <span className="text-destructive">{job.error_message}</span>
                      )}
                      {job.result_summary && (
                        <div className="flex gap-2">
                          {job.result_summary.events_created != null && (
                            <Badge variant="outline" className="text-[10px] text-green-600">+{job.result_summary.events_created} events</Badge>
                          )}
                          {job.result_summary.variables_created != null && job.result_summary.variables_created > 0 && (
                            <Badge variant="outline" className="text-[10px] text-blue-600">+{job.result_summary.variables_created} vars</Badge>
                          )}
                          {job.result_summary.events_skipped != null && job.result_summary.events_skipped > 0 && (
                            <Badge variant="outline" className="text-[10px]">{job.result_summary.events_skipped} skipped</Badge>
                          )}
                          {job.result_summary.columns_analyzed != null && (
                            <span className="text-muted-foreground text-[10px]">{job.result_summary.columns_analyzed} cols</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(job.result_summary?.details?.length || job.error_message) && (
                        <Button variant="ghost" size="icon" className="h-6 w-6"
                          onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}>
                          <ChevronDown className={`h-3 w-3 transition-transform ${expandedJobId === job.id ? 'rotate-180' : ''}`} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedJobId === job.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <div className="p-4 space-y-3 bg-muted/30">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job Details</h4>
                          {job.error_message && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive font-mono whitespace-pre-wrap">
                              {job.error_message}
                            </div>
                          )}
                          {job.result_summary && (
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <Card className="p-3 text-center"><div className="text-lg font-bold text-green-600">{job.result_summary.events_created ?? 0}</div><div className="text-muted-foreground">Events created</div></Card>
                              <Card className="p-3 text-center"><div className="text-lg font-bold text-blue-600">{job.result_summary.variables_created ?? 0}</div><div className="text-muted-foreground">Variables created</div></Card>
                              <Card className="p-3 text-center"><div className="text-lg font-bold text-foreground">{job.result_summary.events_skipped ?? 0}</div><div className="text-muted-foreground">Events skipped</div></Card>
                              <Card className="p-3 text-center"><div className="text-lg font-bold text-primary">{job.result_summary.columns_analyzed ?? 0}</div><div className="text-muted-foreground">Columns analyzed</div></Card>
                            </div>
                          )}
                          {job.result_summary?.details && job.result_summary.details.length > 0 && (
                            <div>
                              <h5 className="text-xs font-semibold text-muted-foreground mb-1">Log</h5>
                              <div className="rounded-lg border bg-background p-2 max-h-48 overflow-y-auto">
                                {job.result_summary.details.map((detail, i) => (
                                  <div key={i} className="text-xs font-mono text-muted-foreground py-0.5 border-b border-border/50 last:border-0">{detail}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
