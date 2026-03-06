import { describe, expect, it, vi } from 'vitest'
import {
  getTouchScrollLineDelta,
  initializeTouchTracking,
  refreshTerminalViewport,
} from './use-terminal-scrolling'

describe('getTouchScrollLineDelta', () => {
  it('uses natural touch direction when the finger moves upward', () => {
    expect(getTouchScrollLineDelta(36, 18)).toBe(4)
  })

  it('uses natural touch direction when the finger moves downward', () => {
    expect(getTouchScrollLineDelta(-27, 18)).toBe(-3)
  })

  it('returns zero when there is not enough information to compute a scroll', () => {
    expect(getTouchScrollLineDelta(0, 18)).toBe(0)
    expect(getTouchScrollLineDelta(20, 0)).toBe(0)
  })
})

describe('refreshTerminalViewport', () => {
  it('prefers the xterm render service when available', () => {
    const refreshRows = vi.fn()
    const refresh = vi.fn()

    refreshTerminalViewport({
      _core: {
        _renderService: {
          refreshRows,
        },
      },
      rows: 18,
      refresh,
    } as unknown as Parameters<typeof refreshTerminalViewport>[0])

    expect(refreshRows).toHaveBeenCalledWith(0, 17)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('falls back to the public refresh API when needed', () => {
    const refresh = vi.fn()

    refreshTerminalViewport({
      rows: 18,
      refresh,
    } as unknown as Parameters<typeof refreshTerminalViewport>[0])

    expect(refresh).toHaveBeenCalledWith(0, 17)
  })
})

describe('initializeTouchTracking', () => {
  it('boots touch tracking from the first observed move position', () => {
    expect(initializeTouchTracking(144)).toEqual({
      touchStartY: 144,
      lastSentY: 144,
    })
  })
})
