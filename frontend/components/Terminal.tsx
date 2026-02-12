'use client'

import { clsx } from 'clsx'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import '@xterm/xterm/css/xterm.css'
import {
  PHOSPHOR_THEME,
  SCROLLBACK,
} from '../lib/constants/terminal'
import { useTerminalInstance } from '../lib/hooks/use-terminal-instance'
import { useTerminalResize } from '../lib/hooks/use-terminal-resize'
import { useTerminalScrolling } from '../lib/hooks/use-terminal-scrolling'
import { useTerminalWebSocket } from '../lib/hooks/use-terminal-websocket'
import { isMobileDevice } from '../lib/utils/device'
import type { TerminalHandle, TerminalProps } from './terminal.types'

export type {
  ConnectionStatus,
  TerminalHandle,
  TerminalProps,
} from './terminal.types'

// Dynamic imports for xterm (client-side only)
let Terminal: typeof import('@xterm/xterm').Terminal
let FitAddon: typeof import('@xterm/addon-fit').FitAddon

export const TerminalComponent = forwardRef<TerminalHandle, TerminalProps>(
  function TerminalComponent(
    {
      sessionId,
      workingDir,
      className,
      onDisconnect,
      onStatusChange,
      fontFamily = "'JetBrains Mono', monospace",
      fontSize = 14,
      scrollback = SCROLLBACK,
      cursorStyle = 'block',
      cursorBlink = true,
      theme = PHOSPHOR_THEME,
      isVisible = true,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<InstanceType<typeof Terminal> | null>(null)
    const fitAddonRef = useRef<InstanceType<typeof FitAddon> | null>(null)
    const isFocusedRef = useRef(false)
    const isVisibleRef = useRef(isVisible)

    // Keep isVisibleRef in sync with prop
    useEffect(() => {
      isVisibleRef.current = isVisible
    }, [isVisible])

    // WebSocket connection management via hook
    const { status, wsRef, reconnect, sendInput, connect, disconnect } =
      useTerminalWebSocket({
        sessionId,
        workingDir,
        onStatusChange,
        onDisconnect,
        onMessage: (data) => {
          if (!terminalRef.current) return
          // Skip write if terminal is not visible (prevents corruption in multi-pane)
          if (!isVisibleRef.current) return
          // Preserve scroll position if user is viewing history
          const buffer = terminalRef.current.buffer.active
          const distanceFromBottom = buffer.baseY - buffer.viewportY
          terminalRef.current.write(data)
          // Restore scroll position if user wasn't at bottom
          if (distanceFromBottom > 0) {
            terminalRef.current.scrollLines(-distanceFromBottom)
          }
        },
        onTerminalMessage: (message) => {
          terminalRef.current?.writeln(message)
        },
        getDimensions: () => fitAddonRef.current?.proposeDimensions() ?? null,
      })

    // Memoize mobile detection to prevent unnecessary re-renders
    // Only computed once on mount - window resize doesn't change device type
    const isMobile = useMemo(() => isMobileDevice(), [])

    // Scrolling management via hook (native xterm.js + alternate screen detection)
    const { setupScrolling } = useTerminalScrolling({
      wsRef,
      terminalRef,
      isMobile,
    })

    // Terminal instance initialization and lifecycle
    useTerminalInstance(
      {
        cursorBlink,
        cursorStyle,
        fontSize,
        fontFamily,
        scrollback,
        theme,
        onData: (data) => {
          // Only send input if this terminal has focus (prevents grid duplication)
          if (!isFocusedRef.current) return
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(data)
          }
        },
        setupScrolling,
      },
      {
        terminalRef,
        fitAddonRef,
        containerRef,
        isFocusedRef,
      },
    )

    // Resize management with ResizeObserver
    useTerminalResize({
      terminalRef,
      fitAddonRef,
      containerRef,
      wsRef,
    })

    // Expose functions to parent
    useImperativeHandle(
      ref,
      () => ({
        reconnect,
        getContent: () => {
          if (!terminalRef.current) return ''
          // Select all text and get the selection
          terminalRef.current.selectAll()
          const content = terminalRef.current.getSelection()
          terminalRef.current.clearSelection()
          return content
        },
        getLastLine: () => {
          if (!terminalRef.current) return ''
          const term = terminalRef.current
          const buffer = term.buffer.active
          // Get the line at the cursor position
          const cursorY = buffer.cursorY + buffer.viewportY
          const line = buffer.getLine(cursorY)
          if (!line) return ''
          // Get text from the line, trimmed
          let text = line.translateToString(true)
          // Remove common prompt patterns (e.g., "user@host:~$ ")
          text = text.replace(/^.*?[#$%>]\s*/, '')
          return text.trim()
        },
        sendInput,
        status,
      }),
      [status, reconnect, sendInput],
    )

    // Connect to WebSocket on mount
    useEffect(() => {
      connect()
      return () => {
        disconnect()
      }
    }, [connect, disconnect])

    return (
      <div className={clsx('relative overflow-hidden', className)}>
        {/* Terminal container */}
        <div
          ref={containerRef}
          className="w-full h-full overflow-hidden"
          style={{ backgroundColor: theme.background }}
        />
      </div>
    )
  },
)
