'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DemoBanner from '@/components/demo-banner'
import LiveOdds from '@/components/live-odds'
import LiveOddsErrorBoundary from '@/components/live-odds-error-boundary'
import { useAuth } from '@/lib/auth-context'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface RgStatus {
  selfExcluded: boolean
  excludedUntil: string | null
  sessionDurationSeconds: number | null
  depositLimit: {
    amount: number
    period: string
    pendingAmount: number | null
    pendingFrom: string | null
  } | null
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export default function DashboardPage() {
  const { token, email, loginAt, clearAuth } = useAuth()
  const router = useRouter()

  const [elapsed, setElapsed] = useState(0)
  const [rgStatus, setRgStatus] = useState<RgStatus | null>(null)
  const [rgLoading, setRgLoading] = useState(false)
  const [rgError, setRgError] = useState('')
  const [rgSuccess, setRgSuccess] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositPeriod, setDepositPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) router.push('/login')
  }, [token, router])

  // Session timer
  useEffect(() => {
    if (!loginAt) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - loginAt) / 1_000))
    }, 1_000)
    return () => clearInterval(interval)
  }, [loginAt])

  // Load RG status
  const loadStatus = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API}/responsible-gambling/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRgStatus(await res.json() as RgStatus)
      }
    } catch { /* silent */ }
  }, [token])

  useEffect(() => { void loadStatus() }, [loadStatus])

  async function handleLogout() {
    clearAuth()
    router.push('/login')
  }

  async function handleSelfExclude() {
    if (!token) return
    setRgLoading(true)
    setRgError('')
    setRgSuccess('')
    try {
      const res = await fetch(`${API}/responsible-gambling/self-exclude`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration: '2m' }),
      })
      if (!res.ok) {
        const d = await res.json() as { message?: string }
        setRgError(d.message ?? 'Request failed')
      } else {
        setRgSuccess('Self-exclusion applied for 24 hours. You have been logged out.')
        clearAuth()
        setTimeout(() => router.push('/login'), 2_000)
      }
    } catch {
      setRgError('Network error')
    } finally {
      setRgLoading(false)
    }
  }

  async function handleDepositLimit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !depositAmount) return
    setRgLoading(true)
    setRgError('')
    setRgSuccess('')
    try {
      const res = await fetch(`${API}/responsible-gambling/deposit-limit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(depositAmount), period: depositPeriod }),
      })
      const d = await res.json() as { applied?: boolean; pendingFrom?: string; message?: string }
      if (!res.ok) {
        setRgError(d.message ?? 'Request failed')
      } else if (d.applied) {
        setRgSuccess(`Deposit limit of €${depositAmount}/${depositPeriod} applied immediately.`)
        void loadStatus()
      } else {
        setRgSuccess(`Limit increase staged — will apply after cooling-off period ending ${new Date(d.pendingFrom!).toLocaleDateString()}.`)
        void loadStatus()
      }
    } catch {
      setRgError('Network error')
    } finally {
      setRgLoading(false)
    }
  }

  if (!token) return null

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <DemoBanner />

      <div className="max-w-5xl mx-auto w-full px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-muted text-xs hover:text-accent transition-colors">betplatform</Link>
            <h1 className="text-xl font-bold text-ink mt-1">Dashboard</h1>
          </div>
          <Link href="/audit" className="text-sm text-muted hover:text-accent transition-colors">
            Audit log →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Live Odds ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 border border-frame rounded-lg p-5">
            <LiveOddsErrorBoundary>
              <LiveOdds token={token} />
            </LiveOddsErrorBoundary>
          </div>

          {/* ── Right column ──────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Session Info */}
            <div className="border border-frame rounded-lg p-5">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Session</h2>
              <p className="text-xs text-muted mb-1">Signed in as</p>
              <p className="text-accent text-sm font-mono truncate mb-4">{email}</p>
              <p className="text-xs text-muted mb-1">Session duration</p>
              <p className="text-ink font-mono text-lg mb-5">{formatDuration(elapsed)}</p>
              <button
                onClick={handleLogout}
                className="w-full border border-frame text-muted py-2 rounded-lg hover:border-red-700 hover:text-red-400 transition-colors text-sm"
              >
                Sign out
              </button>
            </div>

            {/* Responsible Gambling */}
            <div className="border border-frame rounded-lg p-5">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
                Responsible Gambling
              </h2>

              {rgSuccess && (
                <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-accent text-xs mb-4">
                  {rgSuccess}
                </div>
              )}
              {rgError && (
                <div className="bg-red-950/30 border border-red-900 rounded-lg px-3 py-2 text-red-400 text-xs mb-4">
                  {rgError}
                </div>
              )}

              {/* Current deposit limit */}
              {rgStatus?.depositLimit && (
                <div className="bg-frame rounded-lg p-3 mb-4 text-xs">
                  <p className="text-muted mb-1">Current deposit limit</p>
                  <p className="text-ink font-mono">
                    €{rgStatus.depositLimit.amount} / {rgStatus.depositLimit.period}
                  </p>
                  {rgStatus.depositLimit.pendingAmount && (
                    <p className="text-yellow-400 mt-1">
                      Pending: €{rgStatus.depositLimit.pendingAmount} from{' '}
                      {new Date(rgStatus.depositLimit.pendingFrom!).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Set deposit limit */}
              <form onSubmit={handleDepositLimit} className="mb-4 space-y-2">
                <p className="text-xs text-muted uppercase tracking-wider">Set deposit limit</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="€ amount"
                    min={1}
                    className="flex-1 bg-frame border border-frame rounded px-2 py-1.5 text-ink text-sm focus:border-accent focus:outline-none"
                  />
                  <select
                    value={depositPeriod}
                    onChange={(e) => setDepositPeriod(e.target.value as typeof depositPeriod)}
                    className="bg-frame border border-frame rounded px-2 py-1.5 text-ink text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={rgLoading || !depositAmount}
                  className="w-full border border-accent/50 text-accent py-1.5 rounded text-sm hover:bg-accent/10 disabled:opacity-50 transition-colors"
                >
                  Set limit
                </button>
              </form>

              {/* Self-exclude */}
              <div className="border-t border-frame pt-4">
                <p className="text-xs text-muted mb-2">
                  Demo: self-exclude for 2 minutes (a real platform uses 24h minimum). All tokens will be revoked.
                </p>
                <button
                  onClick={handleSelfExclude}
                  disabled={rgLoading}
                  className="w-full border border-red-900 text-red-400 py-2 rounded-lg text-sm hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                >
                  {rgLoading ? 'Processing…' : 'Self-exclude (2 min demo)'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
