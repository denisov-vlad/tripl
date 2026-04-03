import { api } from './client'
import type { EventTypeRelation } from '../types'

export const relationsApi = {
  list: (slug: string) => api.get<EventTypeRelation[]>(`/projects/${slug}/relations`),
  create: (slug: string, data: {
    source_event_type_id: string; target_event_type_id: string;
    source_field_id: string; target_field_id: string;
    relation_type?: string; description?: string
  }) => api.post<EventTypeRelation>(`/projects/${slug}/relations`, data),
  del: (slug: string, id: string) => api.del(`/projects/${slug}/relations/${id}`),
}
