import { api } from './client'
import type { Event, EventListResponse } from '../types'

export const eventsApi = {
  list: (slug: string, params?: { event_type_id?: string; search?: string; offset?: number; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.event_type_id) sp.set('event_type_id', params.event_type_id)
    if (params?.search) sp.set('search', params.search)
    if (params?.offset !== undefined) sp.set('offset', String(params.offset))
    if (params?.limit !== undefined) sp.set('limit', String(params.limit))
    const qs = sp.toString()
    return api.get<EventListResponse>(`/projects/${slug}/events${qs ? `?${qs}` : ''}`)
  },
  get: (slug: string, id: string) => api.get<Event>(`/projects/${slug}/events/${id}`),
  create: (slug: string, data: {
    event_type_id: string; name: string; description?: string;
    field_values?: { field_definition_id: string; value: string }[];
    meta_values?: { meta_field_definition_id: string; value: string }[];
  }) => api.post<Event>(`/projects/${slug}/events`, data),
  update: (slug: string, id: string, data: {
    name?: string; description?: string;
    field_values?: { field_definition_id: string; value: string }[];
    meta_values?: { meta_field_definition_id: string; value: string }[];
  }) => api.patch<Event>(`/projects/${slug}/events/${id}`, data),
  del: (slug: string, id: string) => api.del(`/projects/${slug}/events/${id}`),
  bulkCreate: (slug: string, data: {
    event_type_id: string; name: string;
    field_values?: { field_definition_id: string; value: string }[];
    meta_values?: { meta_field_definition_id: string; value: string }[];
  }[]) => api.post<Event[]>(`/projects/${slug}/events/bulk`, data),
}
