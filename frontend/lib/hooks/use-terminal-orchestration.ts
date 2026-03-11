import { useCallback, useState } from 'react'
import { useTranscription } from '@agent-hub/passport-client'
import { useLayoutPersistence } from './use-layout-persistence'
import { usePromptCleaner } from './use-prompt-cleaner'
import { useTerminalActionHandlers } from './use-terminal-action-handlers'
import { useTerminalModals } from './use-terminal-modals'
import { useTerminalNavigation } from './use-terminal-navigation'
import { useTerminalSlotHandlers } from './use-terminal-slot-handlers'
import { useTerminalTabsState } from './use-terminal-tabs-state'
import { useTerminalKeyboardShortcuts } from '@/components/KeyboardShortcuts'

function getVoiceWsUrl(): string {
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // Agent Hub voice WebSocket on same host, port 8003
  const host = window.location.hostname
  const isProduction = host.includes('summitflow.dev')
  if (isProduction) {
    return `wss://agent.summitflow.dev/api/voice/ws?user_id=terminal&app=terminal`
  }
  return `${protocol}//${host}:8003/api/voice/ws?user_id=terminal&app=terminal`
}

interface UseTerminalOrchestrationProps {
  projectId?: string
  projectPath?: string
}

/**
 * Orchestrates all terminal state, handlers, and modals
 * This is the central hook that coordinates everything for TerminalTabs
 */
export function useTerminalOrchestration({
  projectId,
  projectPath,
}: UseTerminalOrchestrationProps) {
  // Core terminal state
  const terminalState = useTerminalTabsState({ projectId, projectPath })

  const {
    activeSessionId,
    switchToSession,
    sessions,
    terminalSlots,
    orderedIds,
    terminalRefs,
    dismissExternalSession,
    resetProject,
    reset,
    disableProject,
    remove,
    removePane,
    handleNewTerminalForProject,
    handleProjectModeChange,
    showTerminalManager,
    setShowTerminalManager,
    saveLayouts,
  } = terminalState

  // Prompt cleaner state
  const [showCleaner, setShowCleaner] = useState(false)
  const [cleanerRawPrompt, setCleanerRawPrompt] = useState('')
  const [keyboardHelpState, setKeyboardHelpState] = useState(false)

  // Voice input state
  const [showVoice, setShowVoice] = useState(false)
  const transcription = useTranscription({
    whisperWsUrl: getVoiceWsUrl(),
  })

  // Modal management
  const modalHandlers = useTerminalModals({
    showTerminalManager,
    setShowTerminalManager,
    showKeyboardHelp: keyboardHelpState,
    setShowKeyboardHelp: setKeyboardHelpState,
  })

  // Slot handlers
  const slotHandlers = useTerminalSlotHandlers({
    terminalRefs,
    switchToSession,
    dismissExternalSession,
    resetProject,
    reset,
    disableProject,
    remove,
    removePane,
    handleNewTerminalForProject,
    setShowCleaner,
    setCleanerRawPrompt,
    sessions,
    handleProjectModeChange,
  })

  // Layout persistence
  const { handleLayoutChange } = useLayoutPersistence({
    saveLayouts,
    debounceMs: 500,
    maxRetries: 3,
  })

  // Terminal navigation
  const navigationHandlers = useTerminalNavigation({
    terminalSlots,
    orderedIds,
    activeSessionId,
    onSlotSwitch: slotHandlers.handleSlotSwitch,
    onSlotClose: slotHandlers.handleSlotClose,
  })

  // File upload, prompt cleaner, and voice input
  const {
    cleanPrompt,
    error: cleanerError,
    clearError: clearCleanerError,
    isLoading: isCleaningPrompt,
  } = usePromptCleaner()
  const actionHandlers = useTerminalActionHandlers({
    terminalRefs,
    activeSessionId,
    showCleaner,
    setShowCleaner,
    setCleanerRawPrompt,
    setShowVoice,
    voiceStartListening: transcription.startListening,
    voiceStopListening: transcription.stopListening,
    voiceResetTranscript: transcription.resetTranscript,
    voiceStatus: transcription.status,
  })

  // Pause key: first press opens voice, second press sends transcript
  const handlePauseVoiceSend = useCallback(() => {
    const text = transcription.finalTranscript.trim()
    if (text) {
      actionHandlers.handleVoiceSend(text)
    } else {
      actionHandlers.handleVoiceCancel()
    }
  }, [transcription.finalTranscript, actionHandlers])

  // Keyboard shortcuts (after actionHandlers so voice toggle is available)
  const keyboardShortcuts = useTerminalKeyboardShortcuts({
    onNewTerminal: modalHandlers.handleOpenTerminalManager,
    onCloseTab: navigationHandlers.handleCloseActive,
    onNextTerminal: navigationHandlers.handleNextTerminal,
    onPrevTerminal: navigationHandlers.handlePrevTerminal,
    onJumpToTerminal: navigationHandlers.handleJumpToTerminal,
    onVoiceToggle: showVoice
      ? handlePauseVoiceSend
      : actionHandlers.handleVoiceOpen,
  })

  return {
    // Core state
    ...terminalState,

    // Modal handlers
    ...modalHandlers,

    // Slot handlers
    ...slotHandlers,

    // Navigation handlers
    ...navigationHandlers,

    // Layout handlers
    handleLayoutChange,

    // Keyboard shortcuts
    showKeyboardHelp: keyboardShortcuts.showHelp,
    setShowKeyboardHelp: keyboardShortcuts.setShowHelp,

    // Action handlers
    ...actionHandlers,
    cleanPrompt,
    cleanerError,
    clearCleanerError,
    isCleaningPrompt,

    // Prompt cleaner state
    showCleaner,
    cleanerRawPrompt,

    // Voice input state
    showVoice,
    voiceFinalTranscript: transcription.finalTranscript,
    voiceInterimTranscript: transcription.interimTranscript,
    voiceStatus: transcription.status,
    voiceError: transcription.error,
    isVoiceSupported: transcription.isSupported,
  }
}
