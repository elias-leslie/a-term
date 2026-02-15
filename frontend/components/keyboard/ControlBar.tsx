'use client'

import { ChevronDown, ChevronUp, Mic } from 'lucide-react'
import { useCallback } from 'react'
import { KeyboardKey } from './KeyboardKey'
import { KEY_SEQUENCES } from './keyMappings'
import { useModifiers } from './ModifierContext'
import type { TerminalInputHandler } from './types'

interface ControlBarProps {
  onSend: TerminalInputHandler
  // Modifiers
  ctrlActive?: boolean
  onCtrlToggle?: () => void
  // Keyboard minimize
  minimized?: boolean
  onToggleMinimize?: () => void
  // Voice input
  onVoice?: () => void
}

export function ControlBar({
  onSend,
  ctrlActive = false,
  onCtrlToggle,
  minimized = false,
  onToggleMinimize,
  onVoice,
}: ControlBarProps) {
  // Get shift state from shared modifier context
  const { modifiers, resetModifiers } = useModifiers()
  const shiftActive = modifiers.shift !== 'off'

  // Helper to clear modifiers after use
  const clearModifiers = useCallback(() => {
    if (ctrlActive && onCtrlToggle) onCtrlToggle()
    resetModifiers() // Clear sticky shift from context
  }, [ctrlActive, onCtrlToggle, resetModifiers])

  // Arrow key handlers - don't clear modifiers for arrows
  const handleArrowLeft = useCallback(
    () => onSend(KEY_SEQUENCES.ARROW_LEFT),
    [onSend],
  )
  const handleArrowUp = useCallback(
    () => onSend(KEY_SEQUENCES.ARROW_UP),
    [onSend],
  )
  const handleArrowDown = useCallback(
    () => onSend(KEY_SEQUENCES.ARROW_DOWN),
    [onSend],
  )
  const handleArrowRight = useCallback(
    () => onSend(KEY_SEQUENCES.ARROW_RIGHT),
    [onSend],
  )

  // Special key handlers
  const handleEsc = useCallback(() => {
    onSend(KEY_SEQUENCES.ESC)
    clearModifiers()
  }, [onSend, clearModifiers])

  const handleTab = useCallback(() => {
    if (shiftActive) {
      // Shift+Tab (backtab) - reverse tab completion
      onSend('\x1b[Z')
    } else {
      onSend(KEY_SEQUENCES.TAB)
    }
    clearModifiers()
  }, [shiftActive, onSend, clearModifiers])

  const btnStyle = {
    backgroundColor: 'var(--term-bg-elevated)',
    color: 'var(--term-text-muted)',
    border: '1px solid var(--term-border)',
  }

  return (
    <div
      className="flex flex-col gap-1 px-1.5 py-1"
      style={{
        backgroundColor: 'var(--term-bg-surface)',
        borderTop: '1px solid var(--term-border)',
      }}
    >
      {/* Row 1: Arrows (left) — Mic (center) — Keyboard toggle (right) */}
      <div className="flex items-center gap-1">
        {/* Arrow keys */}
        <div className="flex items-center gap-0.5">
          <KeyboardKey
            label="←"
            onPress={handleArrowLeft}
            className="w-11 h-11 text-lg"
          />
          <KeyboardKey
            label="↑"
            onPress={handleArrowUp}
            className="w-11 h-11 text-lg"
          />
          <KeyboardKey
            label="↓"
            onPress={handleArrowDown}
            className="w-11 h-11 text-lg"
          />
          <KeyboardKey
            label="→"
            onPress={handleArrowRight}
            className="w-11 h-11 text-lg"
          />
        </div>

        {/* Spacer to push mic to center */}
        <div className="flex-1" />

        {/* Mic button — centered, prominent */}
        {onVoice && (
          <button
            type="button"
            onClick={() => {
              navigator.vibrate?.(10)
              onVoice()
            }}
            className="flex items-center justify-center h-11 w-11 rounded-md transition-all duration-150 active:scale-95"
            style={btnStyle}
            title="Voice input"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {/* Spacer to push toggle to right */}
        <div className="flex-1" />

        {/* Keyboard toggle */}
        {onToggleMinimize && (
          <button
            type="button"
            onClick={onToggleMinimize}
            className="flex items-center justify-center h-11 w-11 rounded-md transition-all duration-150"
            style={{
              backgroundColor: minimized
                ? 'var(--term-accent)'
                : 'var(--term-bg-elevated)',
              color: minimized ? 'var(--term-bg-deep)' : 'var(--term-text-muted)',
              border: `1px solid ${minimized ? 'var(--term-accent)' : 'var(--term-border)'}`,
              boxShadow: minimized ? '0 0 8px var(--term-accent-glow)' : 'none',
            }}
            title={minimized ? 'Show keyboard' : 'Hide keyboard'}
          >
            {minimized ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Row 2: ESC — ^C — TAB — CTRL (stretched evenly) */}
      <div className="flex items-center gap-1">
        <KeyboardKey
          label="ESC"
          onPress={handleEsc}
          className="flex-1 h-11 text-xs"
        />
        <button
          type="button"
          onClick={() => onSend('\x03')}
          className="flex-1 h-11 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
          style={btnStyle}
          title="Interrupt (Ctrl+C)"
        >
          ^C
        </button>
        <KeyboardKey
          label="TAB"
          onPress={handleTab}
          className="flex-1 h-11 text-xs"
        />
        <button
          type="button"
          onClick={onCtrlToggle}
          className="flex-1 h-11 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: ctrlActive
              ? 'var(--term-accent)'
              : 'var(--term-bg-elevated)',
            color: ctrlActive
              ? 'var(--term-bg-deep)'
              : 'var(--term-text-muted)',
            border: `1px solid ${ctrlActive ? 'var(--term-accent)' : 'var(--term-border)'}`,
            boxShadow: ctrlActive ? '0 0 8px var(--term-accent-glow)' : 'none',
          }}
        >
          CTRL
        </button>
      </div>
    </div>
  )
}
