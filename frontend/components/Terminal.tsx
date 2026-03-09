'use client'

import { clsx } from 'clsx'
import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { PHOSPHOR_THEME, SCROLLBACK } from '../lib/constants/terminal'
import { useTerminalHandle } from '../lib/hooks/use-terminal-handle'
import { useTerminalInstance } from '../lib/hooks/use-terminal-instance'
import { useTerminalResize } from '../lib/hooks/use-terminal-resize'
import { useTerminalScrolling } from '../lib/hooks/use-terminal-scrolling'
import { useTerminalWebSocket } from '../lib/hooks/use-terminal-websocket'
import { useTerminalWriteQueue } from '../lib/hooks/use-terminal-write-queue'
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

    useEffect(() => {
      isVisibleRef.current = isVisible
    }, [isVisible])

    const { enqueueWrite, applySnapshot, resetQueue } = useTerminalWriteQueue({
      terminalRef,
      isVisibleRef,
    })

    const { status, wsRef, reconnect, sendInput, connect, disconnect } =
      useTerminalWebSocket({
        sessionId,
        workingDir,
        onStatusChange,
        onDisconnect,
        onBeforeReconnectData: () => {
          resetQueue()
          terminalRef.current?.reset()
        },
        onMessage: (data) => {
          if (!terminalRef.current) return
          enqueueWrite(data)
        },
        onScrollbackSync: applySnapshot,
        onTerminalMessage: (message) => {
          enqueueWrite(`${message}\r\n`)
        },
        getDimensions: () => fitAddonRef.current?.proposeDimensions() ?? null,
      })

    const isMobile = useMemo(() => isMobileDevice(), [])

    const { setupScrolling } = useTerminalScrolling({
      wsRef,
      terminalRef,
      isMobile,
    })

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally empty deps — reads refs at call time
    const handleTerminalData = useCallback((data: string) => {
      if (!isFocusedRef.current) return
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data)
      }
    }, [])

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
      { terminalRef, fitAddonRef, containerRef, isFocusedRef },
    )

    useTerminalResize({ terminalRef, fitAddonRef, containerRef, wsRef })

    useTerminalHandle(ref, { reconnect, sendInput, status, terminalRef })

    useEffect(() => {
      if (isVisible) {
        connect()
        return () => disconnect()
      }
      disconnect()
    }, [connect, disconnect, isVisible])

    return (
      <div className={clsx('relative overflow-hidden', className)}>
        <div
          ref={containerRef}
          className="w-full h-full overflow-hidden"
          style={{ backgroundColor: theme.background }}
        />
      </div>
    )
  },
)
