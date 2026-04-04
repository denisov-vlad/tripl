import { api } from './client'
import type { Variable, VariableType } from '../types'

export const variablesApi = {
  list: (slug: string) => api.get<Variable[]>(`/projects/${slug}/variables`),
  create: (slug: string, data: { name: string; variable_type?: VariableType; description?: string }) =>
    api.post<Variable>(`/projects/${slug}/variables`, data),
  update: (slug: string, id: string, data: { variable_type?: VariableType; description?: string }) =>
    api.patch<Variable>(`/projects/${slug}/variables/${id}`, data),
  del: (slug: string, id: string) => api.del(`/projects/${slug}/variables/${id}`),
}
