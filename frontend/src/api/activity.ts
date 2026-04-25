import { api } from './client'
import type { ActivityItem } from '../types'

export const activityApi = {
  list: (params?: { slug?: string; limit?: number }) => {
    const sp = new URLSearchParams()
    if (params?.limit) sp.set('limit', String(params.limit))
    const qs = sp.toString()
    const path = params?.slug
      ? `/activity/projects/${params.slug}`
      : '/activity'
    return api.get<ActivityItem[]>(`${path}${qs ? `?${qs}` : ''}`)
  },
}

