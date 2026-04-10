import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProjectSettingsPage from './ProjectSettingsPage'

function mockJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProjectSettingsPage', () => {
  it('loads and updates shared monitoring settings on the monitoring tab', async () => {
    let settings = {
      id: 'settings-1',
      project_id: 'project-1',
      anomaly_detection_enabled: true,
      detect_project_total: true,
      detect_event_types: true,
      detect_events: false,
      baseline_window_buckets: 21,
      min_history_buckets: 9,
      sigma_threshold: 4.5,
      min_expected_count: 25,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const patchBodies: unknown[] = []

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)

      if (url.endsWith('/api/v1/projects/demo/anomaly-settings') && (!init || !init.method || init.method === 'GET')) {
        return mockJsonResponse(settings)
      }

      if (url.endsWith('/api/v1/projects/demo/anomaly-settings') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body))
        patchBodies.push(body)
        settings = { ...settings, ...body }
        return mockJsonResponse(settings)
      }

      throw new Error(`Unhandled fetch: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/p/demo/settings/monitoring']}>
          <Routes>
            <Route path="/p/:slug/settings/:tab" element={<ProjectSettingsPage />} />
            <Route path="/p/:slug/settings" element={<ProjectSettingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Monitoring')).toBeInTheDocument()
    expect(await screen.findByText('Anomaly Detection')).toBeInTheDocument()
    expect(screen.getByText('Enabled')).toBeInTheDocument()
    expect(screen.getByDisplayValue('21')).toBeInTheDocument()
    expect(screen.getByDisplayValue('9')).toBeInTheDocument()
    expect(screen.getByDisplayValue('4.5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('25')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Toggle anomaly detection'))
    fireEvent.change(screen.getByDisplayValue('4.5'), { target: { value: '5.5' } })

    await waitFor(() => {
      expect(patchBodies).toContainEqual({ anomaly_detection_enabled: false })
      expect(patchBodies).toContainEqual({ sigma_threshold: 5.5 })
    })
  })

  it('shows added signals in scan job results', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input)

      if (url.endsWith('/api/v1/data-sources')) {
        return mockJsonResponse([
          {
            id: 'ds-1',
            name: 'Main DS',
            db_type: 'clickhouse',
            host: 'localhost',
            port: 8123,
            database_name: 'default',
            username: 'default',
            password_set: false,
            extra_params: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ])
      }

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

      if (url.endsWith('/api/v1/projects/demo/scans')) {
        return mockJsonResponse([
          {
            id: 'scan-1',
            data_source_id: 'ds-1',
            project_id: 'project-1',
            event_type_id: 'type-1',
            name: 'Main scan',
            base_query: 'SELECT * FROM analytics.events',
            event_type_column: null,
            time_column: 'created_at',
            event_name_format: null,
            cardinality_threshold: 100,
            interval: '1h',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ])
      }

      if (url.endsWith('/api/v1/projects/demo/scans/scan-1/jobs')) {
        return mockJsonResponse([
          {
            id: 'job-1',
            scan_config_id: 'scan-1',
            status: 'completed',
            started_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T00:01:00Z',
            result_summary: {
              events_created: 1,
              variables_created: 0,
              events_skipped: 0,
              columns_analyzed: 2,
              signals_added: 2,
              details: [],
            },
            error_message: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:01:00Z',
          },
        ])
      }

      throw new Error(`Unhandled fetch: ${url}`)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/p/demo/settings/scans']}>
          <Routes>
            <Route path="/p/:slug/settings/:tab" element={<ProjectSettingsPage />} />
            <Route path="/p/:slug/settings" element={<ProjectSettingsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByText('Main scan'))

    expect(await screen.findByText('+2 signals')).toBeInTheDocument()
  })
})
