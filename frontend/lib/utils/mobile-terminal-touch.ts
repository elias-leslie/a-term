export interface MobileTerminalTouchStyles {
  overscrollBehavior: 'none'
  touchAction: 'pan-y'
}

export const MOBILE_TERMINAL_TOUCH_SURFACE_SELECTORS = [
  '.xterm-screen',
  '.xterm-scrollable-element',
] as const

export const MOBILE_TERMINAL_VIEWPORT_CLASS = 'mobile-terminal-viewport'

/**
 * Allow vertical touch panning inside the terminal while still blocking
 * viewport overscroll behaviors such as pull-to-refresh.
 */
export function getMobileTerminalTouchStyles(): MobileTerminalTouchStyles {
  return {
    overscrollBehavior: 'none',
    touchAction: 'pan-y',
  }
}

/**
 * Apply touch-safe scrolling styles to the terminal container and the xterm
 * surfaces that actually receive drag gestures on mobile browsers.
 */
export function applyMobileTerminalTouchStyles(container: HTMLElement): void {
  const touchStyles = getMobileTerminalTouchStyles()

  container.style.overscrollBehavior = touchStyles.overscrollBehavior
  container.style.touchAction = touchStyles.touchAction

  for (const selector of MOBILE_TERMINAL_TOUCH_SURFACE_SELECTORS) {
    const element = container.querySelector<HTMLElement>(selector)
    if (!element) continue

    element.style.overscrollBehavior = touchStyles.overscrollBehavior
    element.style.touchAction = touchStyles.touchAction

    if (selector === '.xterm-scrollable-element') {
      element.classList.add(MOBILE_TERMINAL_VIEWPORT_CLASS)
      element.style.setProperty('-webkit-overflow-scrolling', 'touch')
    }
  }
}
