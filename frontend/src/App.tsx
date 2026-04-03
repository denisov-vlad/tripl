import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProjectsPage from './pages/ProjectsPage'
import EventsPage from './pages/EventsPage'
import ProjectSettingsPage from './pages/ProjectSettingsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/p/:slug/events" element={<EventsPage />} />
        <Route path="/p/:slug/settings" element={<ProjectSettingsPage />} />
        <Route path="/p/:slug" element={<EventsPage />} />
      </Route>
    </Routes>
  )
}
