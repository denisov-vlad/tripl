import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { projectsApi } from '../api/projects'
import type { Project } from '../types'

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMut = useMutation({
    mutationFn: () => projectsApi.create({ name, slug, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
      setName(''); setSlug(''); setDescription('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (s: string) => projectsApi.del(s),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  if (isLoading) return <div className="text-gray-500">Loading...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700"
        >
          + New Project
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={e => { e.preventDefault(); createMut.mutate() }}
          className="bg-white border rounded-lg p-4 mb-6 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Project name"
              value={name}
              onChange={e => { setName(e.target.value); if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) }}
              className="border rounded px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="slug (url-friendly)"
              value={slug}
              onChange={e => setSlug(e.target.value)}
              className="border rounded px-3 py-2 text-sm font-mono"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              required
            />
          </div>
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full"
            rows={2}
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-sm">
              Cancel
            </button>
          </div>
          {createMut.isError && <p className="text-red-500 text-sm">{(createMut.error as Error).message}</p>}
        </form>
      )}

      <div className="grid gap-4">
        {projects.map((p: Project) => (
          <div key={p.id} className="bg-white border rounded-lg p-4 flex items-center justify-between hover:border-indigo-300 transition">
            <Link to={`/p/${p.slug}/events`} className="flex-1">
              <h2 className="font-semibold text-gray-900">{p.name}</h2>
              <p className="text-sm text-gray-500">{p.slug}{p.description && ` — ${p.description}`}</p>
            </Link>
            <button
              onClick={() => { if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.slug) }}
              className="text-red-400 hover:text-red-600 text-sm ml-4"
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
