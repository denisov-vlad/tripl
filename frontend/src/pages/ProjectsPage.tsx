import { type ElementType, type ReactNode, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { dataSourcesApi } from '@/api/dataSources'
import { projectsApi } from '@/api/projects'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/hooks/useConfirm'
import type {
  Project,
  ProjectLatestScanJob,
  ProjectLatestSignal,
  ProjectSummary,
} from '@/types'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BellRing,
  Database,
  FolderKanban,
  Plus,
  PlayCircle,
  Settings2,
  Trash2,
} from 'lucide-react'

export default function MainPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState('')
  const { confirm, dialog } = useConfirm()

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })
  const dataSourcesQuery = useQuery({
    queryKey: ['dataSources'],
    queryFn: dataSourcesApi.list,
  })

  const projects = [...(projectsQuery.data ?? [])].sort(
    (left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at),
  )
  const dataSourceCount = dataSourcesQuery.data?.length ?? 0

  const portfolio = projects.reduce(
    (totals, project) => {
      totals.activeEventCount += project.summary.active_event_count
      totals.alertDestinationCount += project.summary.alert_destination_count
      totals.eventCount += project.summary.event_count
      totals.implementedEventCount += project.summary.implemented_event_count
      totals.monitoringSignalCount += project.summary.monitoring_signal_count
      totals.projectCount += 1
      totals.reviewPendingEventCount += project.summary.review_pending_event_count
      totals.scanCount += project.summary.scan_count
      totals.variableCount += project.summary.variable_count
      return totals
    },
    {
      activeEventCount: 0,
      alertDestinationCount: 0,
      eventCount: 0,
      implementedEventCount: 0,
      monitoringSignalCount: 0,
      projectCount: 0,
      reviewPendingEventCount: 0,
      scanCount: 0,
      variableCount: 0,
    },
  )

  const coveragePercent = portfolio.activeEventCount
    ? Math.round((portfolio.implementedEventCount / portfolio.activeEventCount) * 100)
    : 0
  const projectsWithScans = projects.filter(project => project.summary.scan_count > 0).length
  const projectsWithSignals = projects.filter(
    project => project.summary.monitoring_signal_count > 0,
  ).length
  const projectsNeedingReview = projects.filter(
    project => project.summary.review_pending_event_count > 0,
  ).length
  const projectsReady = projects.filter(project => getProjectStatus(project.summary).label === 'Ready').length
  const projectsWithLatestScanJob = projects.filter(
    project => project.summary.latest_scan_job != null,
  ).length
  const projectsWithRunningScan = projects.filter(
    project => project.summary.latest_scan_job?.status === 'running',
  ).length
  const projectsWithFailedScan = projects.filter(
    project => project.summary.latest_scan_job?.status === 'failed',
  ).length

  const createMut = useMutation({
    mutationFn: () => projectsApi.create({ name, slug, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
      setName('')
      setSlug('')
      setSlugTouched(false)
      setDescription('')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (projectSlug: string) => projectsApi.del(projectSlug),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const handleDelete = async (project: Project) => {
    const ok = await confirm({
      title: 'Delete project',
      message: `Are you sure you want to delete "${project.name}"? All event types and events will be permanently removed.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (ok) deleteMut.mutate(project.slug)
  }

  const dataSourceValue = dataSourcesQuery.isError
    ? 'Unavailable'
    : dataSourcesQuery.isLoading
      ? '...'
      : String(dataSourceCount)

  return (
    <div className="space-y-6">
      {dialog}

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <CardContent className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="info" className="gap-1">
                <FolderKanban className="h-3 w-3" />
                {portfolio.projectCount} projects
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Activity className="h-3 w-3" />
                {portfolio.eventCount} planned events
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Database className="h-3 w-3" />
                {dataSourceValue} data sources
              </Badge>
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Analytics workspace</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                See which tracking plans are filling out, which projects still need review,
                and how much scan and alerting coverage exists across the workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
              <Button asChild variant="outline">
                <Link to="/data-sources">
                  Review Data Sources
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <WorkspaceSignal
              icon={BadgeCheck}
              title="Catalog coverage"
              value={`${coveragePercent}%`}
              description={
                portfolio.activeEventCount > 0
                  ? `${portfolio.implementedEventCount} of ${portfolio.activeEventCount} active events implemented`
                  : 'No active events yet'
              }
            />
            <WorkspaceSignal
              icon={BellRing}
              title="Review queue"
              value={String(portfolio.reviewPendingEventCount)}
              description={
                portfolio.reviewPendingEventCount > 0
                  ? `${projectsNeedingReview} projects still need review attention`
                  : 'Review queue is clear'
              }
            />
            <WorkspaceSignal
              icon={Activity}
              title="Automation"
              value={String(portfolio.scanCount)}
              description={
                portfolio.scanCount > 0
                  ? `${projectsWithScans} projects already have scan coverage`
                  : 'No scans configured yet'
              }
            />
            <WorkspaceSignal
              icon={AlertTriangle}
              title="Monitoring signals"
              value={String(portfolio.monitoringSignalCount)}
              description={
                portfolio.monitoringSignalCount > 0
                  ? `${projectsWithSignals} projects currently have active or recent signals`
                  : 'No recent monitoring signals across projects'
              }
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={event => { event.preventDefault(); createMut.mutate() }}>
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={event => {
                    setName(event.target.value)
                    if (!slugTouched) {
                      setSlug(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/(^-|-$)/g, ''),
                      )
                    }
                  }}
                  placeholder="My Project"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-slug">Slug (url-friendly)</Label>
                <Input
                  id="project-slug"
                  value={slug}
                  onChange={event => {
                    setSlugTouched(true)
                    setSlug(event.target.value)
                  }}
                  className="font-mono"
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="project-desc">Description (optional)</Label>
                <Textarea
                  id="project-desc"
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  rows={2}
                />
              </div>
              {createMut.isError && (
                <p className="text-sm text-destructive">{(createMut.error as Error).message}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {projectsQuery.isLoading && <ProjectsPageSkeleton />}

      {projectsQuery.isError && (
        <ErrorState
          title="Failed to load projects"
          description="The page could not fetch projects from the backend."
          error={projectsQuery.error}
          onRetry={() => { void projectsQuery.refetch() }}
        />
      )}

      {!projectsQuery.isLoading && !projectsQuery.isError && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PortfolioStatCard
              icon={FolderKanban}
              title="Projects"
              value={String(portfolio.projectCount)}
              description={
                portfolio.projectCount > 0
                  ? `${projectsReady} projects are fully implemented`
                  : 'Create a project to start your catalog'
              }
            />
            <PortfolioStatCard
              icon={BadgeCheck}
              title="Coverage"
              value={`${coveragePercent}%`}
              description={
                portfolio.activeEventCount > 0
                  ? `${portfolio.implementedEventCount} implemented of ${portfolio.activeEventCount} active events`
                  : 'Coverage starts after your first active event'
              }
            />
            <PortfolioStatCard
              icon={BellRing}
              title="Review Queue"
              value={String(portfolio.reviewPendingEventCount)}
              description={
                portfolio.reviewPendingEventCount > 0
                  ? `${projectsNeedingReview} projects need review`
                  : 'No pending event reviews'
              }
            />
            <PortfolioStatCard
              icon={PlayCircle}
              title="Latest Jobs"
              value={String(projectsWithLatestScanJob)}
              description={
                projectsWithFailedScan > 0
                  ? `${projectsWithFailedScan} projects have a failed latest scan job`
                    : projectsWithRunningScan > 0
                      ? `${projectsWithRunningScan} projects are currently running scans`
                    : projectsWithLatestScanJob > 0
                      ? 'Latest scan jobs are healthy'
                      : 'No project has run a scan yet'
              }
            />
          </div>

          {projects.length > 0 ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Project portfolio</h2>
                  <p className="text-sm text-muted-foreground">
                    Recently updated projects with planning, review, scan, and alerting coverage.
                  </p>
                </div>
                <Badge variant="secondary">{projects.length} tracked</Badge>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {projects.map(project => {
                  const status = getProjectStatus(project.summary)
                  const coverage = project.summary.active_event_count
                    ? Math.round(
                        (project.summary.implemented_event_count / project.summary.active_event_count) * 100,
                      )
                    : 0

                  return (
                    <Card key={project.id} className="overflow-hidden border-border/70">
                      <CardHeader className="gap-4 border-b border-border/60 bg-muted/20">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <CardTitle className="truncate text-base">{project.name}</CardTitle>
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </div>
                            <CardDescription className="line-clamp-2">
                              {project.description || 'No project description yet. Add one to capture the scope of this tracking plan.'}
                            </CardDescription>
                            <p className="text-xs text-muted-foreground">
                              <span className="font-mono">{project.slug}</span>
                              {' · '}
                              Updated {formatDate(project.updated_at)}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => { void handleDelete(project) }}
                            aria-label={`Delete ${project.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Badge variant={coverage === 100 && project.summary.active_event_count > 0 ? 'success' : 'info'}>
                            {project.summary.active_event_count > 0
                              ? `${coverage}% implemented`
                              : 'No active events'}
                          </Badge>
                          <Badge
                            variant={project.summary.review_pending_event_count > 0 ? 'warning' : 'secondary'}
                          >
                            {project.summary.review_pending_event_count > 0
                              ? `${project.summary.review_pending_event_count} pending review`
                              : 'Review queue clear'}
                          </Badge>
                          <Badge variant={project.summary.scan_count > 0 ? 'outline' : 'secondary'}>
                            {project.summary.scan_count > 0
                              ? `${project.summary.scan_count} scans configured`
                              : 'No scan coverage'}
                          </Badge>
                          <Badge
                            variant={project.summary.monitoring_signal_count > 0 ? 'destructive' : 'secondary'}
                          >
                            {project.summary.monitoring_signal_count > 0
                              ? `${project.summary.monitoring_signal_count} recent signals`
                              : 'No recent signals'}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-5 px-6 py-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Implementation progress</span>
                            <span>
                              {project.summary.implemented_event_count}/{project.summary.active_event_count || 0}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-[width]"
                              style={{ width: `${coverage}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <ProjectMetric
                            label="Event types"
                            value={String(project.summary.event_type_count)}
                          />
                          <ProjectMetric
                            label="Active events"
                            value={String(project.summary.active_event_count)}
                          />
                          <ProjectMetric
                            label="Variables"
                            value={String(project.summary.variable_count)}
                          />
                          <ProjectMetric
                            label="Alerts"
                            value={String(project.summary.alert_destination_count)}
                          />
                        </div>

                        <div className="grid gap-3 xl:grid-cols-2">
                          <OperationsPanel
                            icon={PlayCircle}
                            title="Latest scan"
                            content={
                              <LatestScanJobSummary job={project.summary.latest_scan_job} />
                            }
                          />
                          <OperationsPanel
                            icon={AlertTriangle}
                            title="Monitoring"
                            content={
                              <LatestSignalSummary
                                slug={project.slug}
                                signal={project.summary.latest_signal}
                                signalCount={project.summary.monitoring_signal_count}
                              />
                            }
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link to={`/p/${project.slug}/events`}>
                              Open Project
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/p/${project.slug}/settings`}>
                              <Settings2 className="mr-2 h-4 w-4" />
                              Settings
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          ) : (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to start building a richer tracking-plan workspace with event coverage, scans, and monitoring."
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              }
            />
          )}
        </>
      )}
    </div>
  )
}

function ProjectsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map(index => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map(index => (
          <Skeleton key={index} className="h-96 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function PortfolioStatCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: ElementType
  title: string
  value: string
  description: string
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function WorkspaceSignal({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: ElementType
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-4 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function ProjectMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function OperationsPanel({
  icon: Icon,
  title,
  content,
}: {
  icon: ElementType
  title: string
  content: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
      </div>
      {content}
    </div>
  )
}

function LatestScanJobSummary({ job }: { job: ProjectLatestScanJob | null }) {
  if (!job) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>No scan jobs have run yet.</p>
        <p>Configure a scan and run it once to start surfacing execution history here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-foreground">{job.scan_name}</p>
        <Badge variant={getScanJobStatusVariant(job.status)}>{job.status}</Badge>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>{describeScanJobTiming(job)}</p>
        {job.error_message && (
          <p className="line-clamp-2 text-destructive">{job.error_message}</p>
        )}
      </div>
      {job.result_summary && (
        <div className="flex flex-wrap gap-2">
          {job.result_summary.events_created != null && (
            <Badge variant="outline" className="text-[10px] text-emerald-600">
              +{job.result_summary.events_created} events
            </Badge>
          )}
          {job.result_summary.signals_added != null && job.result_summary.signals_added > 0 && (
            <Badge variant="outline" className="text-[10px] text-destructive">
              +{job.result_summary.signals_added} signals
            </Badge>
          )}
          {job.result_summary.alerts_queued != null && job.result_summary.alerts_queued > 0 && (
            <Badge variant="outline" className="text-[10px] text-amber-600">
              +{job.result_summary.alerts_queued} alerts
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

function LatestSignalSummary({
  slug,
  signal,
  signalCount,
}: {
  slug: string
  signal: ProjectLatestSignal | null
  signalCount: number
}) {
  if (!signal) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>No active or recent monitoring signals.</p>
        <p>Once metrics collection finds anomalies, the latest signal will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={signal.state === 'recent' ? 'warning' : 'destructive'}>
          {signal.state === 'recent' ? 'Recent signal' : 'Latest scan signal'}
        </Badge>
        <Badge variant={signal.direction === 'drop' ? 'warning' : 'destructive'}>
          {signal.direction}
        </Badge>
        <Badge variant="secondary">{signalCount} active</Badge>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{signal.scope_name}</p>
        <p className="text-sm text-muted-foreground">
          {signal.actual_count.toLocaleString()} actual vs {Math.round(signal.expected_count).toLocaleString()} expected
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(signal.bucket)} via {signal.scan_name}
        </p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to={getMonitoringPath(slug, signal)}>
          Open Signal
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}

function getProjectStatus(summary: ProjectSummary): {
  label: string
  variant: 'info' | 'warning' | 'success' | 'secondary'
} {
  if (summary.active_event_count === 0) {
    return { label: 'Setup', variant: 'secondary' }
  }
  if (summary.review_pending_event_count > 0) {
    return { label: 'Needs Review', variant: 'warning' }
  }
  if (summary.implemented_event_count === summary.active_event_count) {
    return { label: 'Ready', variant: 'success' }
  }
  return { label: 'In Progress', variant: 'info' }
}

function getScanJobStatusVariant(
  status: ProjectLatestScanJob['status'],
): 'outline' | 'secondary' | 'success' | 'destructive' {
  if (status === 'completed') {
    return 'success'
  }
  if (status === 'failed') {
    return 'destructive'
  }
  if (status === 'running') {
    return 'secondary'
  }
  return 'outline'
}

function getMonitoringPath(slug: string, signal: ProjectLatestSignal) {
  if (signal.scope_type === 'project_total') {
    return `/p/${slug}/monitoring/project-total/${signal.scope_ref}`
  }
  if (signal.scope_type === 'event_type') {
    return `/p/${slug}/monitoring/event-type/${signal.scope_ref}`
  }
  return `/p/${slug}/monitoring/event/${signal.scope_ref}`
}

function describeScanJobTiming(job: ProjectLatestScanJob) {
  if (job.started_at && job.completed_at) {
    return `Completed ${formatDateTime(job.completed_at)}`
  }
  if (job.started_at) {
    return `Started ${formatDateTime(job.started_at)}`
  }
  return `Queued ${formatDateTime(job.created_at)}`
}

function formatDate(value: string) {
  const date = new Date(value)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
