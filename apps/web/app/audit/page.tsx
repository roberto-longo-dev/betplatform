'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DemoBanner from '@/components/demo-banner'
import { useAuth } from '@/lib/auth-context'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

interface AuditEntry {
  id: string
  action: string
  amount: number | null
  ipAddress: string | null
  metadata: unknown
  createdAt: string
}

interface AuditResponse {
  logs: AuditEntry[]
  total: number
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:                  'text-accent',
  REGISTER:               'text-blue-400',
  LOGOUT:                 'text-muted',
  REFRESH_TOKEN:          'text-muted',
  FAILED_LOGIN:           'text-red-400',
  SELF_EXCLUSION:         'text-orange-400',
  SESSION_TIMEOUT:        'text-yellow-400',
  DEPOSIT_LIMIT_SET:      'text-purple-400',
  DEPOSIT_LIMIT_PENDING:  'text-purple-300',
  TOKEN_REVOKED:          'text-red-300',
}

export default function AuditPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { router.push('/login'); return }

    fetch(`${API}/audit/log`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load audit log')
        return res.json() as Promise<AuditResponse>
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token, router])

  if (!token) return null

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <DemoBanner />
      <div className="max-w-5xl mx-auto w-full px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/dashboard" className="text-muted text-xs hover:text-accent transition-colors">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold text-ink mt-1">Audit log</h1>
          </div>
          {data && (
            <span className="text-muted text-sm">{data.total} total entries</span>
          )}
        </div>

        {loading && (
          <p className="text-muted text-sm animate-pulse">Loading audit entries…</p>
        )}

        {error && (
          <div className="bg-red-950/30 border border-red-900 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {data && data.logs.length === 0 && (
          <p className="text-muted text-sm">No audit entries yet. Try logging in, refreshing the token, or using the responsible gambling panel.</p>
        )}

        {data && data.logs.length > 0 && (
          <div className="border border-frame rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-frame text-xs text-muted uppercase tracking-wider">
              <div className="col-span-3">Timestamp</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-2">IP</div>
              <div className="col-span-5">Metadata</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-frame">
              {data.logs.map((entry) => (
                <div key={entry.id} className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-frame/50 transition-colors">
                  <div className="col-span-3 text-muted text-xs font-mono">
                    {new Date(entry.createdAt).toLocaleString([], {
                      month: 'short', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </div>
                  <div className={`col-span-2 text-xs font-mono font-semibold ${ACTION_COLORS[entry.action] ?? 'text-ink'}`}>
                    {entry.action}
                  </div>
                  <div className="col-span-2 text-muted text-xs font-mono truncate">
                    {entry.ipAddress ?? '—'}
                  </div>
                  <div className="col-span-5 text-muted text-xs font-mono truncate">
                    {entry.metadata
                      ? JSON.stringify(entry.metadata)
                      : entry.amount != null
                      ? `amount: ${entry.amount}`
                      : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
