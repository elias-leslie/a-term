'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { KeyboardSizePreset } from '@/components/SettingsDropdown'
import type { ConnectionStatus, TerminalHandle } from '@/components/Terminal'
import { useActiveSession } from '@/lib/hooks/use-active-session'
import { useAutoCreatePane } from '@/lib/hooks/use-auto-create-pane'
import {
  useAvailableLayouts,
  usePaneCapacity,
} from '@/lib/hooks/use-available-layouts'
import {
  getDefaultLayoutMode,
  type LayoutMode,
} from '@/lib/constants/terminal'
import { useLocalStorageState } from '@/lib/hooks/use-local-storage-state'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useTabEditing } from '@/lib/hooks/use-tab-editing'
import { useTerminalHandlers } from '@/lib/hooks/use-terminal-handlers'
import { useTerminalPanes } from '@/lib/hooks/use-terminal-panes'
import { useTerminalSettings } from '@/lib/hooks/use-terminal-settings'
import type { UseTerminalTabsStateProps } from './terminal-tabs-state/types'
import {
  getActiveSessionProjectId,
  getPanesToSlots,
  getOrderedIds,
  isGridLayoutMode,
} from './terminal-tabs-state/utils'
import {
  useSwapPanes,
  useLayoutAutoDowngrade,
  useConnectionStatus,
} from './terminal-tabs-state/hooks'

export function useTerminalTabsState({ projectId, projectPath }: UseTerminalTabsStateProps) {
  const {
    activeSessionId,
    switchToSession,
    sessions,
    projectTerminals,
    adHocSessions,
    isLoading: activeSessionLoading,
  } = useActiveSession()

  const {
    panes,
    atLimit: panesAtLimit,
    isLoading: panesLoading,
    hasLoadedOnce: panesLoadedOnce,
    swapPanePositions,
    removePane,
    setActiveMode,
    createAdHocPane,
    createProjectPane,
    isCreating: isPaneCreating,
    saveLayouts,
    maxPanes,
  } = useTerminalPanes()

  const viewportPaneCapacity = usePaneCapacity()
  const initialPaneCount = 1
  const initialViewportWidth = 0
  const [layoutMode, setLayoutMode] = useLocalStorageState<LayoutMode>(
    'terminal-layout-mode',
    getDefaultLayoutMode(initialPaneCount, initialViewportWidth),
  )
  const activeSessionProjectId = useMemo(() => getActiveSessionProjectId(activeSessionId, sessions), [activeSessionId, sessions])
  const { fontId, fontSize, fontFamily, scrollback, cursorStyle, cursorBlink, themeId, theme, setFontId, setFontSize, setScrollback, setCursorStyle, setCursorBlink, setThemeId } = useTerminalSettings(activeSessionProjectId)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [showSettings, setShowSettings] = useState(false)
  const [keyboardSize, setKeyboardSize] = useLocalStorageState<KeyboardSizePreset>('terminal-keyboard-size', 'medium')
  const [showTerminalManager, setShowTerminalManager] = useState(false)
  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map())
  const [terminalStatuses, setTerminalStatuses] = useState<Map<string, ConnectionStatus>>(new Map())
  const projectTabRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const {
    handleKeyboardSizeChange,
    handleStatusChange,
    handleKeyboardInput,
    handleReconnect,
    handleLayoutModeChange,
    handleAddTab,
    handleNewTerminalForProject,
    handleProjectModeChange,
    handleCloseAll,
    setTerminalRef,
    update,
    remove,
    reset,
    resetAll,
    resetProject,
    disableProject,
    sessionsLoading,
    projectsLoading,
  } = useTerminalHandlers({
    projectId,
    projectPath,
    adHocSessions,
    projectTerminals,
    activeSessionId,
    terminalRefs,
    projectTabRefs,
    setTerminalStatuses,
    setLayoutMode,
    setKeyboardSize,
    panes,
    panesAtLimit,
    createProjectPane,
    createAdHocPane,
    setActiveMode,
    removePane,
  })

  const isLoading = activeSessionLoading || sessionsLoading || projectsLoading || panesLoading
  const availableLayouts = useAvailableLayouts(panes.length)
  const terminalSlots = useMemo(() => getPanesToSlots(panes), [panes])
  const orderedIds = useMemo(() => getOrderedIds(terminalSlots), [terminalSlots])
  const reorder = useCallback((_newOrder: string[]) => { /* noop — reorder via drag-and-drop not yet implemented */ }, [])
  const swapPanes = useSwapPanes(terminalSlots, swapPanePositions)
  const canAddPane = useCallback(
    () =>
      panes.length < Math.min(maxPanes, viewportPaneCapacity) && !panesAtLimit,
    [maxPanes, panes.length, panesAtLimit, viewportPaneCapacity],
  )
  const isGridMode = isGridLayoutMode(layoutMode)
  const { activeStatus, showReconnect } = useConnectionStatus(activeSessionId, terminalStatuses)

  // Derive active mode from the active session (for ControlBar model picker)
  const activeMode = useMemo<string | undefined>(() => {
    if (!activeSessionId) return undefined
    const session = sessions.find((s) => s.id === activeSessionId)
    return session?.mode
  }, [activeSessionId, sessions])
  useLayoutAutoDowngrade(
    availableLayouts,
    layoutMode,
    setLayoutMode,
    panesLoadedOnce && panes.length > 0,
  )
  useAutoCreatePane({
    panes,
    isLoading,
    hasLoadedOnce: panesLoadedOnce,
    isPaneCreating,
    createAdHocPane,
    switchToSession,
  })
  const tabEditingProps = useTabEditing({ onSave: async (sessionId: string, newName: string) => { await update(sessionId, { name: newName }) } })

  return {
    activeSessionId,
    switchToSession,
    sessions,
    projectTerminals,
    adHocSessions,
    isLoading,
    layoutMode,
    setLayoutMode,
    availableLayouts,
    isGridMode,
    terminalSlots,
    orderedIds,
    reorder,
    swapPanes,
    canAddPane,
    panes,
    panesAtLimit,
    removePane,
    setActiveMode,
    createAdHocPane,
    createProjectPane,
    isPaneCreating,
    saveLayouts,
    terminalRefs,
    terminalStatuses,
    projectTabRefs,
    setTerminalRef,
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
    showTerminalManager,
    setShowTerminalManager,
    activeMode,
    activeStatus,
    showReconnect,
    ...tabEditingProps,
    handleStatusChange,
    handleKeyboardInput,
    handleReconnect,
    handleLayoutModeChange,
    handleAddTab,
    handleNewTerminalForProject,
    handleProjectModeChange,
    handleCloseAll,
    resetProject,
    disableProject,
    reset,
    resetAll,
    remove,
  }
}
