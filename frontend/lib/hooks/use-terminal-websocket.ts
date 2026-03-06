'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConnectionStatus } from '../../components/Terminal'
import { openWebSocketConnection } from './use-websocket-connection'

interface UseTerminalWebSocketOptions {
  sessionId: string
  workingDir?: string
  /** Called when connection status changes */
  onStatusChange?: (status: ConnectionStatus) => void
  /** Called when the WebSocket disconnects */
  onDisconnect?: () => void
  /** Called when data is received from the server */
  onMessage?: (data: string) => void
  /** Called when terminal should display a message */
  onTerminalMessage?: (message: string) => void
  /** Called when backend sends an authoritative scrollback snapshot */
  onScrollbackSync?: (scrollback: string) => void
  /** Called before reconnect data arrives — clear terminal buffer to prevent duplicates */
  onBeforeReconnectData?: () => void
  /** Get current terminal dimensions for resize message */
  getDimensions?: () => { cols: number; rows: number } | null
}

interface UseTerminalWebSocketReturn {
  /** Current connection status */
  status: ConnectionStatus
  /** WebSocket ref for external access (sending data) */
  wsRef: React.RefObject<WebSocket | null>
  /** Manually reconnect */
  reconnect: () => void
  /** Send data to the server */
  sendInput: (data: string) => void
  /** Connect to WebSocket (called by terminal init) */
  connect: () => void
  /** Disconnect from WebSocket */
  disconnect: () => void
}

/**
 * Hook for managing WebSocket connection to terminal backend.
 *
 * Handles:
 * - Connection with timeout and exponential-backoff retry (up to 10 attempts)
 * - Status tracking (connecting, connected, disconnected, error, session_dead, timeout)
 * - Message forwarding
 *
 * Connection logic lives in use-websocket-connection.ts.
 *
 * @example
 * ```tsx
 * const { status, connect, sendInput, wsRef } = useTerminalWebSocket({
 *   sessionId: "abc-123",
 *   onMessage: (data) => terminal.write(data),
 *   onTerminalMessage: (msg) => terminal.writeln(msg),
 *   getDimensions: () => fitAddon.proposeDimensions(),
 * });
 * ```
 */
export function useTerminalWebSocket({
  sessionId,
  workingDir,
  onStatusChange,
  onDisconnect,
  onMessage,
  onTerminalMessage,
  onScrollbackSync,
  onBeforeReconnectData,
  getDimensions,
}: UseTerminalWebSocketOptions): UseTerminalWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const retryCountRef = useRef(0)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const connectRef = useRef<(() => void) | undefined>(undefined)
  const connectingRef = useRef(false)
  const hasConnectedRef = useRef(false)

  // Store callbacks in refs to avoid re-render loops
  const onStatusChangeRef = useRef(onStatusChange)
  const onDisconnectRef = useRef(onDisconnect)
  const onMessageRef = useRef(onMessage)
  const onTerminalMessageRef = useRef(onTerminalMessage)
  const onScrollbackSyncRef = useRef(onScrollbackSync)
  const onBeforeReconnectDataRef = useRef(onBeforeReconnectData)
  const getDimensionsRef = useRef(getDimensions)

  // Update callback refs when they change
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
    onDisconnectRef.current = onDisconnect
    onMessageRef.current = onMessage
    onTerminalMessageRef.current = onTerminalMessage
    onScrollbackSyncRef.current = onScrollbackSync
    onBeforeReconnectDataRef.current = onBeforeReconnectData
    getDimensionsRef.current = getDimensions
  }, [onStatusChange, onDisconnect, onMessage, onTerminalMessage, onScrollbackSync, onBeforeReconnectData, getDimensions])

  // Notify parent of status changes
  useEffect(() => {
    onStatusChangeRef.current?.(status)
  }, [status])

  // Track mounted state for cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const connect = useCallback(() => {
    if (connectingRef.current) return
    connectingRef.current = true

    openWebSocketConnection(sessionId, workingDir, {
      wsRef,
      mountedRef,
      connectingRef,
      hasConnectedRef,
      retryCountRef,
      timeoutIdRef,
      retryTimeoutRef,
      connectRef,
    }, {
      onTerminalMessage: (msg) => onTerminalMessageRef.current?.(msg),
      onMessage: (data) => onMessageRef.current?.(data),
      onScrollbackSync: (scrollback) => onScrollbackSyncRef.current?.(scrollback),
      onBeforeReconnectData: () => onBeforeReconnectDataRef.current?.(),
      onDisconnect: () => onDisconnectRef.current?.(),
      getDimensions: () => getDimensionsRef.current?.() ?? null,
      setStatus: (s) => setStatus(s as ConnectionStatus),
    })
  }, [sessionId, workingDir])

  // Keep ref in sync for recursive timeout calls
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const disconnect = useCallback(() => {
    connectingRef.current = false
    if (timeoutIdRef.current) { clearTimeout(timeoutIdRef.current); timeoutIdRef.current = null }
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    retryCountRef.current = 0
    onTerminalMessageRef.current?.('\x1b[33mReconnecting...\x1b[0m')
    setStatus('connecting')
    connect()
  }, [connect, disconnect])

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => { return () => { disconnect() } }, [disconnect])

  return { status, wsRef, reconnect, sendInput, connect, disconnect }
}
