import { Link, Outlet, useParams } from 'react-router-dom'

export default function Layout() {
  const { slug } = useParams()

  return (
    <div className="app-shell">
      <nav className="navbar">
        <Link to="/" className="navbar-brand">tripl</Link>
        {slug && (
          <>
            <span className="navbar-divider">/</span>
            <Link to={`/p/${slug}`} className="navbar-slug">{slug}</Link>
            <Link to={`/p/${slug}/events`} className="navbar-link">Events</Link>
            <Link to={`/p/${slug}/settings`} className="navbar-link">Settings</Link>
          </>
        )}
      </nav>
      <main className="page-container">
        <Outlet />
      </main>
    </div>
  )
}
