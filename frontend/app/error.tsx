'use client'

import { useEffect } from 'react'

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js App Router convention requires this export name
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Terminal error boundary caught:', error)
  }, [error])

  return (
    <div className="h-dvh flex flex-col items-center justify-center bg-slate-900 text-slate-300 gap-4" role="alert" aria-live="assertive">
      <div className="text-red-400 font-mono text-sm">
        Terminal encountered an error
      </div>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-mono transition-colors"
      >
        Reload Terminal
      </button>
    </div>
  )
}
