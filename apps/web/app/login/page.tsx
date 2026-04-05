'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DemoBanner from '@/components/demo-banner'
import { useAuth } from '@/lib/auth-context'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const DEMO_EMAIL = 'demo@betplatform.dev'
const DEMO_PASSWORD = 'demo1234'

export default function LoginPage() {
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState('')
  const { setAuth } = useAuth()
  const router = useRouter()

  async function tryDemoAccount() {
    setDemoLoading(true)
    setDemoError('')
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      })
      const data = await res.json() as { accessToken?: string; message?: string }
      if (!res.ok) {
        setDemoError(data.message ?? 'Demo login failed — make sure the API is running.')
        return
      }
      setAuth(data.accessToken!, DEMO_EMAIL)
      router.push('/dashboard')
    } catch {
      setDemoError('Network error — is the API running on port 3001?')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <DemoBanner />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          <Link href="/" className="text-muted text-sm hover:text-accent transition-colors mb-8 block">
            ← betplatform
          </Link>

          <h1 className="text-2xl font-bold text-ink mb-6">Sign in</h1>

          {/* Demo notice */}
          <div className="border border-accent/30 bg-accent/5 rounded-lg p-4 mb-6">
            <p className="text-accent text-sm font-semibold mb-1">🔒 Registration is disabled in demo mode.</p>
            <p className="text-muted text-xs leading-relaxed mb-3">
              This form shows the authentication UI — the backend JWT auth is fully functional.
              Use the demo account to explore the platform.
            </p>
            <div className="bg-frame rounded px-3 py-2 font-mono text-xs text-muted mb-4">
              <span className="text-ink">{DEMO_EMAIL}</span>
              {' / '}
              <span className="text-ink">{DEMO_PASSWORD}</span>
            </div>
            {demoError && (
              <p className="text-red-400 text-xs mb-3">{demoError}</p>
            )}
            <button
              onClick={tryDemoAccount}
              disabled={demoLoading}
              className="w-full bg-accent text-canvas font-semibold py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity text-sm"
            >
              {demoLoading ? 'Signing in…' : 'Try Demo Account →'}
            </button>
          </div>

          {/* Locked form */}
          <div className="opacity-40 pointer-events-none select-none">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-muted text-xs uppercase tracking-wider">Form preview</span>
              <span className="text-muted text-sm">🔒</span>
            </div>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  disabled
                  placeholder="you@example.com"
                  className="w-full bg-frame border border-frame rounded-lg px-3 py-2.5 text-muted placeholder-muted/30 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase tracking-wider">Password</label>
                <input
                  type="password"
                  disabled
                  placeholder="••••••••"
                  className="w-full bg-frame border border-frame rounded-lg px-3 py-2.5 text-muted placeholder-muted/30 cursor-not-allowed"
                />
              </div>
              <button
                type="button"
                disabled
                className="w-full bg-frame border border-frame text-muted font-semibold py-2.5 rounded-lg cursor-not-allowed"
              >
                Sign in
              </button>
            </form>
          </div>

          <p className="mt-6 text-muted text-sm text-center">
            No account?{' '}
            <Link href="/register" className="text-accent hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
