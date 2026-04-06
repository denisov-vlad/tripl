import { Link, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Database,
  Calendar,
  Settings,
  ChevronRight,
  FolderKanban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { projectsApi } from '@/api/projects'
import { ThemeToggle } from '@/components/theme-toggle'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { Project } from '@/types'
import { useState } from 'react'

export function AppSidebar() {
  const { slug } = useParams()
  const location = useLocation()

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const isActive = (path: string) => location.pathname === path

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-sidebar-primary-foreground no-underline">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            T
          </div>
          tripl
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      <ScrollArea className="flex-1 px-3 py-3">
        <nav className="flex flex-col gap-1">
          {/* Home / Projects */}
          <SidebarLink to="/" active={isActive('/')} icon={LayoutDashboard}>
            Projects
          </SidebarLink>

          {/* Data Sources */}
          <SidebarLink
            to="/data-sources"
            active={isActive('/data-sources')}
            icon={Database}
          >
            Data Sources
          </SidebarLink>

          {projects.length > 0 && (
            <>
              <Separator className="my-2 bg-sidebar-border" />
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 mb-1">
                Projects
              </span>
            </>
          )}

          {projects.map((p: Project) => (
            <ProjectItem
              key={p.id}
              project={p}
              isActive={slug === p.slug}
              currentPath={location.pathname}
            />
          ))}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[10px] text-sidebar-foreground/40">v0.1</span>
        <ThemeToggle />
      </div>
    </aside>
  )
}

function ProjectItem({
  project,
  isActive,
  currentPath,
}: {
  project: Project
  isActive: boolean
  currentPath: string
}) {
  const [open, setOpen] = useState(isActive)

  return (
    <Collapsible open={open || isActive} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
          )}
        >
          <FolderKanban className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">{project.name}</span>
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 transition-transform',
              (open || isActive) && 'rotate-90'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
          <SidebarSubLink
            to={`/p/${project.slug}/events`}
            active={currentPath.startsWith(`/p/${project.slug}/events`) || currentPath === `/p/${project.slug}`}
            icon={Calendar}
          >
            Events
          </SidebarSubLink>
          <SidebarSubLink
            to={`/p/${project.slug}/settings`}
            active={currentPath.startsWith(`/p/${project.slug}/settings`)}
            icon={Settings}
          >
            Settings
          </SidebarSubLink>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function SidebarLink({
  to,
  active,
  icon: Icon,
  children,
}: {
  to: string
  active: boolean
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors no-underline',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </Link>
  )
}

function SidebarSubLink({
  to,
  active,
  icon: Icon,
  children,
}: {
  to: string
  active: boolean
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors no-underline',
        active
          ? 'text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/80'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </Link>
  )
}
