'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-300 gap-4">
      <div className="text-red-400 font-mono text-sm">
        Page not found
      </div>
      <Link
        href="/"
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-mono transition-colors"
      >
        Go Home
      </Link>
    </div>
  )
}
