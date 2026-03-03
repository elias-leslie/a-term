'use client'

import type React from 'react'
import { getWsUrl } from '../api-config'
import {
  CONNECTION_TIMEOUT,
  WS_CLOSE_CODE_SESSION_DEAD,
} from '../constants/terminal'

export interface WebSocketConnectionRefs {
  wsRef: React.MutableRefObject<WebSocket | null>
  mountedRef: React.MutableRefObject<boolean>
  connectingRef: React.MutableRefObject<boolean>
  hasConnectedRef: React.MutableRefObject<boolean>
  retryCountRef: React.MutableRefObject<number>
  timeoutIdRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  retryTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  connectRef: React.MutableRefObject<(() => void) | undefined>
}

export interface WebSocketConnectionCallbacks {
  onTerminalMessage?: (message: string) => void
  onMessage?: (data: string) => void
  onBeforeReconnectData?: () => void
  onDisconnect?: () => void
  getDimensions?: () => { cols: number; rows: number } | null
  setStatus: (status: string) => void
}

/** Build and open a WebSocket, wiring all event handlers for connection lifecycle. */
export function openWebSocketConnection(
  sessionId: string,
  workingDir: string | undefined,
  refs: WebSocketConnectionRefs,
  callbacks: WebSocketConnectionCallbacks,
): void {
  const {
    wsRef,
    mountedRef,
    connectingRef,
    hasConnectedRef,
    retryCountRef,
    timeoutIdRef,
    retryTimeoutRef,
    connectRef,
  } = refs
  const {
    onTerminalMessage,
    onMessage,
    onBeforeReconnectData,
    onDisconnect,
    getDimensions,
    setStatus,
  } = callbacks

  // Close any existing connection
  if (wsRef.current) {
    wsRef.current.close()
    wsRef.current = null
  }
  if (timeoutIdRef.current) {
    clearTimeout(timeoutIdRef.current)
    timeoutIdRef.current = null
  }
  if (retryTimeoutRef.current) {
    clearTimeout(retryTimeoutRef.current)
    retryTimeoutRef.current = null
  }

  let wsPath = `/ws/terminal/${sessionId}`
  if (workingDir) {
    wsPath += `?working_dir=${encodeURIComponent(workingDir)}`
  }

  let ws: WebSocket
  try {
    ws = new WebSocket(getWsUrl(wsPath))
  } catch {
    connectingRef.current = false
    setStatus('error')
    onTerminalMessage?.('\r\n\x1b[31mFailed to create WebSocket connection\x1b[0m')
    return
  }
  wsRef.current = ws

  // Set up connection timeout with exponential-backoff retry
  timeoutIdRef.current = setTimeout(() => {
    if (ws.readyState !== WebSocket.CONNECTING) return
    ws.close()
    if (!mountedRef.current) return

    const maxRetries = 10
    if (retryCountRef.current < maxRetries) {
      const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000)
      retryCountRef.current += 1
      onTerminalMessage?.(
        `\x1b[33mConnection timeout, retrying (${retryCountRef.current}/${maxRetries})...\x1b[0m`,
      )
      setStatus('connecting')
      retryTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) connectRef.current?.()
      }, delay)
    } else {
      setStatus('timeout')
      onTerminalMessage?.('\r\n\x1b[31mConnection timeout after maximum retries\x1b[0m')
      onDisconnect?.()
    }
  }, CONNECTION_TIMEOUT)

  ws.onopen = () => {
    connectingRef.current = false
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current)
    if (!mountedRef.current) return

    retryCountRef.current = 0
    setStatus('connected')

    if (!hasConnectedRef.current) {
      hasConnectedRef.current = true
      onTerminalMessage?.(`Connected to terminal session: ${sessionId}`)
      onTerminalMessage?.('')
    } else {
      onBeforeReconnectData?.()
    }

    const dims = getDimensions?.()
    if (dims) {
      ws.send(JSON.stringify({ __ctrl: true, resize: { cols: dims.cols, rows: dims.rows } }))
    }
  }

  ws.onmessage = (event) => {
    if (!mountedRef.current) return
    try {
      onMessage?.(event.data)
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  ws.onclose = (event) => {
    connectingRef.current = false
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current)
    if (!mountedRef.current) return

    if (event.code === WS_CLOSE_CODE_SESSION_DEAD) {
      setStatus('session_dead')
      try {
        const reason = JSON.parse(event.reason)
        onTerminalMessage?.(`\r\n\x1b[31m${reason.message || 'Session not found'}\x1b[0m`)
      } catch {
        onTerminalMessage?.('\r\n\x1b[31mSession not found or could not be restored\x1b[0m')
      }
    } else {
      setStatus('disconnected')
      onTerminalMessage?.('\r\n\x1b[31mDisconnected from terminal\x1b[0m')
    }
    onDisconnect?.()
  }

  ws.onerror = () => {
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current)
    if (!mountedRef.current) return
    setStatus('error')
    onTerminalMessage?.('\r\n\x1b[31mConnection error\x1b[0m')
  }
}
