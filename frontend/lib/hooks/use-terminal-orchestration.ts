import { useState } from 'react'
import { useLayoutPersistence } from './use-layout-persistence'
import { usePromptCleaner } from './use-prompt-cleaner'
import { useTerminalActionHandlers } from './use-terminal-action-handlers'
import { useTerminalModals } from './use-terminal-modals'
import { useTerminalNavigation } from './use-terminal-navigation'
import { useTerminalSlotHandlers } from './use-terminal-slot-handlers'
import { useTerminalTabsState } from './use-terminal-tabs-state'
import { useTerminalKeyboardShortcuts } from '@/components/KeyboardShortcuts'

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

  // Keyboard shortcuts
  const keyboardShortcuts = useTerminalKeyboardShortcuts({
    onNewTerminal: modalHandlers.handleOpenTerminalManager,
    onCloseTab: navigationHandlers.handleCloseActive,
    onNextTerminal: navigationHandlers.handleNextTerminal,
    onPrevTerminal: navigationHandlers.handlePrevTerminal,
    onJumpToTerminal: navigationHandlers.handleJumpToTerminal,
  })

  // File upload and prompt cleaner
  const { cleanPrompt } = usePromptCleaner()
  const actionHandlers = useTerminalActionHandlers({
    terminalRefs,
    activeSessionId,
    showCleaner,
    setShowCleaner,
    setCleanerRawPrompt,
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

    // Prompt cleaner state
    showCleaner,
    cleanerRawPrompt,
  }
}
