import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EventsPage from './EventsPage'

function mockJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderEventsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/p/demo/events']}>
        <Routes>
          <Route path="/p/:slug/events" element={<EventsPage />} />
          <Route path="/p/:slug/events/:tab" element={<EventsPage />} />
          <Route path="/p/:slug/events/:tab/:eventId" element={<EventsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EventsPage', () => {
  it('renders monitoring signal links for tabs and rows', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)

      if (url.endsWith('/api/v1/projects/demo/event-types')) {
        return mockJsonResponse([
          {
            id: 'type-1',
            project_id: 'project-1',
            name: 'page',
            display_name: 'Page',
            description: '',
            color: '#0ea5e9',
            order: 0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            field_definitions: [],
          },
        ])
      }
      if (url.endsWith('/api/v1/projects/demo/meta-fields')) return mockJsonResponse([])
      if (url.endsWith('/api/v1/projects/demo/variables')) return mockJsonResponse([])
      if (url.endsWith('/api/v1/projects/demo/events/tags')) return mockJsonResponse([])
      if (url.includes('/api/v1/projects/demo/events?reviewed=false')) {
        return mockJsonResponse({ items: [], total: 0 })
      }
      if (url.includes('/api/v1/projects/demo/events?archived=true')) {
        return mockJsonResponse({ items: [], total: 0 })
      }
      if (url.includes('/api/v1/projects/demo/events-metrics')) {
        return mockJsonResponse({
          scope: 'events_total',
          scan_config_id: null,
          event_id: null,
          event_type_id: null,
          interval: '1h',
          latest_signal: null,
          data: [],
        })
      }
      if (url.includes('/api/v1/projects/demo/anomalies/signals')) {
        return mockJsonResponse([
          {
            scan_config_id: 'scan-1',
            scope_type: 'project_total',
            scope_ref: 'scan-1',
            event_id: null,
            event_type_id: null,
            bucket: '2026-01-02T00:00:00Z',
            actual_count: 0,
            expected_count: 15,
            stddev: 0,
            z_score: -15,
            direction: 'drop',
          },
          {
            scan_config_id: 'scan-1',
            scope_type: 'event_type',
            scope_ref: 'type-1',
            event_id: null,
            event_type_id: 'type-1',
            bucket: '2026-01-02T00:00:00Z',
            actual_count: 0,
            expected_count: 15,
            stddev: 0,
            z_score: -15,
            direction: 'drop',
          },
          {
            scan_config_id: 'scan-1',
            scope_type: 'event',
            scope_ref: 'event-1',
            event_id: 'event-1',
            event_type_id: null,
            bucket: '2026-01-02T00:00:00Z',
            actual_count: 0,
            expected_count: 10,
            stddev: 0,
            z_score: -10,
            direction: 'drop',
          },
        ])
      }
      if (url.includes('/api/v1/projects/demo/events')) {
        return mockJsonResponse({
          items: [
            {
              id: 'event-1',
              project_id: 'project-1',
              event_type_id: 'type-1',
              event_type: {
                id: 'type-1',
                name: 'page',
                display_name: 'Page',
                color: '#0ea5e9',
              },
              name: 'Homepage View',
              description: '',
              implemented: true,
              reviewed: true,
              archived: false,
              tags: [],
              field_values: [],
              meta_values: [],
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
          total: 1,
        })
      }

      throw new Error(`Unhandled fetch: ${url}`)
    })

    const { container } = renderEventsPage()

    expect(await screen.findByText('Homepage View')).toBeInTheDocument()
    expect(container.querySelector('a[href="/p/demo/monitoring/project-total/scan-1"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/p/demo/monitoring/event-type/type-1"]')).toBeInTheDocument()
    expect(container.querySelector('a[href="/p/demo/monitoring/event/event-1"]')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Show chart'))
    expect(await screen.findByText('View signal')).toBeInTheDocument()
  })
})
