'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
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
    swapPanePositions,
    removePane,
    setActiveMode,
    createAdHocPane,
    createProjectPane,
    isCreating: isPaneCreating,
    saveLayouts,
  } = useTerminalPanes()

  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid-2x2')
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
    handleProjectTabClick,
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
    sessions,
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
  const availableLayouts = useAvailableLayouts()
  const terminalSlots = useMemo(() => getPanesToSlots(panes), [panes])
  const orderedIds = useMemo(() => getOrderedIds(terminalSlots), [terminalSlots])
  const reorder = useCallback((_newOrder: string[]) => { /* noop — reorder via drag-and-drop not yet implemented */ }, [])
  const swapPanes = useSwapPanes(terminalSlots, swapPanePositions)
  const canAddPane = useCallback(() => !panesAtLimit, [panesAtLimit])
  const isGridMode = isGridLayoutMode(layoutMode)
  const { activeStatus, showReconnect } = useConnectionStatus(activeSessionId, terminalStatuses)

  // Derive active mode from the active session (for ControlBar model picker)
  const activeMode = useMemo<string | undefined>(() => {
    if (!activeSessionId) return undefined
    const session = sessions.find((s) => s.id === activeSessionId)
    return session?.mode
  }, [activeSessionId, sessions])
  useLayoutAutoDowngrade(availableLayouts, layoutMode, setLayoutMode)
  useAutoCreatePane({ panes, isLoading, isPaneCreating, createAdHocPane, switchToSession })
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
    handleProjectTabClick,
    handleProjectModeChange,
    handleCloseAll,
    resetProject,
    disableProject,
    reset,
    resetAll,
    remove,
  }
}
