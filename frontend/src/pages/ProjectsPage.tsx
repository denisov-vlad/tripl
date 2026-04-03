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

  if (isLoading) return <div className="text-gray-500">Loading...</div>

  return (
    <div>
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
        >
          + New Project
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); createMut.mutate() }}
          className="bg-white border rounded-xl p-5 mb-6 space-y-4 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Project name</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); if (!slugTouched) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Slug (url-friendly)</label>
              <input
                value={slug}
                onChange={e => { setSlugTouched(true); setSlug(e.target.value) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              rows={2}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
              Cancel
            </button>
          </div>
          {createMut.isError && <p className="text-red-600 text-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="grid gap-4">
        {projects.map((p: Project) => (
          <div key={p.id} className="bg-white border rounded-xl p-5 flex items-center justify-between hover:border-indigo-300 shadow-sm transition">
            <Link to={`/p/${p.slug}/events`} className="flex-1">
              <h2 className="font-semibold text-gray-900">{p.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{p.slug}{p.description && ` — ${p.description}`}</p>
            </Link>
            <button
              onClick={() => handleDelete(p)}
              className="ml-4 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              Delete
            </button>
          </div>
        ))}
        {projects.length === 0 && !showForm && (
          <p className="text-gray-400 text-center py-12">No projects yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
