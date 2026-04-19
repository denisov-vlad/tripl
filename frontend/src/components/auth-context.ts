import { createContext, useContext } from 'react'
import type { AuthUser } from '@/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface AuthContextValue {
  user: AuthUser | null
  status: AuthStatus
  error: Error | null
  isLoggingOut: boolean
  logout: () => Promise<void>
  refresh: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return value
}
