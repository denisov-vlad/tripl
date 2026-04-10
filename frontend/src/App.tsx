import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProjectsPage from './pages/ProjectsPage'
import EventsPage from './pages/EventsPage'
import MonitoringDetailPage from './pages/MonitoringDetailPage'
import ProjectSettingsPage from './pages/ProjectSettingsPage'
import DataSourcesPage from './pages/DataSourcesPage'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from './components/ui/sonner'

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="tripl-ui-theme">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/data-sources/:dsId" element={<DataSourcesPage />} />
          <Route path="/p/:slug/events/detail/:eventId" element={<MonitoringDetailPage />} />
          <Route path="/p/:slug/monitoring/:scope/:id" element={<MonitoringDetailPage />} />
          <Route path="/p/:slug/events/:tab/:eventId" element={<EventsPage />} />
          <Route path="/p/:slug/events/:tab" element={<EventsPage />} />
          <Route path="/p/:slug/events" element={<EventsPage />} />
          <Route path="/p/:slug/settings/:tab" element={<ProjectSettingsPage />} />
          <Route path="/p/:slug/settings" element={<ProjectSettingsPage />} />
          <Route path="/p/:slug" element={<EventsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </ThemeProvider>
  )
}
