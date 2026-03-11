import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTerminalTabsState } from './use-terminal-tabs-state'

const mockUseActiveSession = vi.fn()
const mockUseTerminalPanes = vi.fn()
const mockUseTerminalSettings = vi.fn()
const mockUseTerminalHandlers = vi.fn()
const mockUseLocalStorageState = vi.fn()
const mockUseTabEditing = vi.fn()
const mockUseAvailableLayouts = vi.fn()
const mockUsePaneCapacity = vi.fn()
const mockUseMediaQuery = vi.fn()
const mockUseAutoCreatePane = vi.fn()

vi.mock('@/lib/hooks/use-active-session', () => ({
  useActiveSession: () => mockUseActiveSession(),
}))

vi.mock('@/lib/hooks/use-terminal-panes', () => ({
  useTerminalPanes: () => mockUseTerminalPanes(),
}))

vi.mock('@/lib/hooks/use-terminal-settings', () => ({
  useTerminalSettings: (projectId?: string) => mockUseTerminalSettings(projectId),
}))

vi.mock('@/lib/hooks/use-terminal-handlers', () => ({
  useTerminalHandlers: (params: unknown) => mockUseTerminalHandlers(params),
}))

vi.mock('@/lib/hooks/use-local-storage-state', () => ({
  useLocalStorageState: <T,>(key: string, defaultValue: T) =>
    mockUseLocalStorageState(key, defaultValue),
}))

vi.mock('@/lib/hooks/use-tab-editing', () => ({
  useTabEditing: (params: unknown) => mockUseTabEditing(params),
}))

vi.mock('@/lib/hooks/use-available-layouts', () => ({
  useAvailableLayouts: (paneCount: number) => mockUseAvailableLayouts(paneCount),
  usePaneCapacity: () => mockUsePaneCapacity(),
}))

vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}))

vi.mock('@/lib/hooks/use-auto-create-pane', () => ({
  useAutoCreatePane: (params: unknown) => mockUseAutoCreatePane(params),
}))

function buildActiveSessionState(overrides: Partial<ReturnType<typeof mockUseActiveSession>> = {}) {
  const sessions = [
    {
      id: 'session-project-a',
      name: 'Project A Shell',
      user_id: null,
      project_id: 'project-a',
      working_dir: '/workspace/project-a',
      mode: 'shell',
      display_order: 0,
      is_alive: true,
      created_at: '2026-03-06T00:00:00Z',
      last_accessed_at: '2026-03-06T00:00:00Z',
    },
    {
      id: 'session-project-b',
      name: 'Project B Shell',
      user_id: null,
      project_id: 'project-b',
      working_dir: '/workspace/project-b',
      mode: 'shell',
      display_order: 1,
      is_alive: true,
      created_at: '2026-03-06T00:00:00Z',
      last_accessed_at: '2026-03-06T00:00:00Z',
    },
    {
      id: 'session-adhoc',
      name: 'Ad-Hoc Terminal',
      user_id: null,
      project_id: null,
      working_dir: '/tmp',
      mode: 'shell',
      display_order: 2,
      is_alive: true,
      created_at: '2026-03-06T00:00:00Z',
      last_accessed_at: '2026-03-06T00:00:00Z',
    },
  ]

  const activeSessionId = 'session-project-a'
  return {
    activeSessionId,
    activeSession: sessions[0],
    switchToSession: vi.fn(),
    sessions,
    projectTerminals: [],
    adHocSessions: [sessions[2]],
    externalSessions: [],
    hiddenExternalSessions: [],
    dismissExternalSession: vi.fn(),
    restoreExternalSession: vi.fn(),
    isLoading: false,
    ...overrides,
  }
}

describe('useTerminalTabsState', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseTerminalPanes.mockReturnValue({
      panes: [],
      atLimit: false,
      isLoading: false,
      hasLoadedOnce: true,
      swapPanePositions: vi.fn(),
      removePane: vi.fn(),
      setActiveMode: vi.fn(),
      createAdHocPane: vi.fn(),
      createProjectPane: vi.fn(),
      isCreating: false,
      saveLayouts: vi.fn(),
      maxPanes: 6,
    })

    mockUseTerminalHandlers.mockReturnValue({
      handleKeyboardSizeChange: vi.fn(),
      handleStatusChange: vi.fn(),
      handleKeyboardInput: vi.fn(),
      handleReconnect: vi.fn(),
      handleLayoutModeChange: vi.fn(),
      handleAddTab: vi.fn(),
      handleNewTerminalForProject: vi.fn(),
      handleProjectModeChange: vi.fn(),
      handleCloseAll: vi.fn(),
      setTerminalRef: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      reset: vi.fn(),
      resetAll: vi.fn(),
      resetProject: vi.fn(),
      disableProject: vi.fn(),
      sessionsLoading: false,
      projectsLoading: false,
    })

    mockUseLocalStorageState.mockImplementation(
      (_key: string, defaultValue: unknown) => [defaultValue, vi.fn()],
    )
    mockUseTabEditing.mockReturnValue({
      editingSessionId: null,
      editingValue: '',
      startEditing: vi.fn(),
      cancelEditing: vi.fn(),
      saveEditing: vi.fn(),
      setEditingValue: vi.fn(),
    })
    mockUseAvailableLayouts.mockReturnValue(['split-horizontal'])
    mockUsePaneCapacity.mockReturnValue(4)
    mockUseMediaQuery.mockReturnValue(false)
    mockUseAutoCreatePane.mockReturnValue(undefined)
    mockUseTerminalSettings.mockImplementation((projectId?: string) => ({
      fontId: 'jetbrains-mono',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      scrollback: 10000,
      cursorStyle: 'block',
      cursorBlink: true,
      themeId:
        projectId === 'project-a'
          ? 'dracula'
          : projectId === 'project-b'
            ? 'tokyo-night'
            : 'phosphor',
      theme: {},
      setFontId: vi.fn(),
      setFontSize: vi.fn(),
      setScrollback: vi.fn(),
      setCursorStyle: vi.fn(),
      setCursorBlink: vi.fn(),
      setThemeId: vi.fn(),
    }))
  })

  it('recomputes scoped settings when the resolved active session falls back to a different context', () => {
    let activeSessionState = buildActiveSessionState()
    mockUseActiveSession.mockImplementation(() => activeSessionState)

    const { result, rerender } = renderHook(() =>
      useTerminalTabsState({ projectId: undefined, projectPath: undefined }),
    )

    expect(result.current.activeSessionId).toBe('session-project-a')
    expect(result.current.themeId).toBe('dracula')
    expect(mockUseTerminalSettings).toHaveBeenLastCalledWith('project-a')

    activeSessionState = buildActiveSessionState({
      activeSessionId: 'session-project-b',
      activeSession: {
        id: 'session-project-b',
        name: 'Project B Shell',
        user_id: null,
        project_id: 'project-b',
        working_dir: '/workspace/project-b',
        mode: 'shell',
        display_order: 1,
        is_alive: true,
        created_at: '2026-03-06T00:00:00Z',
        last_accessed_at: '2026-03-06T00:00:00Z',
      },
    })

    rerender()

    expect(result.current.activeSessionId).toBe('session-project-b')
    expect(result.current.themeId).toBe('tokyo-night')
    expect(mockUseTerminalSettings).toHaveBeenLastCalledWith('project-b')

    activeSessionState = buildActiveSessionState({
      activeSessionId: 'session-adhoc',
      activeSession: {
        id: 'session-adhoc',
        name: 'Ad-Hoc Terminal',
        user_id: null,
        project_id: null,
        working_dir: '/tmp',
        mode: 'shell',
        display_order: 2,
        is_alive: true,
        created_at: '2026-03-06T00:00:00Z',
        last_accessed_at: '2026-03-06T00:00:00Z',
      },
    })

    rerender()

    expect(result.current.activeSessionId).toBe('session-adhoc')
    expect(result.current.themeId).toBe('phosphor')
    expect(mockUseTerminalSettings).toHaveBeenLastCalledWith(undefined)
  })
})
