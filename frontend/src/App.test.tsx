import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

function renderApp() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('App', () => {
  beforeEach(() => {
    // Ensure localStorage is available for ThemeProvider
    if (!window.localStorage) {
      Object.defineProperty(window, 'localStorage', {
        value: {
          store: {} as Record<string, string>,
          getItem(key: string) { return this.store[key] ?? null },
          setItem(key: string, value: string) { this.store[key] = value },
          removeItem(key: string) { delete this.store[key] },
          clear() { this.store = {} },
        },
        writable: true,
      })
    }
  })

  it('renders the tripl brand', () => {
    renderApp()
    expect(screen.getByText('tripl')).toBeInTheDocument()
  })

  it('renders the sidebar navigation', () => {
    renderApp()
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0)
  })
})
