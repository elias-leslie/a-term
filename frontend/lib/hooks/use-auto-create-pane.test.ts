import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useAutoCreatePane } from './use-auto-create-pane'

vi.mock('@/lib/api-config', () => ({
  buildApiUrl: (path: string) => `http://localhost:8002${path}`,
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useAutoCreatePane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not auto-create before pane state has loaded at least once', async () => {
    const createAdHocPane = vi.fn()
    const switchToSession = vi.fn()

    renderHook(() =>
      useAutoCreatePane({
        panes: [],
        isLoading: false,
        hasLoadedOnce: false,
        isPaneCreating: false,
        createAdHocPane,
        switchToSession,
      }),
    )

    await new Promise((r) => setTimeout(r, 50))
    expect(mockFetch).not.toHaveBeenCalled()
    expect(createAdHocPane).not.toHaveBeenCalled()
    expect(switchToSession).not.toHaveBeenCalled()
  })

  it('auto-creates exactly one ad-hoc pane after an empty initial load is confirmed', async () => {
    const createAdHocPane = vi.fn().mockResolvedValue({
      sessions: [{ id: 'session-1', mode: 'shell' }],
    })
    const switchToSession = vi.fn()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ count: 0 }),
    })

    renderHook(() =>
      useAutoCreatePane({
        panes: [],
        isLoading: false,
        hasLoadedOnce: true,
        isPaneCreating: false,
        createAdHocPane,
        switchToSession,
      }),
    )

    await waitFor(() => {
      expect(createAdHocPane).toHaveBeenCalledTimes(1)
    })

    expect(switchToSession).toHaveBeenCalledWith('session-1')
  })
})
