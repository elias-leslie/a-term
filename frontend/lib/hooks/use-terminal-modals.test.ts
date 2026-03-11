import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTerminalModals } from './use-terminal-modals'

const mockReplace = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => '/',
  useSearchParams: () => mockSearchParams,
}))

describe('useTerminalModals', () => {
  beforeEach(() => {
    mockReplace.mockReset()
    for (const key of Array.from(mockSearchParams.keys())) {
      mockSearchParams.delete(key)
    }
  })

  it('opens the terminal manager when the URL modal param targets it', () => {
    mockSearchParams.set('modal', 'terminal-manager')

    const setShowTerminalManager = vi.fn()
    const setShowKeyboardHelp = vi.fn()

    renderHook(() =>
      useTerminalModals({
        showTerminalManager: false,
        setShowTerminalManager,
        showKeyboardHelp: false,
        setShowKeyboardHelp,
      }),
    )

    expect(setShowTerminalManager).toHaveBeenCalledWith(true)
    expect(setShowKeyboardHelp).toHaveBeenCalledWith(false)
  })

  it('closes both overlays when the URL modal param is cleared', () => {
    const setShowTerminalManager = vi.fn()
    const setShowKeyboardHelp = vi.fn()

    const { rerender } = renderHook(() =>
      useTerminalModals({
        showTerminalManager: true,
        setShowTerminalManager,
        showKeyboardHelp: true,
        setShowKeyboardHelp,
      }),
    )

    mockSearchParams.set('modal', 'terminal-manager')
    rerender()

    setShowTerminalManager.mockClear()
    setShowKeyboardHelp.mockClear()

    mockSearchParams.delete('modal')
    rerender()

    expect(setShowTerminalManager).toHaveBeenCalledWith(false)
    expect(setShowKeyboardHelp).toHaveBeenCalledWith(false)
  })

  it('switches visible overlays when the URL modal param changes', () => {
    const setShowTerminalManager = vi.fn()
    const setShowKeyboardHelp = vi.fn()

    mockSearchParams.set('modal', 'terminal-manager')

    const { rerender } = renderHook(() =>
      useTerminalModals({
        showTerminalManager: true,
        setShowTerminalManager,
        showKeyboardHelp: false,
        setShowKeyboardHelp,
      }),
    )

    setShowTerminalManager.mockClear()
    setShowKeyboardHelp.mockClear()

    mockSearchParams.set('modal', 'keyboard-shortcuts')
    rerender()

    expect(setShowTerminalManager).toHaveBeenCalledWith(false)
    expect(setShowKeyboardHelp).toHaveBeenCalledWith(true)
  })
})
