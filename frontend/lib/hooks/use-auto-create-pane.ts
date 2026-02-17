'use client'

import { useEffect, useRef } from 'react'
import { buildApiUrl } from '@/lib/api-config'
import { generatePaneName } from './terminal-handler-utils'

interface UseAutoCreatePaneProps {
  panes: Array<{ pane_type: string }>
  isLoading: boolean
  isPaneCreating: boolean
  createAdHocPane: (name: string) => Promise<{
    sessions: Array<{ id: string; mode: string }>
  }>
  switchToSession: (id: string) => void
}

/**
 * Auto-creates a default pane when:
 * 1. Initial load with no panes (verified via API count)
 * 2. Last pane is closed (N→0 transition)
 *
 * Prevents race conditions with refs to track creation state.
 */
export function useAutoCreatePane({
  panes,
  isLoading,
  isPaneCreating,
  createAdHocPane,
  switchToSession,
}: UseAutoCreatePaneProps): void {
  const isAutoCreatingRef = useRef(false)
  const initialLoadProcessed = useRef(false)
  const prevPanesLengthRef = useRef<number | null>(null)

  useEffect(() => {
    // Skip if still loading or already creating
    if (isLoading || isPaneCreating || isAutoCreatingRef.current) return

    const prevLength = prevPanesLengthRef.current
    const currLength = panes.length

    // Update prev length for next render
    prevPanesLengthRef.current = currLength

    // Case 1: Initial load (first time we see panes data)
    if (prevLength === null && !initialLoadProcessed.current) {
      initialLoadProcessed.current = true

      if (currLength === 0) {
        isAutoCreatingRef.current = true
        const adHocCount = panes.filter((p) => p.pane_type === 'adhoc').length
        fetch(buildApiUrl('/api/terminal/panes/count'))
          .then((res) => res.json())
          .then((data) => {
            if (data.count === 0) {
              return createAdHocPane(generatePaneName('Ad-Hoc Terminal', adHocCount)).then(
                (newPane) => {
                  const shellSession = newPane.sessions.find(
                    (s) => s.mode === 'shell',
                  )
                  if (shellSession) {
                    switchToSession(shellSession.id)
                  }
                },
              )
            }
          })
          .catch((error) => {
            console.error('Failed to auto-create pane on initial load:', error)
          })
          .finally(() => {
            isAutoCreatingRef.current = false
          })
      }
      return
    }

    // Case 2: Last pane closed (N→0 transition, where N > 0)
    if (prevLength !== null && prevLength > 0 && currLength === 0) {
      isAutoCreatingRef.current = true
      const adHocCount = panes.filter((p) => p.pane_type === 'adhoc').length
      createAdHocPane(generatePaneName('Ad-Hoc Terminal', adHocCount))
        .then((newPane) => {
          const shellSession = newPane.sessions.find((s) => s.mode === 'shell')
          if (shellSession) {
            switchToSession(shellSession.id)
          }
        })
        .catch((error) => {
          console.error('Failed to auto-create pane after closing last:', error)
        })
        .finally(() => {
          isAutoCreatingRef.current = false
        })
    }
  }, [
    isLoading,
    panes,
    isPaneCreating,
    createAdHocPane,
    switchToSession,
  ])
}
