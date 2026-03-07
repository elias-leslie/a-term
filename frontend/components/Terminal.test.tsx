import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TerminalComponent } from './Terminal'

type TerminalHookOptions = Parameters<
  typeof import('../lib/hooks/use-terminal-websocket')['useTerminalWebSocket']
>[0]

const websocketState: {
  options: TerminalHookOptions | null
  connect: ReturnType<typeof vi.fn> | null
  disconnect: ReturnType<typeof vi.fn> | null
  connectCalls: number
  disconnectCalls: number
} = {
  options: null,
  connect: null,
  disconnect: null,
  connectCalls: 0,
  disconnectCalls: 0,
}

const fakeFitAddon = {
  proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
}

const operationCallbacks: Array<() => void> = []

const fakeTerminal = {
  buffer: {
    active: {
      baseY: 100,
      viewportY: 100,
      cursorY: 0,
      getLine: vi.fn(
        (): { translateToString: () => string } => ({
          translateToString: () => 'kasadis@host:~$ ',
        }),
      ),
    },
  },
  reset: vi.fn(),
  scrollToLine: vi.fn(),
  write: vi.fn((_data: string, callback?: () => void) => {
    if (callback) {
      operationCallbacks.push(callback)
    }
  }),
  dispose: vi.fn(),
}

vi.mock('../lib/hooks/use-terminal-websocket', () => ({
  useTerminalWebSocket: (options: TerminalHookOptions) => {
    const connect = vi.fn(() => {
      websocketState.connectCalls += 1
    })
    const disconnect = vi.fn(() => {
      websocketState.disconnectCalls += 1
    })
    websocketState.options = options
    websocketState.connect = connect
    websocketState.disconnect = disconnect
    return {
      status: 'connected',
      wsRef: { current: null },
      reconnect: vi.fn(),
      sendInput: vi.fn(),
      connect,
      disconnect,
    }
  },
}))

vi.mock('../lib/hooks/use-terminal-instance', () => ({
  useTerminalInstance: (
    _options: unknown,
    refs: {
      terminalRef: { current: typeof fakeTerminal | null }
      fitAddonRef: { current: typeof fakeFitAddon | null }
    },
  ) => {
    refs.terminalRef.current = fakeTerminal
    refs.fitAddonRef.current = fakeFitAddon
  },
}))

vi.mock('../lib/hooks/use-terminal-resize', () => ({
  useTerminalResize: vi.fn(),
}))

vi.mock('../lib/hooks/use-terminal-scrolling', () => ({
  useTerminalScrolling: () => ({
    setupScrolling: () => ({
      wheelCleanup: vi.fn(),
      touchCleanup: vi.fn(),
    }),
  }),
}))

vi.mock('../lib/utils/device', () => ({
  isMobileDevice: () => false,
}))

describe('TerminalComponent', () => {
  afterEach(() => {
    websocketState.options = null
    websocketState.connect = null
    websocketState.disconnect = null
    websocketState.connectCalls = 0
    websocketState.disconnectCalls = 0
    operationCallbacks.length = 0
    fakeFitAddon.proposeDimensions.mockClear()
    fakeTerminal.reset.mockClear()
    fakeTerminal.scrollToLine.mockClear()
    fakeTerminal.write.mockClear()
    fakeTerminal.buffer.active.baseY = 100
    fakeTerminal.buffer.active.viewportY = 100
    fakeTerminal.buffer.active.cursorY = 0
    fakeTerminal.buffer.active.getLine.mockReturnValue({
      translateToString: () => 'kasadis@host:~$ ',
    })
  })

  it('serializes live output before applying scrollback snapshots', async () => {
    render(<TerminalComponent sessionId="session-1" />)

    websocketState.options?.onMessage?.('live output')
    websocketState.options?.onScrollbackSync?.('snapshot output')
    await Promise.resolve()

    expect(fakeTerminal.write).toHaveBeenCalledTimes(1)
    expect(fakeTerminal.write).toHaveBeenNthCalledWith(
      1,
      'live output',
      expect.any(Function),
    )
    expect(fakeTerminal.reset).not.toHaveBeenCalled()

    operationCallbacks.shift()?.()
    await waitFor(() => {
      expect(fakeTerminal.reset).toHaveBeenCalledTimes(1)
    })
    expect(fakeTerminal.write).toHaveBeenCalledTimes(2)
    expect(fakeTerminal.write).toHaveBeenNthCalledWith(
      2,
      'snapshot output',
      expect.any(Function),
    )
  })

  it('skips snapshot replacement when it would erase locally typed prompt input', async () => {
    fakeTerminal.buffer.active.getLine.mockReturnValue({
      translateToString: (): string => 'kasadis@host:~$ ec',
    })

    render(<TerminalComponent sessionId="session-2" />)

    websocketState.options?.onScrollbackSync?.('kasadis@host:~$ ')
    await Promise.resolve()

    expect(fakeTerminal.reset).not.toHaveBeenCalled()
    expect(fakeTerminal.write).not.toHaveBeenCalled()
  })

  it('disconnects hidden terminals and reconnects them when visible again', () => {
    const { rerender } = render(
      <TerminalComponent sessionId="session-3" isVisible={false} />,
    )

    expect(websocketState.connectCalls).toBe(0)
    expect(websocketState.disconnectCalls).toBeGreaterThanOrEqual(1)

    rerender(<TerminalComponent sessionId="session-3" isVisible />)

    expect(websocketState.connectCalls).toBeGreaterThanOrEqual(1)
  })
})
