import { api } from './client'
import type { EventType } from '../types'

export const eventTypesApi = {
  list: (slug: string) => api.get<EventType[]>(`/projects/${slug}/event-types`),
  get: (slug: string, id: string) =>
    api.get<EventType>(`/projects/${slug}/event-types/${id}`),
  create: (slug: string, data: { name: string; display_name: string; description?: string; color?: string }) =>
    api.post<EventType>(`/projects/${slug}/event-types`, data),
  update: (slug: string, id: string, data: Partial<{ display_name: string; description: string; color: string; order: number }>) =>
    api.patch<EventType>(`/projects/${slug}/event-types/${id}`, data),
  del: (slug: string, id: string) => api.del(`/projects/${slug}/event-types/${id}`),
}
