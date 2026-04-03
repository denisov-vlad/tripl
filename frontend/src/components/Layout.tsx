import { Link, Outlet, useParams } from 'react-router-dom'

export default function Layout() {
  const { slug } = useParams()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <Link to="/" className="text-xl font-bold text-indigo-600">tripl</Link>
        {slug && (
          <>
            <span className="text-gray-300">/</span>
            <Link to={`/p/${slug}`} className="text-gray-700 hover:text-indigo-600 font-medium">{slug}</Link>
            <Link to={`/p/${slug}/events`} className="text-sm text-gray-500 hover:text-indigo-600">Events</Link>
            <Link to={`/p/${slug}/settings`} className="text-sm text-gray-500 hover:text-indigo-600">Settings</Link>
          </>
        )}
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
