'use client'

import { useCallback, useRef } from 'react'

type XtermTerminal = InstanceType<typeof import('@xterm/xterm').Terminal>

interface UseTerminalWriteQueueOptions {
  terminalRef: React.RefObject<XtermTerminal | null>
  isVisibleRef: React.RefObject<boolean>
}

interface UseTerminalWriteQueueReturn {
  enqueueWrite: (data: string) => void
  applySnapshot: (snapshot: string) => void
  resetQueue: () => void
}

export function useTerminalWriteQueue({
  terminalRef,
  isVisibleRef,
}: UseTerminalWriteQueueOptions): UseTerminalWriteQueueReturn {
  const pendingWriteRef = useRef(Promise.resolve())

  const enqueueTerminalWrite = useCallback(
    (operation: (term: XtermTerminal, resolve: () => void) => void) => {
      pendingWriteRef.current = pendingWriteRef.current.then(
        () =>
          new Promise<void>((resolve) => {
            const term = terminalRef.current
            if (!term || !isVisibleRef.current) {
              resolve()
              return
            }
            operation(term, resolve)
          }),
      )
    },
    [terminalRef, isVisibleRef],
  )

  const getSnapshotLastLine = useCallback((snapshot: string) => {
    const lines = snapshot.split(/\r?\n/)
    while (lines.length > 0 && lines.at(-1) === '') {
      lines.pop()
    }
    return lines.at(-1) ?? ''
  }, [])

  const hasPendingPromptInput = useCallback(
    (term: XtermTerminal, snapshot: string) => {
      const buffer = term.buffer.active
      if (buffer.viewportY < buffer.baseY) return false

      const cursorLine = buffer.getLine(buffer.baseY + buffer.cursorY)
      const currentLine = cursorLine?.translateToString(true) ?? ''
      const snapshotLastLine = getSnapshotLastLine(snapshot)

      return (
        currentLine.length > snapshotLastLine.length &&
        currentLine.startsWith(snapshotLastLine)
      )
    },
    [getSnapshotLastLine],
  )

  const enqueueWrite = useCallback(
    (data: string) => {
      enqueueTerminalWrite((term, resolve) => {
        const buffer = term.buffer.active
        const savedViewportY = buffer.viewportY
        const isScrolledUp = buffer.viewportY < buffer.baseY

        term.write(data, () => {
          if (isScrolledUp && terminalRef.current) {
            terminalRef.current.scrollToLine(savedViewportY)
          }
          resolve()
        })
      })
    },
    [enqueueTerminalWrite, terminalRef],
  )

  const applySnapshot = useCallback(
    (snapshot: string) => {
      enqueueTerminalWrite((term, resolve) => {
        if (hasPendingPromptInput(term, snapshot)) {
          resolve()
          return
        }

        const buffer = term.buffer.active
        const linesFromBottom = buffer.baseY - buffer.viewportY
        term.reset()
        term.write(snapshot, () => {
          if (terminalRef.current && linesFromBottom > 0) {
            const nextBuffer = terminalRef.current.buffer.active
            terminalRef.current.scrollToLine(
              Math.max(nextBuffer.baseY - linesFromBottom, 0),
            )
          }
          resolve()
        })
      })
    },
    [enqueueTerminalWrite, hasPendingPromptInput, terminalRef],
  )

  const resetQueue = useCallback(() => {
    pendingWriteRef.current = Promise.resolve()
  }, [])

  return { enqueueWrite, applySnapshot, resetQueue }
}
