'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface AuthState {
  token: string | null
  email: string | null
  loginAt: number | null // unix ms — used for session timer
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, email: string) => void
  clearAuth: () => void
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  email: null,
  loginAt: null,
  setAuth: () => {},
  clearAuth: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState>({
    token: null,
    email: null,
    loginAt: null,
  })

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        setAuth: (token, email) =>
          setAuthState({ token, email, loginAt: Date.now() }),
        clearAuth: () =>
          setAuthState({ token: null, email: null, loginAt: null }),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
