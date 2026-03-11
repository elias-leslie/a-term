'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { TerminalTabs } from '@/components/TerminalTabs'

function TerminalPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project') || undefined
  const projectPath = searchParams.get('dir') || undefined

  return (
    <div className="h-dvh flex flex-col bg-slate-900">
      <TerminalTabs
        projectId={projectId}
        projectPath={projectPath}
        className="flex-1 min-h-0"
      />
    </div>
  )
}

// Wrap in Suspense for useSearchParams
export default function Home() {
  return (
    <Suspense
      fallback={
        <div
          className="h-dvh flex items-center justify-center bg-slate-900 px-6 text-center text-slate-400"
          aria-live="polite"
        >
          Preparing terminal workspace…
        </div>
      }
    >
      <TerminalPage />
    </Suspense>
  )
}
