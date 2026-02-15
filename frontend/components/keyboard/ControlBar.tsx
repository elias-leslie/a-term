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
  const { resetModifiers } = useModifiers()

  // Helper to clear modifiers after use
  const clearModifiers = useCallback(() => {
    if (ctrlActive && onCtrlToggle) onCtrlToggle()
    resetModifiers()
  }, [ctrlActive, onCtrlToggle, resetModifiers])

  // Arrow key handlers
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

  const handleShiftTab = useCallback(() => {
    onSend('\x1b[Z') // Shift+Tab (backtab)
    clearModifiers()
  }, [onSend, clearModifiers])

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
      {/* Row 1: [▲/▼] [⇧TAB]  ·····  [MIC] */}
      <div className="flex items-center gap-1.5">
        {/* Keyboard toggle — far left */}
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

        {/* Shift+Tab */}
        <button
          type="button"
          onClick={handleShiftTab}
          className="h-11 px-3 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
          style={btnStyle}
          title="Shift+Tab (backtab)"
        >
          ⇧TAB
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mic button — far right */}
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
      </div>

      {/* Row 2: [ESC]  ·  [← ↑ ↓ →]  ·  [CTRL] */}
      <div className="flex items-center justify-center gap-3">
        <KeyboardKey
          label="ESC"
          onPress={handleEsc}
          className="w-14 h-11 text-xs"
        />

        {/* Arrow keys with generous spacing */}
        <div className="flex items-center gap-2">
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

        <button
          type="button"
          onClick={onCtrlToggle}
          className="w-14 h-11 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
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
