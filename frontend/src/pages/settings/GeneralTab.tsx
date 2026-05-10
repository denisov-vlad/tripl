import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function GeneralTab({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const projectQuery = useQuery({
    queryKey: ['project', slug],
    queryFn: () => projectsApi.get(slug),
  })

  const [name, setName] = useState('')
  const [slugDraft, setSlugDraft] = useState('')
  const [description, setDescription] = useState('')
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)

  if (projectQuery.data && hydratedFor !== projectQuery.data.id) {
    setName(projectQuery.data.name)
    setSlugDraft(projectQuery.data.slug)
    setDescription(projectQuery.data.description ?? '')
    setHydratedFor(projectQuery.data.id)
  }

  const updateMut = useMutation({
    mutationFn: () => projectsApi.update(slug, {
      name,
      slug: slugDraft,
      description,
    }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project'] })
      if (project.slug !== slug) {
        navigate(`/p/${project.slug}/settings/general`, { replace: true })
      }
    },
  })

  const slugError = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugDraft)
    ? 'Slug must be lowercase letters, digits, and hyphens'
    : null
  const isPristine =
    !!projectQuery.data
    && name === projectQuery.data.name
    && slugDraft === projectQuery.data.slug
    && description === (projectQuery.data.description ?? '')

  return (
    <>
      {projectQuery.isLoading && (
        <p className="text-sm text-muted-foreground">Loading project…</p>
      )}
      {projectQuery.isError && (
        <p className="text-sm text-destructive">Failed to load project.</p>
      )}
      {projectQuery.data && (
        <Card>
          <CardContent className="p-4">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (slugError) return
                updateMut.mutate()
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="grid gap-1.5">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="project-slug">Slug</Label>
                  <Input
                    id="project-slug"
                    value={slugDraft}
                    onChange={(event) => setSlugDraft(event.target.value)}
                    className="font-mono"
                    required
                  />
                </div>
              </div>
              {slugError && slugDraft.length > 0 ? (
                <p className="text-xs text-destructive">{slugError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Slug is used in URLs. Lowercase letters, digits, and hyphens. Changing it rewrites all project URLs.
                </p>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                />
              </div>
              {updateMut.isError && (
                <p className="text-sm text-destructive">{(updateMut.error as Error).message}</p>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={updateMut.isPending || isPristine || !!slugError}
                >
                  {updateMut.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  )
}
