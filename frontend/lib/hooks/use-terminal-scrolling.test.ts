import { describe, expect, it, vi } from 'vitest'
import {
  getTouchScrollLineDelta,
  isTouchOnTerminalScrollbar,
  refreshTerminalViewport,
} from './use-terminal-scrolling'

describe('isTouchOnTerminalScrollbar', () => {
  const viewport = {
    getBoundingClientRect: () =>
      ({
        right: 300,
      }) as DOMRect,
  }

  it('treats touches near the right edge as scrollbar gestures', () => {
    expect(isTouchOnTerminalScrollbar(viewport, 290)).toBe(true)
    expect(isTouchOnTerminalScrollbar(viewport, 275)).toBe(true)
  })

  it('treats touches away from the gutter as direct content drags', () => {
    expect(isTouchOnTerminalScrollbar(viewport, 240)).toBe(false)
  })
})

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
  it('refreshes the full visible row range', () => {
    const refresh = vi.fn()

    refreshTerminalViewport({
      rows: 18,
      refresh,
    } as unknown as Parameters<typeof refreshTerminalViewport>[0])

    expect(refresh).toHaveBeenCalledWith(0, 17)
  })
})
