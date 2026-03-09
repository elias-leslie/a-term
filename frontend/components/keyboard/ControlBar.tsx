'use client'

import { ChevronDown, ChevronUp, Mic } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ConnectionStatus } from '@/components/terminal.types'
import {
  type ClaudeModelOption,
  getClaudeModelOptions,
} from '@/lib/utils/agent-hub-models'
import {
  getMobileTerminalBannerState,
  isReconnectableStatus,
} from '@/lib/utils/mobile-terminal-status'
import { KeyboardKey } from './KeyboardKey'
import { KEY_SEQUENCES } from './keyMappings'
import { ModelPicker } from './ModelPicker'
import { useModifiers } from './ModifierContext'
import { StatusBanner } from './StatusBanner'
import type { TerminalInputHandler } from './types'

const BTN_STYLE = {
  backgroundColor: 'var(--term-bg-elevated)',
  color: 'var(--term-text-muted)',
  border: '1px solid var(--term-border)',
}

function activeToggleStyle(active: boolean) {
  return {
    backgroundColor: active ? 'var(--term-accent)' : 'var(--term-bg-elevated)',
    color: active ? 'var(--term-bg-deep)' : 'var(--term-text-muted)',
    border: `1px solid ${active ? 'var(--term-accent)' : 'var(--term-border)'}`,
    boxShadow: active ? '0 0 8px var(--term-accent-glow)' : 'none',
  }
}

const ARROW_KEYS = [
  { label: '←', seq: KEY_SEQUENCES.ARROW_LEFT },
  { label: '↑', seq: KEY_SEQUENCES.ARROW_UP },
  { label: '↓', seq: KEY_SEQUENCES.ARROW_DOWN },
  { label: '→', seq: KEY_SEQUENCES.ARROW_RIGHT },
] as const

interface ControlBarProps {
  onSend: TerminalInputHandler
  ctrlActive?: boolean
  onCtrlToggle?: () => void
  minimized?: boolean
  onToggleMinimize?: () => void
  onVoice?: () => void
  voiceActive?: boolean
  activeMode?: string
  connectionStatus?: ConnectionStatus
  onReconnect?: () => void
}

export function ControlBar({
  onSend,
  ctrlActive = false,
  onCtrlToggle,
  minimized = false,
  onToggleMinimize,
  onVoice,
  voiceActive = false,
  activeMode,
  connectionStatus,
  onReconnect,
}: ControlBarProps) {
  const { resetModifiers } = useModifiers()
  const [modelOptions, setModelOptions] = useState<ClaudeModelOption[]>([])

  useEffect(() => {
    let mounted = true
    void getClaudeModelOptions().then((options) => {
      if (mounted) setModelOptions(options)
    })
    return () => {
      mounted = false
    }
  }, [])

  const clearModifiers = useCallback(() => {
    if (ctrlActive && onCtrlToggle) onCtrlToggle()
    resetModifiers()
  }, [ctrlActive, onCtrlToggle, resetModifiers])

  const handleEsc = useCallback(() => {
    onSend(KEY_SEQUENCES.ESC)
    clearModifiers()
  }, [onSend, clearModifiers])
  const handleShiftTab = useCallback(() => {
    onSend('\x1b[Z')
    clearModifiers()
  }, [onSend, clearModifiers])
  const handleModelSelect = useCallback(
    (command: string) => {
      navigator.vibrate?.(10)
      onSend(command)
    },
    [onSend],
  )
  const handleVoice = useCallback(() => {
    navigator.vibrate?.(10)
    onVoice?.()
  }, [onVoice])

  const MinimizeIcon = minimized ? ChevronUp : ChevronDown
  const isAgentMode = activeMode !== undefined && activeMode !== 'shell'
  const bannerState = getMobileTerminalBannerState({
    connectionStatus,
    activeMode,
    voiceActive,
    minimized,
    canReconnect:
      isReconnectableStatus(connectionStatus) && onReconnect !== undefined,
  })

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
        {onToggleMinimize && (
          <button
            type="button"
            onClick={onToggleMinimize}
            className="flex items-center justify-center h-11 w-11 rounded-md transition-all duration-150"
            style={activeToggleStyle(minimized)}
            title={minimized ? 'Show keyboard' : 'Hide keyboard'}
          >
            <MinimizeIcon className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={handleShiftTab}
          className="h-11 px-3 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
          style={BTN_STYLE}
          title="Shift+Tab (backtab)"
        >
          ⇧TAB
        </button>
        <div className="flex-1" />
        {isAgentMode && (
          <ModelPicker
            modelOptions={modelOptions}
            onModelSelect={handleModelSelect}
          />
        )}
        {onVoice && (
          <button
            type="button"
            onClick={handleVoice}
            className="flex items-center justify-center h-11 w-11 rounded-md transition-all duration-150 active:scale-95"
            style={BTN_STYLE}
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
        <div className="flex items-center gap-4">
          {ARROW_KEYS.map(({ label, seq }) => (
            <KeyboardKey
              key={label}
              label={label}
              onPress={() => onSend(seq)}
              className="w-14 h-14 text-xl"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onCtrlToggle}
          className="w-10 h-10 rounded-md text-[10px] font-medium transition-all duration-150 active:scale-95"
          style={activeToggleStyle(ctrlActive)}
        >
          CTRL
        </button>
      </div>

      <StatusBanner bannerState={bannerState} onReconnect={onReconnect} />
    </div>
  )
}
