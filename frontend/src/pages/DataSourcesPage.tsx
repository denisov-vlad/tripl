import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dataSourcesApi } from '../api/dataSources'
import { useConfirm } from '../hooks/useConfirm'
import type { DataSource, DbType } from '../types'

export default function DataSourcesPage() {
  return (
    <div>
      <h1 className="page-title mb-6">Data Sources</h1>
      <ConnectionsTab />
    </div>
  )
}

/* ─── Connections ─── */
function ConnectionsTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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

  const { data: dataSources = [] } = useQuery({
    queryKey: ['dataSources'],
    queryFn: () => dataSourcesApi.list(),
  })

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
      setEditingId(null)
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

  const startEdit = (ds: DataSource) => {
    setEditingId(ds.id)
    setEditName(ds.name)
    setEditHost(ds.host)
    setEditPort(ds.port)
    setEditDatabaseName(ds.database_name)
    setEditUsername(ds.username)
    setEditPassword('')
  }

  const resetForm = () => {
    setShowForm(false)
    setName(''); setHost(''); setPort(8123)
    setDatabaseName(''); setUsername(''); setPassword('')
  }

  return (
    <div className="space-y-4">
      {dialog}
      <div className="flex justify-between items-center">
        <h2 className="section-title">Connections</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + Add Connection
        </button>
      </div>

      {showForm && (
        <form onSubmit={e => { e.preventDefault(); createMut.mutate() }} className="card card-body space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="field-label">Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="input" required placeholder="e.g. Production ClickHouse" />
            </div>
            <div className="w-36">
              <label className="field-label">Type</label>
              <input value={dbType} className="input bg-gray-50" disabled />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="field-label">Host</label>
              <input value={host} onChange={e => setHost(e.target.value)} className="input" required placeholder="localhost" />
            </div>
            <div className="w-28">
              <label className="field-label">Port</label>
              <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} className="input" required />
            </div>
            <div className="flex-1">
              <label className="field-label">Database</label>
              <input value={databaseName} onChange={e => setDatabaseName(e.target.value)} className="input" required placeholder="default" />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="field-label">Username</label>
              <input value={username} onChange={e => setUsername(e.target.value)} className="input" placeholder="default" />
            </div>
            <div className="flex-1">
              <label className="field-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="••••••••" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      {dataSources.length === 0 && !showForm && (
        <div className="card card-body text-center text-gray-500 py-12">
          No data sources configured yet. Add a connection to get started.
        </div>
      )}

      {dataSources.map((ds: DataSource) => (
        <div key={ds.id} className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded bg-indigo-100 text-indigo-700 text-xs font-bold uppercase">{ds.db_type.slice(0, 2)}</span>
              <div>
                <span className="font-semibold text-gray-900">{ds.name}</span>
                <span className="text-gray-500 text-sm ml-2">{ds.host}:{ds.port}/{ds.database_name}</span>
              </div>
              <span className="count-pill">{ds.password_set ? '🔒' : '🔓'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTest(ds.id)}
                disabled={testingId === ds.id}
                className="btn-secondary text-xs"
              >
                {testingId === ds.id ? 'Testing…' : 'Test'}
              </button>
              <button onClick={() => startEdit(ds)} className="btn-edit-sm">Edit</button>
              <button onClick={() => handleDelete(ds)} className="btn-danger-sm">Delete</button>
            </div>
          </div>

          {testResult?.id === ds.id && (
            <div className={`px-4 pb-3 text-sm ${testResult.ok ? 'text-green-700' : 'text-red-600'}`}>
              {testResult.msg}
            </div>
          )}

          {editingId === ds.id && (
            <div className="border-t bg-indigo-50/30 p-4 space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="field-label">Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} className="input" />
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="field-label">Host</label>
                  <input value={editHost} onChange={e => setEditHost(e.target.value)} className="input" />
                </div>
                <div className="w-28">
                  <label className="field-label">Port</label>
                  <input type="number" value={editPort} onChange={e => setEditPort(Number(e.target.value))} className="input" />
                </div>
                <div className="flex-1">
                  <label className="field-label">Database</label>
                  <input value={editDatabaseName} onChange={e => setEditDatabaseName(e.target.value)} className="input" />
                </div>
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="field-label">Username</label>
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="input" />
                </div>
                <div className="flex-1">
                  <label className="field-label">Password</label>
                  <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="input" placeholder="Leave empty to keep current" />
                </div>
              </div>
              <div className="form-actions">
                <button onClick={() => updateMut.mutate(ds.id)} className="btn-primary">Save</button>
                <button onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
              </div>
              {updateMut.isError && <p className="form-error-sm">{(updateMut.error as Error).message}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
