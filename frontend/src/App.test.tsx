import { describe, it, expect } from 'vitest'
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
  it('renders the tripl header', () => {
    renderApp()
    expect(screen.getByText('tripl')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    renderApp()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})
