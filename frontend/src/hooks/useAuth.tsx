import React, { createContext, useContext, useEffect, useState } from 'react'
import type { TokenResponse, User } from '../types'
import { authApi } from '../services/api'

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  loginWithToken: (resp: TokenResponse) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      authApi.me()
        .then((u) => setUser(u as User))
        .catch(() => { localStorage.removeItem('access_token'); setToken(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (username: string, password: string) => {
    const resp = await authApi.login(username, password)
    localStorage.setItem('access_token', resp.access_token)
    setToken(resp.access_token)
    setUser(resp.user)
  }

  const loginWithToken = (resp: TokenResponse) => {
    localStorage.setItem('access_token', resp.access_token)
    setToken(resp.access_token)
    setUser(resp.user)
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, loginWithToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
