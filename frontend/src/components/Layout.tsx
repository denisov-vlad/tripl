import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { ErrorState } from '@/components/error-state'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from './app-sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function Layout() {
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar />
      <ScrollArea className="min-w-0 flex-1">
        <main className="min-w-0 p-6 lg:p-8">
          {projectsQuery.isError && (
            <div className="mb-6">
              <ErrorState
                title="Backend is unavailable"
                description="The frontend is up, but the initial API request failed."
                error={projectsQuery.error}
                onRetry={() => { void projectsQuery.refetch() }}
              />
            </div>
          )}
          <Outlet />
        </main>
      </ScrollArea>
    </div>
  )
}
