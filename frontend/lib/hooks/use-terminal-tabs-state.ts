'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import {
  findSessionByMode,
  generateProjectPaneName,
} from '@/lib/hooks/terminal-handler-utils'
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
    externalSessions,
    isLoading: activeSessionLoading,
  } = useActiveSession()

  const {
    panes,
    atLimit: backendPanesAtLimit,
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
  const [attachedExternalSessionIds, setAttachedExternalSessionIds] = useState<string[]>([])
  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map())
  const [terminalStatuses, setTerminalStatuses] = useState<Map<string, ConnectionStatus>>(new Map())
  const projectTabRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const attachedExternalSessions = useMemo(() => {
    const sessionsById = new Map(externalSessions.map((session) => [session.id, session]))
    return attachedExternalSessionIds.flatMap((sessionId) => {
      const session = sessionsById.get(sessionId)
      return session ? [session] : []
    })
  }, [attachedExternalSessionIds, externalSessions])
  const visiblePaneCount = panes.length + attachedExternalSessions.length
  const paneCountLimit = Math.min(maxPanes, viewportPaneCapacity)
  const visiblePanesAtLimit = visiblePaneCount >= paneCountLimit

  useEffect(() => {
    setAttachedExternalSessionIds((current) =>
      current.filter((sessionId) => externalSessions.some((session) => session.id === sessionId)),
    )
  }, [externalSessions])

  const attachExternalSession = useCallback((sessionId: string) => {
    setAttachedExternalSessionIds((current) =>
      current.includes(sessionId) || current.length + panes.length >= paneCountLimit || backendPanesAtLimit
        ? current
        : [...current, sessionId],
    )
  }, [backendPanesAtLimit, paneCountLimit, panes.length])

  const detachExternalSession = useCallback((sessionId: string) => {
    setAttachedExternalSessionIds((current) =>
      current.filter((currentSessionId) => currentSessionId !== sessionId),
    )
  }, [])

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
    projectTerminals,
    activeSessionId,
    terminalRefs,
    projectTabRefs,
    setTerminalStatuses,
    setLayoutMode,
    setKeyboardSize,
    panes,
    panesAtLimit: visiblePanesAtLimit,
    createProjectPane,
    createAdHocPane,
    setActiveMode,
    removePane,
  })

  const isLoading = activeSessionLoading || sessionsLoading || projectsLoading || panesLoading
  const availableLayouts = useAvailableLayouts(visiblePaneCount)
  const terminalSlots = useMemo(() => {
    const paneSlots = getPanesToSlots(panes)
    const externalSlots = attachedExternalSessions.map((session) => ({
      type: 'adhoc' as const,
      sessionId: session.id,
      name: session.name,
      workingDir: session.working_dir,
      isExternal: true,
    }))
    return [...paneSlots, ...externalSlots]
  }, [attachedExternalSessions, panes])
  const orderedIds = useMemo(() => getOrderedIds(terminalSlots), [terminalSlots])
  const hasVisibleExternalSlot = attachedExternalSessions.length > 0
  const swapPanes = useSwapPanes(terminalSlots, swapPanePositions)
  const canAddPane = useCallback(
    () => visiblePaneCount < paneCountLimit && !backendPanesAtLimit,
    [backendPanesAtLimit, paneCountLimit, visiblePaneCount],
  )
  const isGridMode = isGridLayoutMode(layoutMode)
  const { activeStatus } = useConnectionStatus(activeSessionId, terminalStatuses)

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
    panesLoadedOnce && visiblePaneCount > 0,
  )
  useAutoCreatePane({
    panes,
    hasVisibleExternalSlot,
    isLoading,
    hasLoadedOnce: panesLoadedOnce,
    isPaneCreating,
    createAdHocPane,
    switchToSession,
  })
  const tabEditingProps = useTabEditing({ onSave: async (sessionId: string, newName: string) => { await update(sessionId, { name: newName }) } })
  const startupLaunchKeyRef = useRef<string | null>(null)
  const handleCloseAllWithDetachedExternal = useCallback(async () => {
    setAttachedExternalSessionIds([])
    await handleCloseAll()
  }, [handleCloseAll])

  useEffect(() => {
    if (!projectId) {
      startupLaunchKeyRef.current = null
      return
    }
    if (isLoading || isPaneCreating || visiblePanesAtLimit) {
      return
    }

    const startupKey = `${projectId}:${projectPath ?? ''}`
    if (startupLaunchKeyRef.current === startupKey) {
      return
    }

    const projectTerminal = projectTerminals.find(
      (terminal) => terminal.projectId === projectId,
    )
    const existingSessionId =
      projectTerminal?.activeSessionId ??
      projectTerminal?.sessions.find((session) => session.session.mode === 'shell')
        ?.session.id ??
      projectTerminal?.sessions[0]?.session.id ??
      null

    if (existingSessionId) {
      startupLaunchKeyRef.current = startupKey
      if (existingSessionId !== activeSessionId) {
        switchToSession(existingSessionId)
      }
      return
    }

    startupLaunchKeyRef.current = startupKey
    createProjectPane(
      generateProjectPaneName(projectId, panes),
      projectId,
      projectPath ?? undefined,
    )
      .then((newPane) => {
        const targetSessionId =
          findSessionByMode(newPane, 'shell')?.id ??
          findSessionByMode(newPane, newPane.active_mode)?.id ??
          newPane.sessions[0]?.id
        if (targetSessionId) {
          switchToSession(targetSessionId)
        }
      })
      .catch(() => {
        startupLaunchKeyRef.current = null
      })
  }, [
    activeSessionId,
    createProjectPane,
    isLoading,
    isPaneCreating,
    panes,
    visiblePanesAtLimit,
    projectId,
    projectPath,
    projectTerminals,
    switchToSession,
  ])

  return {
    activeSessionId,
    switchToSession,
    sessions,
    projectTerminals,
    adHocSessions,
    externalSessions,
    isLoading,
    layoutMode,
    setLayoutMode,
    availableLayouts,
    isGridMode,
    terminalSlots,
    orderedIds,
    swapPanes,
    canAddPane,
    panes,
    panesAtLimit: visiblePanesAtLimit,
    attachExternalSession,
    detachExternalSession,
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
    ...tabEditingProps,
    handleStatusChange,
    handleKeyboardInput,
    handleReconnect,
    handleLayoutModeChange,
    handleAddTab,
    handleNewTerminalForProject,
    handleProjectModeChange,
    handleCloseAll: handleCloseAllWithDetachedExternal,
    resetProject,
    disableProject,
    reset,
    resetAll,
    remove,
  }
}
