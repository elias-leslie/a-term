import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTerminalSessions } from './use-terminal-sessions'

// Mock the api-config module
vi.mock('../api-config', () => ({
  buildApiUrl: (path: string) => `http://localhost:8002${path}`,
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const mockSessions = [
  {
    id: 'session-1',
    name: 'Terminal 1',
    user_id: null,
    project_id: 'proj-1',
    working_dir: '/home/user',
    mode: 'shell',
    display_order: 0,
    is_alive: true,
    created_at: '2026-01-01T00:00:00Z',
    last_accessed_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'session-2',
    name: 'Terminal 2',
    user_id: null,
    project_id: null,
    working_dir: '/tmp',
    mode: 'shell',
    display_order: 1,
    is_alive: true,
    created_at: '2026-01-01T00:00:00Z',
    last_accessed_at: '2026-01-01T00:00:00Z',
  },
]

describe('useTerminalSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists sessions from the API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: mockSessions, total: 2 }),
    })

    const { result } = renderHook(() => useTerminalSessions(), {
      wrapper: createWrapper(),
    })

    // Initially loading
    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.sessions).toHaveLength(2)
    expect(result.current.sessions[0].id).toBe('session-1')
    expect(result.current.sessions[1].id).toBe('session-2')

    // Verify fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8002/api/terminal/sessions',
      undefined,
    )
  })

  it('sets activeId to first session automatically', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: mockSessions, total: 2 }),
    })

    const { result } = renderHook(() => useTerminalSessions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2)
    })

    await waitFor(() => {
      expect(result.current.activeId).toBe('session-1')
    })
  })

  it('creates a session by calling the correct endpoint', async () => {
    const newSession = {
      id: 'session-new',
      name: 'New Terminal',
      user_id: null,
      project_id: 'proj-1',
      working_dir: '/home/user',
      mode: 'shell',
      display_order: 2,
      is_alive: true,
      created_at: '2026-01-01T00:00:00Z',
      last_accessed_at: '2026-01-01T00:00:00Z',
    }

    // First call: initial list fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: mockSessions, total: 2 }),
    })

    const { result } = renderHook(() => useTerminalSessions('proj-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Set up mock for create call + subsequent refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newSession,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [...mockSessions, newSession], total: 3 }),
    })

    await act(async () => {
      await result.current.create('New Terminal', '/home/user', 'shell')
    })

    // Verify the create call
    const createCall = mockFetch.mock.calls[1]
    expect(createCall[0]).toBe('http://localhost:8002/api/terminal/sessions')
    expect(createCall[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const body = JSON.parse(createCall[1].body)
    expect(body.name).toBe('New Terminal')
    expect(body.project_id).toBe('proj-1')
    expect(body.working_dir).toBe('/home/user')
    expect(body.mode).toBe('shell')
  })

  it('creates a generic session without project_id when isGeneric is true', async () => {
    const newSession = {
      id: 'session-generic',
      name: 'Generic Terminal',
      user_id: null,
      project_id: null,
      working_dir: '/tmp',
      mode: 'shell',
      display_order: 0,
      is_alive: true,
      created_at: null,
      last_accessed_at: null,
    }

    // Initial fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    })

    const { result } = renderHook(() => useTerminalSessions('proj-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    // Create call + refetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newSession,
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [newSession], total: 1 }),
    })

    await act(async () => {
      await result.current.create('Generic Terminal', '/tmp', 'shell', true)
    })

    const createCall = mockFetch.mock.calls[1]
    const body = JSON.parse(createCall[1].body)
    expect(body.project_id).toBeUndefined()
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: 'Server error' }),
    })

    const { result } = renderHook(() => useTerminalSessions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })
})
