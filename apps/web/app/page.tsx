import DemoBanner from '@/components/demo-banner'
import Link from 'next/link'

const features = [
  { icon: '🔐', label: 'JWT auth with refresh token rotation', detail: 'Access tokens (15 min) + revocable server-side refresh tokens (7 days)' },
  { icon: '🌍', label: 'Cloudflare Worker geoblocking', detail: 'Edge-level country filtering before traffic reaches the API' },
  { icon: '⚡', label: 'WebSocket real-time odds feed', detail: 'Authenticated WS connection with 3-second push updates and flash UI' },
  { icon: '🛡️', label: 'Responsible gambling enforcement', detail: '4-hour session timeout, self-exclusion, deposit limits with cooling-off' },
  { icon: '📋', label: 'Immutable audit log', detail: 'Every auth and gambling event written to PostgreSQL with IP and metadata' },
  { icon: '⏱️', label: 'Redis session cache', detail: 'Fast session reads with PostgreSQL fallback for durability' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <DemoBanner />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">

        {/* Hero */}
        <div className="mb-14">
          <p className="text-accent text-sm font-mono mb-3 tracking-widest uppercase">Portfolio project</p>
          <h1 className="text-4xl font-bold text-ink mb-4">betplatform</h1>
          <p className="text-muted text-lg leading-relaxed max-w-2xl">
            A backend-focused sports betting API demonstrating production patterns:
            JWT auth, WebSockets, Redis caching, PostgreSQL, and responsible gambling compliance.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              href="/login"
              className="px-5 py-2.5 bg-accent text-canvas font-semibold rounded hover:opacity-90 transition-opacity"
            >
              Sign in → Dashboard
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 border border-frame text-ink rounded hover:border-accent hover:text-accent transition-colors"
            >
              Register
            </Link>
            <a
              href="http://localhost:3001/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 border border-frame text-muted rounded hover:border-accent hover:text-accent transition-colors"
            >
              API Docs ↗
            </a>
          </div>
        </div>

        {/* Stack badges */}
        <div className="flex flex-wrap gap-2 mb-14">
          {['Fastify', 'TypeScript', 'PostgreSQL', 'Redis', 'Prisma', 'Cloudflare Workers', 'WebSockets', 'Next.js'].map((t) => (
            <span key={t} className="text-xs px-2.5 py-1 bg-frame border border-frame rounded-full text-muted font-mono">
              {t}
            </span>
          ))}
        </div>

        {/* Features */}
        <h2 className="text-sm text-muted font-mono tracking-widest uppercase mb-6">Backend features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.label} className="border border-frame rounded-lg p-4 hover:border-accent/40 transition-colors">
              <div className="flex items-start gap-3">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <p className="text-ink font-semibold text-sm">{f.label}</p>
                  <p className="text-muted text-xs mt-1 leading-relaxed">{f.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Architecture note */}
        <div className="mt-14 border border-frame rounded-lg p-5">
          <p className="text-xs text-muted font-mono tracking-widest uppercase mb-3">Architecture</p>
          <div className="font-mono text-sm text-muted space-y-1">
            <p><span className="text-accent">apps/api</span> — Fastify · PostgreSQL · Redis · Railway</p>
            <p><span className="text-accent">apps/web</span> — Next.js 15 · Tailwind · Vercel</p>
            <p><span className="text-accent">cloudflare/geo-worker</span> — Cloudflare Workers edge geoblocking</p>
            <p><span className="text-accent">packages/types</span> — shared TypeScript interfaces</p>
          </div>
        </div>

      </main>
    </div>
  )
}
