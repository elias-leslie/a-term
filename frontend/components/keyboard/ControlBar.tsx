'use client'

import { ChevronDown, ChevronUp, Mic, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardKey } from './KeyboardKey'
import { KEY_SEQUENCES } from './keyMappings'
import { useModifiers } from './ModifierContext'
import type { TerminalInputHandler } from './types'

const MODEL_OPTIONS = [
  { id: 'opus', label: 'Opus', command: '/model opus\r' },
  { id: 'sonnet', label: 'Sonnet', command: '/model sonnet\r' },
  { id: 'haiku', label: 'Haiku', command: '/model haiku\r' },
] as const

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
  // Active pane mode (show model picker when agent mode)
  activeMode?: string
}

export function ControlBar({
  onSend,
  ctrlActive = false,
  onCtrlToggle,
  minimized = false,
  onToggleMinimize,
  onVoice,
  activeMode,
}: ControlBarProps) {
  const { resetModifiers } = useModifiers()
  const [showModelPicker, setShowModelPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker on outside tap
  useEffect(() => {
    if (!showModelPicker) return
    const handleTap = (e: MouseEvent | TouchEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handleTap)
    document.addEventListener('touchstart', handleTap)
    return () => {
      document.removeEventListener('mousedown', handleTap)
      document.removeEventListener('touchstart', handleTap)
    }
  }, [showModelPicker])

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

  const handleModelSelect = useCallback(
    (command: string) => {
      navigator.vibrate?.(10)
      onSend(command)
      setShowModelPicker(false)
    },
    [onSend],
  )

  const btnStyle = {
    backgroundColor: 'var(--term-bg-elevated)',
    color: 'var(--term-text-muted)',
    border: '1px solid var(--term-border)',
  }

  const isAgentMode = activeMode !== undefined && activeMode !== 'shell'

  return (
    <div
      className="flex flex-col gap-1 px-1.5 py-1"
      style={{
        backgroundColor: 'var(--term-bg-surface)',
        borderTop: '1px solid var(--term-border)',
      }}
    >
      {/* Row 1: [▲/▼] [⇧TAB]  ·····  [MODEL?] [MIC] */}
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

        {/* Model picker — only in claude mode */}
        {isAgentMode && (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setShowModelPicker((p) => !p)}
              className="flex items-center gap-1.5 h-11 px-3 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
              style={showModelPicker ? {
                backgroundColor: 'rgba(0, 255, 159, 0.15)',
                color: 'var(--term-accent)',
                border: '1px solid var(--term-accent)',
              } : btnStyle}
              title="Switch Claude model"
            >
              <Sparkles className="w-4 h-4" />
              MODEL
            </button>

            {/* Dropdown */}
            {showModelPicker && (
              <div
                className="absolute bottom-full mb-1 right-0 rounded-lg overflow-hidden"
                style={{
                  backgroundColor: 'var(--term-bg-elevated)',
                  border: '1px solid var(--term-border-active)',
                  boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.4)',
                  minWidth: 140,
                  zIndex: 50,
                }}
              >
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleModelSelect(opt.command)}
                    className="w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-100"
                    style={{
                      color: 'var(--term-text-primary)',
                      backgroundColor: 'transparent',
                      borderBottom: '1px solid var(--term-border)',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        'rgba(0, 255, 159, 0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
      <div className="flex items-center justify-center gap-4">
        <KeyboardKey
          label="ESC"
          onPress={handleEsc}
          className="w-10 h-10 text-[10px]"
        />

        {/* Arrow keys — large targets with wide spacing */}
        <div className="flex items-center gap-4">
          <KeyboardKey
            label="←"
            onPress={handleArrowLeft}
            className="w-14 h-14 text-xl"
          />
          <KeyboardKey
            label="↑"
            onPress={handleArrowUp}
            className="w-14 h-14 text-xl"
          />
          <KeyboardKey
            label="↓"
            onPress={handleArrowDown}
            className="w-14 h-14 text-xl"
          />
          <KeyboardKey
            label="→"
            onPress={handleArrowRight}
            className="w-14 h-14 text-xl"
          />
        </div>

        <button
          type="button"
          onClick={onCtrlToggle}
          className="w-10 h-10 rounded-md text-[10px] font-medium transition-all duration-150 active:scale-95"
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
