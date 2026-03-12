import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useActiveSession } from './use-active-session'
import { useTerminalModals } from './use-terminal-modals'
import type { TerminalSession } from './use-terminal-sessions'

const mockReplace = vi.fn()
const mockPush = vi.fn()
const navigationState = {
  pathname: '/',
  searchParams: new URLSearchParams(),
}

const mockUseTerminalSessions = vi.fn()
const mockUseProjectTerminals = vi.fn()

function applyUrl(url: string) {
  const nextUrl = new URL(url, 'http://localhost/')
  window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}`)
  navigationState.searchParams = new URLSearchParams(nextUrl.search)
}

function resetNavigation(search = '') {
  applyUrl(`/${search ? `?${search}` : ''}`)
  mockReplace.mockReset()
  mockPush.mockReset()
  mockReplace.mockImplementation((url: string) => {
    applyUrl(url)
  })
  mockPush.mockImplementation((url: string) => {
    applyUrl(url)
  })
}

function readParams() {
  return Object.fromEntries(navigationState.searchParams.entries())
}

const sessions: TerminalSession[] = [
  {
    id: 'session-1',
    name: 'Terminal 1',
    user_id: null,
    project_id: null,
    working_dir: null,
    mode: 'shell',
    display_order: 0,
    is_alive: true,
    created_at: '2026-03-06T00:00:00Z',
    last_accessed_at: '2026-03-06T00:00:00Z',
  },
  {
    id: 'session-2',
    name: 'Terminal 2',
    user_id: null,
    project_id: 'project-2',
    working_dir: null,
    mode: 'shell',
    display_order: 1,
    is_alive: true,
    created_at: '2026-03-06T00:00:00Z',
    last_accessed_at: '2026-03-06T00:00:00Z',
  },
]

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams,
}))

vi.mock('./use-terminal-sessions', () => ({
  useTerminalSessions: () => mockUseTerminalSessions(),
}))

vi.mock('./use-project-terminals', () => ({
  useProjectTerminals: () => mockUseProjectTerminals(),
}))

describe('URL state integration', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetNavigation()

    mockUseTerminalSessions.mockReturnValue({
      sessions,
      isLoading: false,
      isError: false,
    })

    mockUseProjectTerminals.mockReturnValue({
      projectTerminals: [],
      adHocSessions: [sessions[0]],
      externalSessions: [],
      isLoading: false,
      isError: false,
      switchMode: vi.fn(),
      resetProject: vi.fn(),
      disableProject: vi.fn(),
    })
  })

  it('keeps the modal param when active session sync fills in a missing session id', async () => {
    resetNavigation('modal=terminal-manager')

    const setShowTerminalManager = vi.fn()
    const setShowKeyboardHelp = vi.fn()

    const { result, rerender } = renderHook(() => ({
      activeSession: useActiveSession(),
      modals: useTerminalModals({
        showTerminalManager: false,
        setShowTerminalManager,
        showKeyboardHelp: false,
        setShowKeyboardHelp,
      }),
    }))

    expect(result.current.activeSession.activeSessionId).toBe('session-1')

    await waitFor(() => {
      expect(readParams()).toEqual({
        modal: 'terminal-manager',
        session: 'session-1',
      })
    })

    rerender()

    expect(setShowTerminalManager).toHaveBeenLastCalledWith(true)
    expect(setShowKeyboardHelp).toHaveBeenLastCalledWith(false)
  })

  it('opens and closes the terminal manager without losing the current session id', async () => {
    resetNavigation('session=session-2')

    const setShowTerminalManager = vi.fn()
    const setShowKeyboardHelp = vi.fn()

    const { result, rerender } = renderHook(() => ({
      activeSession: useActiveSession(),
      modals: useTerminalModals({
        showTerminalManager: false,
        setShowTerminalManager,
        showKeyboardHelp: false,
        setShowKeyboardHelp,
      }),
    }))

    expect(result.current.activeSession.activeSessionId).toBe('session-2')

    act(() => {
      result.current.modals.handleOpenTerminalManager()
    })

    await waitFor(() => {
      expect(readParams()).toEqual({
        session: 'session-2',
        modal: 'terminal-manager',
      })
    })

    rerender()
    expect(setShowTerminalManager).toHaveBeenLastCalledWith(true)

    act(() => {
      result.current.modals.handleCloseTerminalManager()
    })

    await waitFor(() => {
      expect(readParams()).toEqual({
        session: 'session-2',
      })
    })

    rerender()
    expect(setShowTerminalManager).toHaveBeenLastCalledWith(false)
  })

  it('preserves the attached external session when close runs in the same tick', async () => {
    resetNavigation('session=session-2&modal=terminal-manager')

    const { result } = renderHook(() => ({
      modals: useTerminalModals({
        showTerminalManager: true,
        setShowTerminalManager: vi.fn(),
        showKeyboardHelp: false,
        setShowKeyboardHelp: vi.fn(),
      }),
    }))

    act(() => {
      result.current.modals.handleAttachExternalSession('codex-terminal')
      result.current.modals.handleCloseTerminalManager()
    })

    await waitFor(() => {
      expect(readParams()).toEqual({
        session: 'codex-terminal',
      })
    })
  })
})
