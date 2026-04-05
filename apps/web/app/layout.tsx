import type { Metadata } from 'next'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

export const metadata: Metadata = {
  title: 'betplatform — Portfolio Demo',
  description: 'Backend architecture demo: JWT auth, WebSockets, Redis, responsible gambling.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-canvas">
      <body className="min-h-screen bg-canvas text-ink font-mono antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
