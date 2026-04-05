'use client'

import { useEffect, useRef, useState } from 'react'

interface MatchOdds {
  id: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  odds: { home: number; draw: number; away: number }
}

interface OddsMessage {
  type: 'odds'
  data: MatchOdds[]
  timestamp: string
}

type FlashDir = 'up' | 'down'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const WS_URL = API_URL.replace(/^http/, 'ws')

export default function LiveOdds({ token }: { token: string }) {
  const [matches, setMatches] = useState<MatchOdds[]>([])
  const [flash, setFlash] = useState<Record<string, FlashDir>>({})
  const [status, setStatus] = useState<'connecting' | 'live' | 'closed'>('connecting')
  const prevOdds = useRef<Record<string, number>>({})
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/odds/live?token=${encodeURIComponent(token)}`)

    ws.onopen = () => setStatus('live')

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as OddsMessage
      if (msg.type !== 'odds') return

      const newFlash: Record<string, FlashDir> = {}
      for (const match of msg.data) {
        for (const side of ['home', 'draw', 'away'] as const) {
          const key = `${match.id}-${side}`
          const prev = prevOdds.current[key]
          const curr = match.odds[side]
          if (prev !== undefined && curr !== prev) {
            newFlash[key] = curr > prev ? 'up' : 'down'
          }
          prevOdds.current[key] = curr
        }
      }

      setMatches(msg.data)

      if (Object.keys(newFlash).length > 0) {
        setFlash(newFlash)
        if (flashTimer.current) clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlash({}), 1_000)
      }
    }

    ws.onclose = () => setStatus('closed')
    ws.onerror = () => setStatus('closed')

    return () => {
      ws.close()
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [token])

  const oddsClass = (key: string) => {
    if (flash[key] === 'up') return 'text-accent transition-colors duration-300'
    if (flash[key] === 'down') return 'text-red-400 transition-colors duration-300'
    return 'text-ink transition-colors duration-300'
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold text-ink">Live Odds</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-mono ${
            status === 'live'
              ? 'bg-accent/10 text-accent'
              : status === 'connecting'
              ? 'bg-yellow-900/40 text-yellow-400'
              : 'bg-red-900/40 text-red-400'
          }`}
        >
          {status === 'live' ? '● live' : status === 'connecting' ? '◌ connecting' : '✕ disconnected'}
        </span>
      </div>

      {matches.length === 0 && status !== 'closed' && (
        <p className="text-muted text-sm animate-pulse">Waiting for odds feed...</p>
      )}

      {status === 'closed' && matches.length === 0 && (
        <p className="text-red-400 text-sm">Connection closed — is the API running?</p>
      )}

      <div className="space-y-2">
        {matches.map((match) => (
          <div key={match.id} className="border border-frame rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-ink">
                {match.homeTeam} <span className="text-muted">vs</span> {match.awayTeam}
              </span>
              <span className="text-xs text-muted">
                {new Date(match.commenceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="bg-frame rounded p-2">
                <div className="text-muted text-xs mb-1">Home</div>
                <div className={`font-mono font-semibold ${oddsClass(`${match.id}-home`)}`}>
                  {match.odds.home.toFixed(2)}
                </div>
              </div>
              <div className="bg-frame rounded p-2">
                <div className="text-muted text-xs mb-1">Draw</div>
                <div className={`font-mono font-semibold ${oddsClass(`${match.id}-draw`)}`}>
                  {match.odds.draw.toFixed(2)}
                </div>
              </div>
              <div className="bg-frame rounded p-2">
                <div className="text-muted text-xs mb-1">Away</div>
                <div className={`font-mono font-semibold ${oddsClass(`${match.id}-away`)}`}>
                  {match.odds.away.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
