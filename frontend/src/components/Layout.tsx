import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { ActivityPanel } from '@/components/activity-panel'
import { AppSidebar } from '@/components/app-sidebar'
import { CommandPaletteProvider } from '@/components/command-palette'
import { ErrorState } from '@/components/error-state'
import { TopBar } from '@/components/top-bar'
import { TweaksPanelProvider } from '@/components/tweaks-panel'

const ACTIVITY_STORAGE_KEY = 'tripl-activity-open'

function useActivityOpen() {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(ACTIVITY_STORAGE_KEY)
      if (stored === '0') return false
      if (stored === '1') return true
    } catch {
      /* ignore */
    }
    return typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  })
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVITY_STORAGE_KEY, open ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [open])
  return [open, setOpen] as const
}

type Crumbs = { crumbs: string[]; title: string }

function resolveCrumbs(pathname: string, projectName?: string): Crumbs {
  if (pathname === '/') return { crumbs: [], title: 'Overview' }
  if (pathname.startsWith('/data-sources')) {
    return { crumbs: [], title: 'Data sources' }
  }
  if (pathname.startsWith('/auth')) return { crumbs: [], title: 'Sign in' }

  const projectCrumb = projectName ?? 'project'

  if (pathname.includes('/settings')) {
    return { crumbs: [projectCrumb], title: 'Settings' }
  }
  if (pathname.includes('/monitoring/')) {
    return { crumbs: [projectCrumb, 'Monitoring'], title: 'Detail' }
  }
  if (pathname.includes('/events/detail/')) {
    return { crumbs: [projectCrumb, 'Events'], title: 'Detail' }
  }
  if (pathname.includes('/events')) {
    return { crumbs: [projectCrumb], title: 'Events' }
  }
  return { crumbs: [projectCrumb], title: 'Overview' }
}

export default function Layout() {
  const location = useLocation()
  const { slug } = useParams()
  const [activityOpen, setActivityOpen] = useActivityOpen()

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })
  const projects = projectsQuery.data ?? []
  const activeProject = projects.find((p) => p.slug === slug)

  const { crumbs, title } = useMemo(
    () => resolveCrumbs(location.pathname, activeProject?.name ?? slug),
    [location.pathname, activeProject?.name, slug],
  )

  const onDetailPage =
    location.pathname.includes('/detail/') ||
    location.pathname.includes('/monitoring/')

  return (
    <TweaksPanelProvider>
      <CommandPaletteProvider>
        <div
          className="flex h-screen overflow-hidden"
          style={{ background: 'var(--bg)', color: 'var(--fg)' }}
        >
          <AppSidebar />

          <main
            className="flex min-w-0 flex-1 flex-col"
            style={{ background: 'var(--bg)' }}
          >
            <TopBar
              title={title}
              crumbs={crumbs}
              projectSlug={slug}
              activityOpen={activityOpen}
              onToggleActivity={() => setActivityOpen((o) => !o)}
            />

            <div className="flex flex-1 overflow-hidden">
              <div className="relative min-w-0 flex-1 overflow-y-auto">
                <div className="p-6 lg:p-8">
                  {projectsQuery.isError && (
                    <div className="mb-6">
                      <ErrorState
                        title="Backend is unavailable"
                        description="The frontend is up, but the initial API request failed."
                        error={projectsQuery.error}
                        onRetry={() => {
                          void projectsQuery.refetch()
                        }}
                      />
                    </div>
                  )}
                  <Outlet />
                </div>
              </div>

              <ActivityPanel open={activityOpen && !onDetailPage} slug={slug} />
            </div>
          </main>
        </div>
      </CommandPaletteProvider>
    </TweaksPanelProvider>
  )
}
