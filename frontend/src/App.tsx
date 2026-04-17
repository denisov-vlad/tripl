import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from './components/ui/sonner'

const ProjectsPage = lazy(() => import('./pages/ProjectsPage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const MonitoringDetailPage = lazy(() => import('./pages/MonitoringDetailPage'))
const ProjectSettingsPage = lazy(() => import('./pages/ProjectSettingsPage'))
const DataSourcesPage = lazy(() => import('./pages/DataSourcesPage'))

function RouteFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      Loading page…
    </div>
  )
}

function withSuspense(element: React.ReactNode) {
  return (
    <Suspense fallback={<RouteFallback />}>
      {element}
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="tripl-ui-theme">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={withSuspense(<ProjectsPage />)} />
          <Route path="/data-sources" element={withSuspense(<DataSourcesPage />)} />
          <Route path="/data-sources/:dsId" element={withSuspense(<DataSourcesPage />)} />
          <Route path="/p/:slug/events/detail/:eventId" element={withSuspense(<MonitoringDetailPage />)} />
          <Route path="/p/:slug/monitoring/:scope/:id" element={withSuspense(<MonitoringDetailPage />)} />
          <Route path="/p/:slug/events/:tab/:eventId" element={withSuspense(<EventsPage />)} />
          <Route path="/p/:slug/events/:tab" element={withSuspense(<EventsPage />)} />
          <Route path="/p/:slug/events" element={withSuspense(<EventsPage />)} />
          <Route path="/p/:slug/settings/:tab" element={withSuspense(<ProjectSettingsPage />)} />
          <Route path="/p/:slug/settings" element={withSuspense(<ProjectSettingsPage />)} />
          <Route path="/p/:slug" element={withSuspense(<EventsPage />)} />
        </Route>
      </Routes>
      <Toaster />
    </ThemeProvider>
  )
}
