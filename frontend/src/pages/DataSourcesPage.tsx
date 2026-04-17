import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataSourcesApi } from '@/api/dataSources'
import { useConfirm } from '@/hooks/useConfirm'
import type { DataSource, DbType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Database, Plus, Pencil, Trash2, Plug, CheckCircle2, XCircle } from 'lucide-react'

const EMPTY_DATA_SOURCES: DataSource[] = []

export default function DataSourcesPage() {
  const { dsId } = useParams<{ dsId?: string }>()
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage database connections for event scanning
        </p>
      </div>
      <ConnectionsTab openDsId={dsId} />
    </div>
  )
}

function ConnectionsTab({ openDsId }: { openDsId?: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingDs, setEditingDs] = useState<DataSource | null>(null)
  const { confirm, dialog } = useConfirm()

  // form state
  const [name, setName] = useState('')
  const [dbType] = useState<DbType>('clickhouse')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(8123)
  const [databaseName, setDatabaseName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // edit state
  const [editName, setEditName] = useState('')
  const [editHost, setEditHost] = useState('')
  const [editPort, setEditPort] = useState(8123)
  const [editDatabaseName, setEditDatabaseName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const [editPassword, setEditPassword] = useState('')

  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)

  const dataSourcesQuery = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => dataSourcesApi.list(),
  })
  const dataSources = dataSourcesQuery.data ?? EMPTY_DATA_SOURCES

  const createMut = useMutation({
    mutationFn: () =>
      dataSourcesApi.create({
        name, db_type: dbType, host, port,
        database_name: databaseName, username, password,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dataSources'] })
      resetForm()
    },
  })

  const updateMut = useMutation({
    mutationFn: (id: string) =>
      dataSourcesApi.update(id, {
        name: editName, host: editHost, port: editPort,
        database_name: editDatabaseName, username: editUsername,
        ...(editPassword ? { password: editPassword } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dataSources'] })
      closeEdit()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => dataSourcesApi.del(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dataSources'] }),
  })

  const handleDelete = async (ds: DataSource) => {
    const ok = await confirm({
      title: 'Delete data source',
      message: `Delete "${ds.name}"? All associated scan configs and jobs will be removed.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(ds.id)
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    setTestResult(null)
    try {
      await dataSourcesApi.testConnection(id)
      setTestResult({ id, ok: true, msg: 'Connection successful' })
    } catch (err) {
      setTestResult({ id, ok: false, msg: (err as Error).message })
    } finally {
      setTestingId(null)
    }
  }

  const startEdit = useCallback((ds: DataSource) => {
    setEditingDs(ds)
    setEditName(ds.name)
    setEditHost(ds.host)
    setEditPort(ds.port)
    setEditDatabaseName(ds.database_name)
    setEditUsername(ds.username)
    setEditPassword('')
    navigate(`/data-sources/${ds.id}`, { replace: true })
  }, [navigate])

  const closeEdit = () => {
    setEditingDs(null)
    navigate('/data-sources', { replace: true })
  }

  // Open data source from URL
  useEffect(() => {
    if (openDsId && dataSources.length > 0) {
      const ds = dataSources.find((d: DataSource) => d.id === openDsId)
      if (ds && editingDs?.id !== ds.id) startEdit(ds)
    }
  }, [openDsId, dataSources, editingDs?.id, startEdit])

  const resetForm = () => {
    setShowForm(false)
    setName(''); setHost(''); setPort(8123)
    setDatabaseName(''); setUsername(''); setPassword('')
  }

  return (
    <div className="space-y-4">
      {dialog}

      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) resetForm() }}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={e => { e.preventDefault(); createMut.mutate() }}>
            <DialogHeader>
              <DialogTitle>New data source</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Production ClickHouse" />
                </div>
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Input value={dbType} disabled className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label>Host</Label>
                  <Input value={host} onChange={e => setHost(e.target.value)} required placeholder="localhost" />
                </div>
                <div className="grid gap-2">
                  <Label>Port</Label>
                  <Input type="number" value={port} onChange={e => setPort(Number(e.target.value))} required />
                </div>
                <div className="col-span-2 grid gap-2">
                  <Label>Database</Label>
                  <Input value={databaseName} onChange={e => setDatabaseName(e.target.value)} required placeholder="default" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="default" />
                </div>
                <div className="grid gap-2">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
              </div>
              {createMut.isError && (
                <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              <Button type="submit" disabled={createMut.isPending}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingDs} onOpenChange={v => { if (!v) closeEdit() }}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={e => { e.preventDefault(); if (editingDs) updateMut.mutate(editingDs.id) }}>
            <DialogHeader>
              <DialogTitle>Edit data source</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2 grid gap-2">
                  <Label>Host</Label>
                  <Input value={editHost} onChange={e => setEditHost(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Port</Label>
                  <Input type="number" value={editPort} onChange={e => setEditPort(Number(e.target.value))} />
                </div>
                <div className="col-span-2 grid gap-2">
                  <Label>Database</Label>
                  <Input value={editDatabaseName} onChange={e => setEditDatabaseName(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Username</Label>
                  <Input value={editUsername} onChange={e => setEditUsername(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Password</Label>
                  <Input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave empty to keep" />
                </div>
              </div>
              {updateMut.isError && (
                <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => closeEdit()}>Cancel</Button>
              <Button type="submit" disabled={updateMut.isPending}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Data source cards */}
      {dataSourcesQuery.isError && (
        <ErrorState
          title="Failed to load data sources"
          description="The page could not fetch connection data from the backend."
          error={dataSourcesQuery.error}
          onRetry={() => { void dataSourcesQuery.refetch() }}
        />
      )}

      {!dataSourcesQuery.isError && dataSources.length === 0 && (
        <EmptyState
          icon={Database}
          title="No data sources"
          description="Add a database connection to start scanning for events."
          action={
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          }
        />
      )}

      {!dataSourcesQuery.isError && dataSources.map((ds: DataSource) => (
        <Card key={ds.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs uppercase">
                  {ds.db_type.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{ds.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {ds.host}:{ds.port}/{ds.database_name}
                    </Badge>
                    {ds.password_set && (
                      <Badge variant="secondary" className="text-[10px]">🔒</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => handleTest(ds.id)}
                  disabled={testingId === ds.id}
                >
                  <Plug className="mr-1.5 h-3.5 w-3.5" />
                  {testingId === ds.id ? 'Testing…' : 'Test'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => startEdit(ds)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(ds)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {testResult?.id === ds.id && (
              <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>
                {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.msg}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
