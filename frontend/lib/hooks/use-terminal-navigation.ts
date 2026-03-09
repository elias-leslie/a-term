import { useCallback } from 'react'
import type { TerminalSlot } from '@/lib/utils/slot'

interface UseTerminalNavigationProps {
  terminalSlots: TerminalSlot[]
  orderedIds: string[]
  activeSessionId: string | null
  onSlotSwitch: (slot: TerminalSlot) => void
  onSlotClose: (slot: TerminalSlot) => void
}

interface UseTerminalNavigationReturn {
  handleCloseActive: () => void
  handleNextTerminal: () => void
  handlePrevTerminal: () => void
  handleJumpToTerminal: (index: number) => void
}

/**
 * Custom hook for terminal navigation logic
 * Handles cycling through terminals and closing active terminals
 */
export function useTerminalNavigation({
  terminalSlots,
  orderedIds,
  activeSessionId,
  onSlotSwitch,
  onSlotClose,
}: UseTerminalNavigationProps): UseTerminalNavigationReturn {
  // Find the active slot
  const findActiveSlot = useCallback(() => {
    return terminalSlots.find(
      (slot) =>
        (slot.type === 'project' &&
          slot.activeSessionId === activeSessionId) ||
        (slot.type === 'adhoc' && slot.sessionId === activeSessionId),
    )
  }, [terminalSlots, activeSessionId])

  // Find the current index in orderedIds
  const findCurrentIndex = useCallback(() => {
    return orderedIds.findIndex((id) =>
      terminalSlots.some(
        (slot) =>
          (slot.type === 'project' &&
            slot.activeSessionId === activeSessionId &&
            `project-${slot.projectId}` === id) ||
          (slot.type === 'adhoc' &&
            slot.sessionId === activeSessionId &&
            `adhoc-${slot.sessionId}` === id),
      ),
    )
  }, [orderedIds, terminalSlots, activeSessionId])

  // Find slot by orderedId
  const findSlotByOrderedId = useCallback(
    (orderedId: string) => {
      return terminalSlots.find(
        (slot) =>
          (slot.type === 'project' &&
            `project-${slot.projectId}` === orderedId) ||
          (slot.type === 'adhoc' && `adhoc-${slot.sessionId}` === orderedId),
      )
    },
    [terminalSlots],
  )

  // Close the current active slot
  const handleCloseActive = useCallback(() => {
    const activeSlot = findActiveSlot()
    if (activeSlot) {
      onSlotClose(activeSlot)
    }
  }, [findActiveSlot, onSlotClose])

  // Cycle to next terminal
  const handleNextTerminal = useCallback(() => {
    if (orderedIds.length <= 1) return

    const currentIndex = findCurrentIndex()
    const nextIndex = (currentIndex + 1) % orderedIds.length
    const nextSlot = findSlotByOrderedId(orderedIds[nextIndex])

    if (nextSlot) onSlotSwitch(nextSlot)
  }, [orderedIds, findCurrentIndex, findSlotByOrderedId, onSlotSwitch])

  // Cycle to previous terminal
  const handlePrevTerminal = useCallback(() => {
    if (orderedIds.length <= 1) return

    const currentIndex = findCurrentIndex()
    const prevIndex = (currentIndex - 1 + orderedIds.length) % orderedIds.length
    const prevSlot = findSlotByOrderedId(orderedIds[prevIndex])

    if (prevSlot) onSlotSwitch(prevSlot)
  }, [orderedIds, findCurrentIndex, findSlotByOrderedId, onSlotSwitch])

  // Jump to terminal at position (0-indexed)
  const handleJumpToTerminal = useCallback(
    (index: number) => {
      if (index >= orderedIds.length) return

      const targetSlot = findSlotByOrderedId(orderedIds[index])
      if (targetSlot) onSlotSwitch(targetSlot)
    },
    [orderedIds, findSlotByOrderedId, onSlotSwitch],
  )

  return {
    handleCloseActive,
    handleNextTerminal,
    handlePrevTerminal,
    handleJumpToTerminal,
  }
}
