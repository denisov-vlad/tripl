import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectsApi } from '../api/projects'
import { useConfirm } from '../hooks/useConfirm'
import type { Project } from '../types'

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const { confirm, dialog } = useConfirm()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMut = useMutation({
    mutationFn: () => projectsApi.create({ name, slug, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
      setName(''); setSlug(''); setSlugTouched(false); setDescription('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (s: string) => projectsApi.del(s),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const handleDelete = async (p: Project) => {
    const ok = await confirm({
      title: 'Delete project',
      message: `Are you sure you want to delete "${p.name}"? All event types and events will be permanently removed.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(p.slug)
  }

  if (isLoading) return <div className="cell-muted">Loading...</div>

  return (
    <div>
      {dialog}
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          + New Project
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); createMut.mutate() }}
          className="form-card"
        >
          <div className="form-grid-2">
            <div>
              <label className="field-label">Project name</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) }}
                className="input"
                required
              />
            </div>
            <div>
              <label className="field-label">Slug (url-friendly)</label>
              <input
                value={slug}
                onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
                className="input-mono"
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                required
              />
            </div>
          </div>
          <div>
            <label className="field-label">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="textarea"
              rows={2}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
          {createMut.isError && <p className="form-error">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="grid gap-4">
        {projects.map((p: Project) => (
          <div key={p.id} className="card-hover p-5 flex items-center justify-between">
            <Link to={`/p/${p.slug}/events`} className="flex-1 no-underline">
              <h2 className="font-semibold text-gray-900">{p.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{p.slug}{p.description && ` — ${p.description}`}</p>
            </Link>
            <button onClick={() => handleDelete(p)} className="btn-danger-sm ml-4">
              Delete
            </button>
          </div>
        ))}
        {projects.length === 0 && !showForm && (
          <p className="table-empty">No projects yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
