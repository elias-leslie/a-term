import { useEffect, useRef } from 'react'
import type { Terminal } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { setupTerminalMouseHandling } from './use-terminal-mouse-handling'
import { isMobileDevice } from '../utils/device'

// Dynamic imports for xterm (client-side only)
let TerminalClass: typeof import('@xterm/xterm').Terminal
let FitAddonClass: typeof import('@xterm/addon-fit').FitAddon
let WebLinksAddon: typeof import('@xterm/addon-web-links').WebLinksAddon
let ClipboardAddon: typeof import('@xterm/addon-clipboard').ClipboardAddon

export interface TerminalInstanceOptions {
  cursorBlink: boolean
  cursorStyle: 'block' | 'underline' | 'bar'
  fontSize: number
  fontFamily: string
  scrollback: number
  theme: {
    background: string
    foreground: string
    cursor: string
    cursorAccent: string
    selectionBackground: string
    selectionForeground?: string
    black: string
    red: string
    green: string
    yellow: string
    blue: string
    magenta: string
    cyan: string
    white: string
    brightBlack: string
    brightRed: string
    brightGreen: string
    brightYellow: string
    brightBlue: string
    brightMagenta: string
    brightCyan: string
    brightWhite: string
  }
  onData: (data: string) => void
  setupScrolling: (container: HTMLElement) => {
    wheelCleanup: () => void
    touchCleanup: () => void
  }
}

export interface TerminalInstanceRefs {
  terminalRef: React.MutableRefObject<InstanceType<typeof Terminal> | null>
  fitAddonRef: React.MutableRefObject<InstanceType<typeof FitAddon> | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  isFocusedRef: React.MutableRefObject<boolean>
}

/**
 * Hook to manage xterm.js terminal instance initialization and lifecycle.
 * Handles terminal creation, addon loading, and cleanup.
 */
export function useTerminalInstance(
  options: TerminalInstanceOptions,
  refs: TerminalInstanceRefs,
) {
  const { terminalRef, fitAddonRef, containerRef, isFocusedRef } = refs
  const onDataDisposableRef = useRef<{ dispose: () => void } | null>(null)
  const mouseCleanupRef = useRef<(() => void) | null>(null)
  const scrollCleanupRef = useRef<{
    wheelCleanup: () => void
    touchCleanup: () => void
  } | null>(null)
  const focusCleanupRef = useRef<(() => void) | null>(null)
  const scrollbarCleanupRef = useRef<(() => void) | null>(null)

  // Store setup function in ref to avoid re-init on changes
  const setupScrollingRef = useRef(options.setupScrolling)
  useEffect(() => {
    setupScrollingRef.current = options.setupScrolling
  }, [options.setupScrolling])

  // Initialize terminal
  useEffect(() => {
    let mounted = true

    async function initTerminal() {
      if (!containerRef.current) return

      // Dynamic import xterm modules
      const xtermModule = await import('@xterm/xterm')
      if (!mounted) return

      const fitModule = await import('@xterm/addon-fit')
      if (!mounted) return

      const webLinksModule = await import('@xterm/addon-web-links')
      if (!mounted) return

      const clipboardModule = await import('@xterm/addon-clipboard')
      if (!mounted) return

      TerminalClass = xtermModule.Terminal
      FitAddonClass = fitModule.FitAddon
      WebLinksAddon = webLinksModule.WebLinksAddon
      ClipboardAddon = clipboardModule.ClipboardAddon

      // Create terminal with configured theme and settings
      const term = new TerminalClass({
        cursorBlink: options.cursorBlink,
        cursorStyle: options.cursorStyle,
        fontSize: options.fontSize,
        fontFamily: options.fontFamily,
        scrollback: options.scrollback,
        allowProposedApi: true,
        rightClickSelectsWord: true,
        macOptionClickForcesSelection: true,
        altClickMovesCursor: false,
        theme: options.theme,
        // smoothScrollDuration disabled: animated scrolling (80ms) conflicts with
        // the scroll-position-preservation in onMessage. Data arrives every ~16ms,
        // write() auto-scrolls to bottom (instant), then scrollLines() animates back
        // up (80ms). Before that animation finishes, next batch arrives → oscillation.
        // Instant scrolling eliminates this fight entirely.
      })

      if (!mounted) return

      // Create and load addons
      const fitAddon = new FitAddonClass()
      const webLinksAddon = new WebLinksAddon()
      const clipboardAddon = new ClipboardAddon()

      term.loadAddon(fitAddon)
      term.loadAddon(webLinksAddon)
      term.loadAddon(clipboardAddon)

      if (!mounted || !containerRef.current) return

      // Open terminal in container
      term.open(containerRef.current)
      if (!mounted) return

      // Set up mouse handling to enable local selection when mouse reporting is active
      mouseCleanupRef.current = setupTerminalMouseHandling(
        term,
        containerRef.current,
      )

      terminalRef.current = term
      fitAddonRef.current = fitAddon

      // Set up scrolling via hook (handles wheel and touch events for tmux copy-mode)
      scrollCleanupRef.current = setupScrollingRef.current(
        containerRef.current,
      )

      // Auto-hiding scrollbar: toggle .scrolling class on scroll events
      const viewport =
        containerRef.current.querySelector<HTMLElement>('.xterm-viewport')
      let scrollTimer: ReturnType<typeof setTimeout> | null = null
      if (viewport) {
        const onScroll = () => {
          viewport.classList.add('scrolling')
          if (scrollTimer) clearTimeout(scrollTimer)
          scrollTimer = setTimeout(() => {
            viewport.classList.remove('scrolling')
          }, 1500)
        }
        viewport.addEventListener('scroll', onScroll, { passive: true })
        scrollbarCleanupRef.current = () => {
          viewport.removeEventListener('scroll', onScroll)
          if (scrollTimer) clearTimeout(scrollTimer)
          viewport.classList.remove('scrolling')
        }
      }

      // Mobile-specific setup: suppress native keyboard (we use custom keyboard)
      if (isMobileDevice()) {
        const textarea =
          containerRef.current.querySelector<HTMLTextAreaElement>(
            '.xterm-helper-textarea',
          )
        if (textarea) {
          textarea.inputMode = 'none'
          textarea.readOnly = true
        }

        // Prevent pull-to-refresh via CSS
        containerRef.current.style.overscrollBehavior = 'none'
        containerRef.current.style.touchAction = 'none'
      }

      // Initial fit (ResizeObserver handles subsequent resizes)
      fitAddon.fit()

      // Track focus state to prevent input duplication across multiple terminals
      const textarea = term.textarea
      if (textarea) {
        const handleFocus = () => {
          isFocusedRef.current = true
        }
        const handleBlur = () => {
          isFocusedRef.current = false
        }
        textarea.addEventListener('focus', handleFocus)
        textarea.addEventListener('blur', handleBlur)
        focusCleanupRef.current = () => {
          textarea.removeEventListener('focus', handleFocus)
          textarea.removeEventListener('blur', handleBlur)
        }
      }

      // Set up terminal input handler - forward via callback
      onDataDisposableRef.current = term.onData(options.onData)
    }

    initTerminal()

    return () => {
      mounted = false
      // Dispose onData listener before terminal
      if (onDataDisposableRef.current) {
        onDataDisposableRef.current.dispose()
        onDataDisposableRef.current = null
      }
      // Clean up focus listeners
      if (focusCleanupRef.current) {
        focusCleanupRef.current()
        focusCleanupRef.current = null
      }
      // Clean up mouse listeners
      if (mouseCleanupRef.current) {
        mouseCleanupRef.current()
        mouseCleanupRef.current = null
      }
      // Clean up scrollbar fade listeners
      if (scrollbarCleanupRef.current) {
        scrollbarCleanupRef.current()
        scrollbarCleanupRef.current = null
      }
      // Clean up scroll listeners
      if (scrollCleanupRef.current) {
        scrollCleanupRef.current.wheelCleanup()
        scrollCleanupRef.current.touchCleanup()
        scrollCleanupRef.current = null
      }
      if (terminalRef.current) {
        terminalRef.current.dispose()
        terminalRef.current = null
      }
    }
  }, [
    options.cursorBlink,
    options.cursorStyle,
    options.fontFamily,
    options.fontSize,
    options.scrollback,
    options.theme,
    options.onData,
    containerRef,
    terminalRef,
    fitAddonRef,
    isFocusedRef,
  ])

  // Update terminal settings when they change
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.fontFamily = options.fontFamily
      terminalRef.current.options.fontSize = options.fontSize
      terminalRef.current.options.scrollback = options.scrollback
      terminalRef.current.options.cursorStyle = options.cursorStyle
      terminalRef.current.options.cursorBlink = options.cursorBlink
      terminalRef.current.options.theme = options.theme
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }
  }, [
    options.fontFamily,
    options.fontSize,
    options.scrollback,
    options.cursorStyle,
    options.cursorBlink,
    options.theme,
    terminalRef,
    fitAddonRef,
  ])
}
