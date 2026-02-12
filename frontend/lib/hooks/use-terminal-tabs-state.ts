'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LayoutMode } from '@/components/LayoutModeButton'
import type { KeyboardSizePreset } from '@/components/SettingsDropdown'
import type { ConnectionStatus, TerminalHandle } from '@/components/Terminal'
import { useActiveSession } from '@/lib/hooks/use-active-session'
import { useAutoCreatePane } from '@/lib/hooks/use-auto-create-pane'
import { useAvailableLayouts } from '@/lib/hooks/use-available-layouts'
import { useLocalStorageState } from '@/lib/hooks/use-local-storage-state'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useTabEditing } from '@/lib/hooks/use-tab-editing'
import { useTerminalHandlers } from '@/lib/hooks/use-terminal-handlers'
import { useTerminalPanes } from '@/lib/hooks/use-terminal-panes'
import { useTerminalSettings } from '@/lib/hooks/use-terminal-settings'
import { getSlotPanelId, type PaneSlot, panesToSlots } from '@/lib/utils/slot'

interface UseTerminalTabsStateProps {
  projectId?: string
  projectPath?: string
}

export function useTerminalTabsState({
  projectId,
  projectPath,
}: UseTerminalTabsStateProps) {
  // URL-based active session (single source of truth)
  const {
    activeSessionId,
    switchToSession,
    sessions,
    projectTerminals,
    adHocSessions,
    isLoading: activeSessionLoading,
  } = useActiveSession()

  // Pane-based data (new architecture: panes are the top-level container)
  const {
    panes,
    atLimit: panesAtLimit,
    isLoading: panesLoading,
    swapPanePositions,
    removePane,
    setActiveMode,
    createAdHocPane,
    createProjectPane,
    isCreating: isPaneCreating,
    saveLayouts,
  } = useTerminalPanes()

  // Layout state (single mode removed - always grid)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid-2x2')

  // Get the active session's project_id for per-project settings
  const activeSessionProjectId = useMemo(() => {
    if (!activeSessionId) return undefined
    const activeSession = sessions.find((s) => s.id === activeSessionId)
    return activeSession?.project_id ?? undefined
  }, [activeSessionId, sessions])

  const {
    fontId,
    fontSize,
    fontFamily,
    scrollback,
    cursorStyle,
    cursorBlink,
    themeId,
    theme,
    setFontId,
    setFontSize,
    setScrollback,
    setCursorStyle,
    setCursorBlink,
    setThemeId,
  } = useTerminalSettings(activeSessionProjectId)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showSettings, setShowSettings] = useState(false)
  const [keyboardSize, setKeyboardSize] =
    useLocalStorageState<KeyboardSizePreset>('terminal-keyboard-size', 'medium')
  const [showTerminalManager, setShowTerminalManager] = useState(false)

  // Terminal refs and connection status tracking
  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map())
  const [terminalStatuses, setTerminalStatuses] = useState<
    Map<string, ConnectionStatus>
  >(new Map())
  const projectTabRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Handlers hook (includes session/project mutations and all event handlers)
  const {
    handleKeyboardSizeChange,
    handleStatusChange,
    handleKeyboardInput,
    handleReconnect,
    handleLayoutModeChange,
    handleAddTab,
    handleNewTerminalForProject,
    handleProjectTabClick,
    handleProjectModeChange,
    handleCloseAll,
    setTerminalRef,
    // Passthrough from sub-hooks
    create: _create,
    update,
    remove,
    reset,
    resetAll,
    resetProject,
    disableProject,
    isCreating,
    sessionsLoading,
    projectsLoading,
  } = useTerminalHandlers({
    projectId,
    projectPath,
    sessions,
    adHocSessions,
    projectTerminals,
    activeSessionId,
    terminalRefs,
    projectTabRefs,
    setTerminalStatuses,
    setLayoutMode,
    setKeyboardSize,
    // Pane operations
    panes,
    panesAtLimit,
    createProjectPane,
    createAdHocPane,
    setActiveMode,
    removePane,
  })

  // Combined loading state
  const isLoading =
    activeSessionLoading || sessionsLoading || projectsLoading || panesLoading

  // Available layouts based on viewport width
  const availableLayouts = useAvailableLayouts()

  // Unified slots array derived from panes (new architecture)
  // Panes are already ordered by pane_order from the API
  const terminalSlots: PaneSlot[] = useMemo(() => {
    return panesToSlots(panes)
  }, [panes])

  // Derive ordered IDs from panes (already ordered by pane_order)
  const orderedIds = useMemo(() => {
    return terminalSlots.map((slot) => getSlotPanelId(slot))
  }, [terminalSlots])

  // Reorder callback (currently no-op, ordering is DB-driven)
  const reorder = useCallback((newOrder: string[]) => {
    // TODO: Implement bulk reorder via API if needed
    console.log('reorder requested:', newOrder)
  }, [])

  // Swap panes via DB-backed API
  const swapPanes = useCallback(
    async (slotIdA: string, slotIdB: string) => {
      // Find pane IDs from slot IDs
      const slotA = terminalSlots.find((s) => getSlotPanelId(s) === slotIdA)
      const slotB = terminalSlots.find((s) => getSlotPanelId(s) === slotIdB)

      if (!slotA || !slotB) {
        console.warn('swapPanes: slot not found', { slotIdA, slotIdB })
        return
      }

      await swapPanePositions(slotA.paneId, slotB.paneId)
    },
    [terminalSlots, swapPanePositions],
  )

  // Check if at maximum pane limit
  const canAddPane = useCallback(() => {
    return !panesAtLimit
  }, [panesAtLimit])

  // Helper to check if current layout is a grid mode
  const isGridMode = layoutMode.startsWith('grid-')

  // Get active terminal status
  const activeStatus = activeSessionId
    ? terminalStatuses.get(activeSessionId)
    : undefined
  const showReconnect =
    activeStatus && ['disconnected', 'error', 'timeout'].includes(activeStatus)

  // Auto-downgrade layout if current mode is no longer available
  useEffect(() => {
    if (!availableLayouts.includes(layoutMode)) {
      const highest = availableLayouts[availableLayouts.length - 1] || 'single'
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync layout to viewport constraints
      setLayoutMode(highest)
    }
  }, [availableLayouts, layoutMode])

  // Auto-create a default pane on initial load or when last pane is closed
  useAutoCreatePane({
    panes,
    isLoading,
    isPaneCreating,
    createAdHocPane,
    switchToSession,
  })

  // Tab editing hook
  const tabEditingProps = useTabEditing({
    onSave: async (sessionId: string, newName: string) => {
      await update(sessionId, { name: newName })
    },
  })

  return {
    // Session state
    activeSessionId,
    switchToSession,
    sessions,
    projectTerminals,
    adHocSessions,
    isLoading,
    isCreating,

    // Layout state
    layoutMode,
    setLayoutMode,
    availableLayouts,
    isGridMode,

    // Terminal slots (pane-based)
    terminalSlots,
    orderedIds,
    reorder,
    swapPanes,
    canAddPane,
    // Pane operations
    panes,
    panesAtLimit,
    removePane,
    setActiveMode,
    createAdHocPane,
    createProjectPane,
    isPaneCreating,
    saveLayouts,

    // Terminal refs and statuses
    terminalRefs,
    terminalStatuses,
    projectTabRefs,
    setTerminalRef,

    // Settings
    fontId,
    fontSize,
    fontFamily,
    scrollback,
    cursorStyle,
    cursorBlink,
    themeId,
    theme,
    setFontId,
    setFontSize,
    setScrollback,
    setCursorStyle,
    setCursorBlink,
    setThemeId,
    showSettings,
    setShowSettings,
    keyboardSize,
    handleKeyboardSizeChange,
    isMobile,

    // Terminal manager modal
    showTerminalManager,
    setShowTerminalManager,

    // Connection status
    activeStatus,
    showReconnect,

    // Tab editing
    ...tabEditingProps,

    // Handlers
    handleStatusChange,
    handleKeyboardInput,
    handleReconnect,
    handleLayoutModeChange,
    handleAddTab,
    handleNewTerminalForProject,
    handleProjectTabClick,
    handleProjectModeChange,
    handleCloseAll,

    // Project operations
    resetProject,
    disableProject,
    reset,
    resetAll,
    remove,
  }
}
