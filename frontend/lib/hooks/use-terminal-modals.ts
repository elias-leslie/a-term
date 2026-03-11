import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'

interface UseTerminalModalsProps {
  showTerminalManager: boolean
  setShowTerminalManager: (show: boolean) => void
  showKeyboardHelp: boolean
  setShowKeyboardHelp: (show: boolean) => void
}

interface UseTerminalModalsReturn {
  handleOpenTerminalManager: () => void
  handleCloseTerminalManager: () => void
  handleAttachExternalSession: (sessionId: string) => void
  handleCloseKeyboardHelp: () => void
}

/**
 * Custom hook for managing terminal modals with URL param synchronization
 * Handles terminal manager and keyboard shortcuts modals
 */
export function useTerminalModals({
  showTerminalManager: _showTerminalManager,
  setShowTerminalManager,
  showKeyboardHelp: _showKeyboardHelp,
  setShowKeyboardHelp,
}: UseTerminalModalsProps): UseTerminalModalsReturn {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const urlModal = searchParams.get('modal')

  // Helper to update URL params
  const updateUrlParams = useCallback(
    (updates: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          newParams.delete(key)
        } else {
          newParams.set(key, value)
        }
      }
      const query = newParams.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, {
        scroll: false,
      })
    },
    [searchParams, router, pathname],
  )

  // Open terminal manager
  const handleOpenTerminalManager = useCallback(() => {
    setShowTerminalManager(true)
    updateUrlParams({ modal: 'terminal-manager' })
  }, [setShowTerminalManager, updateUrlParams])

  // Close terminal manager
  const handleCloseTerminalManager = useCallback(() => {
    setShowTerminalManager(false)
    updateUrlParams({ modal: null })
  }, [setShowTerminalManager, updateUrlParams])

  const handleAttachExternalSession = useCallback(
    (sessionId: string) => {
      setShowTerminalManager(false)
      updateUrlParams({ modal: null, session: sessionId })
    },
    [setShowTerminalManager, updateUrlParams],
  )

  // Close keyboard help
  const handleCloseKeyboardHelp = useCallback(() => {
    setShowKeyboardHelp(false)
    updateUrlParams({ modal: null })
  }, [setShowKeyboardHelp, updateUrlParams])

  // Sync modal state from URL params
  useEffect(() => {
    setShowTerminalManager(urlModal === 'terminal-manager')
    setShowKeyboardHelp(urlModal === 'keyboard-shortcuts')
  }, [urlModal, setShowTerminalManager, setShowKeyboardHelp])

  return {
    handleOpenTerminalManager,
    handleCloseTerminalManager,
    handleAttachExternalSession,
    handleCloseKeyboardHelp,
  }
}
