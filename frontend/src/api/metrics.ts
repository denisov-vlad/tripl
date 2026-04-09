import { api } from './client'
import type { EventMetricsResponse } from '../types'

export interface EventsMetricsParams {
  event_type_id?: string
  search?: string
  implemented?: boolean
  reviewed?: boolean
  archived?: boolean
  tag?: string
  from?: string
  to?: string
}

export const metricsApi = {
  getEventsMetrics: (slug: string, params?: EventsMetricsParams) => {
    const sp = new URLSearchParams()
    if (params?.event_type_id) sp.set('event_type_id', params.event_type_id)
    if (params?.search) sp.set('search', params.search)
    if (params?.implemented !== undefined) sp.set('implemented', String(params.implemented))
    if (params?.reviewed !== undefined) sp.set('reviewed', String(params.reviewed))
    if (params?.archived !== undefined) sp.set('archived', String(params.archived))
    if (params?.tag) sp.set('tag', params.tag)
    if (params?.from) sp.set('from', params.from)
    if (params?.to) sp.set('to', params.to)
    const qs = sp.toString()
    return api.get<EventMetricsResponse>(`/projects/${slug}/events-metrics${qs ? `?${qs}` : ''}`)
  },

  getEventMetrics: (slug: string, eventId: string, params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams()
    if (params?.from) sp.set('from', params.from)
    if (params?.to) sp.set('to', params.to)
    const qs = sp.toString()
    return api.get<EventMetricsResponse>(`/projects/${slug}/events/${eventId}/metrics${qs ? `?${qs}` : ''}`)
  },

  getEventTypeMetrics: (slug: string, eventTypeId: string, params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams()
    if (params?.from) sp.set('from', params.from)
    if (params?.to) sp.set('to', params.to)
    const qs = sp.toString()
    return api.get<EventMetricsResponse>(`/projects/${slug}/event-types/${eventTypeId}/metrics${qs ? `?${qs}` : ''}`)
  },
}
