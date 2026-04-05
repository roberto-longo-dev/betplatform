'use client'

import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class LiveOddsErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-900 bg-red-950/20 rounded-lg p-6 text-center">
          <p className="text-red-400 font-semibold mb-1">Live odds unavailable</p>
          <p className="text-muted text-sm">{this.state.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}
