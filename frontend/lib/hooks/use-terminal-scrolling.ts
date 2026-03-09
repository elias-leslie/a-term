'use client'

import type { Terminal } from '@xterm/xterm'
import { useCallback } from 'react'
import { SCROLL_THRESHOLD } from '../constants/terminal'

interface UseTerminalScrollingOptions {
  wsRef: React.RefObject<WebSocket | null>
  terminalRef: React.RefObject<Terminal | null>
  isMobile: boolean
}

interface ScrollingSetupResult {
  wheelCleanup: () => void
  touchCleanup: () => void
}

interface UseTerminalScrollingReturn {
  setupScrolling: (container: HTMLElement) => ScrollingSetupResult
}

const ARROW_UP = '\x1b[A'
const ARROW_DOWN = '\x1b[B'
const MOBILE_TOUCH_SCROLL_SENSITIVITY = 2

function isAlternateScreen(terminal: Terminal): boolean {
  return terminal.buffer.active.type === 'alternate'
}

export function getTouchScrollLineDelta(pixelDeltaY: number, cellHeight: number): number {
  if (cellHeight <= 0 || pixelDeltaY === 0) return 0
  const effectiveCellHeight = cellHeight / MOBILE_TOUCH_SCROLL_SENSITIVITY
  const lines = Math.max(1, Math.floor(Math.abs(pixelDeltaY) / effectiveCellHeight))
  return pixelDeltaY > 0 ? lines : -lines
}

export function refreshTerminalViewport(terminal: Terminal): void {
  terminal.refresh(0, Math.max(terminal.rows - 1, 0))
}

export function initializeTouchTracking(currentY: number): { touchStartY: number; lastSentY: number } {
  return { touchStartY: currentY, lastSentY: currentY }
}

export function useTerminalScrolling({
  wsRef,
  terminalRef,
  isMobile,
}: UseTerminalScrollingOptions): UseTerminalScrollingReturn {
  const sendArrowKey = useCallback(
    (direction: 'up' | 'down') => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return
      wsRef.current.send(direction === 'up' ? ARROW_UP : ARROW_DOWN)
    },
    [wsRef],
  )

  const setupScrolling = useCallback(
    (container: HTMLElement): ScrollingSetupResult => {
      const handleWheel = (e: WheelEvent) => {
        const terminal = terminalRef.current
        if (!terminal) return
        if (isAlternateScreen(terminal)) {
          e.preventDefault()
          e.stopPropagation()
          const lines = Math.max(1, Math.floor(Math.abs(e.deltaY) / 40))
          const direction = e.deltaY < 0 ? 'up' : 'down'
          for (let i = 0; i < lines; i++) sendArrowKey(direction)
        }
      }

      container.addEventListener('wheel', handleWheel, { capture: true, passive: false })
      const wheelCleanup = () => container.removeEventListener('wheel', handleWheel, { capture: true })

      let touchCleanup = () => {}

      if (isMobile) {
        let touchStartY = 0
        let lastSentY = 0
        let pendingNormalScrollDeltaY = 0

        const handleTouchStart = (e: TouchEvent) => {
          touchStartY = e.touches[0].clientY
          lastSentY = touchStartY
          pendingNormalScrollDeltaY = 0
        }

        const handleTouchMove = (e: TouchEvent) => {
          const terminal = terminalRef.current
          if (!terminal) return
          const currentY = e.touches[0].clientY

          if (touchStartY === 0 && lastSentY === 0) {
            ;({ touchStartY, lastSentY } = initializeTouchTracking(currentY))
          }

          if (isAlternateScreen(terminal)) {
            e.preventDefault()
            e.stopPropagation()
            const deltaY = lastSentY - currentY
            if (Math.abs(deltaY) >= SCROLL_THRESHOLD) {
              sendArrowKey(deltaY > 0 ? 'down' : 'up')
              lastSentY = currentY
            }
            return
          }

          pendingNormalScrollDeltaY += lastSentY - currentY
          lastSentY = currentY

          const screen = container.querySelector<HTMLElement>('.xterm-screen')
          const cellHeight = screen ? screen.clientHeight / Math.max(terminal.rows, 1) : 0
          const lineDelta = getTouchScrollLineDelta(pendingNormalScrollDeltaY, cellHeight)
          if (lineDelta === 0) return

          e.preventDefault()
          e.stopPropagation()
          terminal.scrollLines(lineDelta)
          refreshTerminalViewport(terminal)
          pendingNormalScrollDeltaY -= lineDelta * (cellHeight / MOBILE_TOUCH_SCROLL_SENSITIVITY)
        }

        const handleTouchEnd = () => {
          touchStartY = 0
          lastSentY = 0
          pendingNormalScrollDeltaY = 0
        }

        container.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true })
        container.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
        container.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true })
        container.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true })

        touchCleanup = () => {
          container.removeEventListener('touchstart', handleTouchStart, { capture: true })
          container.removeEventListener('touchmove', handleTouchMove, { capture: true })
          container.removeEventListener('touchend', handleTouchEnd, { capture: true })
          container.removeEventListener('touchcancel', handleTouchEnd, { capture: true })
        }
      }

      return { wheelCleanup, touchCleanup }
    },
    [terminalRef, isMobile, sendArrowKey],
  )

  return { setupScrolling }
}
