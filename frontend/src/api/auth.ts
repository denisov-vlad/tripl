import { api } from './client'
import type { AuthUser } from '@/types'

export const authApi = {
  me: () => api.get<AuthUser>('/auth/me'),
  login: (data: { email: string; password: string }) =>
    api.post<AuthUser>('/auth/login', data),
  register: (data: { email: string; password: string; name?: string }) =>
    api.post<AuthUser>('/auth/register', data),
  logout: () => api.post<void>('/auth/logout'),
}
