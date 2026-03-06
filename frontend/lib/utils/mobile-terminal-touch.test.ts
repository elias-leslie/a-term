import { describe, expect, it } from 'vitest'
import {
  applyMobileTerminalTouchStyles,
  getMobileTerminalTouchStyles,
  MOBILE_TERMINAL_VIEWPORT_CLASS,
} from './mobile-terminal-touch'

describe('getMobileTerminalTouchStyles', () => {
  it('preserves vertical touch scrolling while blocking viewport overscroll', () => {
    expect(getMobileTerminalTouchStyles()).toEqual({
      overscrollBehavior: 'none',
      touchAction: 'pan-y',
    })
  })

  it('applies touch-safe scrolling styles to the xterm touch surfaces', () => {
    const container = document.createElement('div')
    const screen = document.createElement('div')
    const scrollableElement = document.createElement('div')

    screen.className = 'xterm-screen'
    scrollableElement.className = 'xterm-scrollable-element'
    container.append(screen, scrollableElement)

    applyMobileTerminalTouchStyles(container)

    expect(container.style.overscrollBehavior).toBe('none')
    expect(container.style.touchAction).toBe('pan-y')
    expect(screen.style.overscrollBehavior).toBe('none')
    expect(screen.style.touchAction).toBe('pan-y')
    expect(scrollableElement.style.overscrollBehavior).toBe('none')
    expect(scrollableElement.style.touchAction).toBe('pan-y')
    expect(
      scrollableElement.style.getPropertyValue('-webkit-overflow-scrolling'),
    ).toBe('touch')
    expect(
      scrollableElement.classList.contains(MOBILE_TERMINAL_VIEWPORT_CLASS),
    ).toBe(true)
  })
})
