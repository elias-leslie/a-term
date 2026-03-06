'use client'

import { clsx } from 'clsx'
import {
  forwardRef,
  useCallback,
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
    const pendingWriteRef = useRef(Promise.resolve())

    // Keep isVisibleRef in sync with prop
    useEffect(() => {
      isVisibleRef.current = isVisible
    }, [isVisible])

    const enqueueWrite = useCallback(
      (data: string, restoreViewport = false) => {
        pendingWriteRef.current = pendingWriteRef.current.then(
          () =>
            new Promise<void>((resolve) => {
              const term = terminalRef.current
              if (!term || !isVisibleRef.current) {
                resolve()
                return
              }

              const buffer = term.buffer.active
              const linesFromBottom = buffer.baseY - buffer.viewportY
              term.write(data, () => {
                if (restoreViewport && terminalRef.current && linesFromBottom > 0) {
                  const nextBuffer = terminalRef.current.buffer.active
                  terminalRef.current.scrollToLine(
                    Math.max(nextBuffer.baseY - linesFromBottom, 0),
                  )
                }
                resolve()
              })
            }),
        )
      },
      [],
    )

    const enqueueSnapshot = useCallback((snapshot: string) => {
      pendingWriteRef.current = pendingWriteRef.current.then(
        () =>
          new Promise<void>((resolve) => {
            const term = terminalRef.current
            if (!term || !isVisibleRef.current) {
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
          }),
      )
    }, [])

    // WebSocket connection management via hook
    const { status, wsRef, reconnect, sendInput, connect, disconnect } =
      useTerminalWebSocket({
        sessionId,
        workingDir,
        onStatusChange,
        onDisconnect,
        onBeforeReconnectData: () => {
          // Clear xterm.js buffer before server sends fresh scrollback on reconnect.
          // Prevents duplicate content from stacking old buffer + new scrollback.
          pendingWriteRef.current = Promise.resolve()
          terminalRef.current?.reset()
        },
        onMessage: (data) => {
          if (!terminalRef.current || !isVisibleRef.current) return
          const buffer = terminalRef.current.buffer.active
          enqueueWrite(data, buffer.viewportY < buffer.baseY)
        },
        onScrollbackSync: (scrollback) => {
          enqueueSnapshot(scrollback)
        },
        onTerminalMessage: (message) => {
          enqueueWrite(`${message}\r\n`)
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

    // Stable callback for terminal input — uses refs so identity never changes,
    // preventing useTerminalInstance from destroying/recreating xterm on every render.
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally empty deps — reads refs at call time
    const handleTerminalData = useCallback((data: string) => {
      if (!isFocusedRef.current) return
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data)
      }
    }, [])

    // Terminal instance initialization and lifecycle
    useTerminalInstance(
      {
        cursorBlink,
        cursorStyle,
        fontSize,
        fontFamily,
        scrollback,
        theme,
        onData: handleTerminalData,
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
          const buffer = terminalRef.current.buffer.active
          const lines: string[] = []
          for (let i = 0; i <= buffer.baseY + buffer.cursorY; i++) {
            const line = buffer.getLine(i)
            if (line) lines.push(line.translateToString(true))
          }
          return lines.join('\n')
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
        pasteInput: (data: string) => {
          // Wrap in bracketed paste sequences so TUI apps (Claude Code, vim, etc.)
          // recognize this as pasted content and insert it into their input buffer
          sendInput(`\x1b[200~${data}\x1b[201~`)
        },
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
