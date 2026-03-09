import { useCallback, useEffect, useMemo } from 'react'
import type { ConnectionStatus } from '@/components/Terminal'
import type { LayoutMode } from '@/lib/constants/terminal'
import { isReconnectableStatus } from '@/lib/utils/mobile-terminal-status'
import type { PaneSlot } from '@/lib/utils/slot'
import { getSlotPanelId } from '@/lib/utils/slot'

/**
 * Hook to manage pane swap operations
 */
export function useSwapPanes(
  terminalSlots: PaneSlot[],
  swapPanePositions: (paneIdA: string, paneIdB: string) => Promise<void>,
) {
  return useCallback(
    async (slotIdA: string, slotIdB: string) => {
      // Find pane IDs from slot IDs
      const slotA = terminalSlots.find((s) => getSlotPanelId(s) === slotIdA)
      const slotB = terminalSlots.find((s) => getSlotPanelId(s) === slotIdB)

      if (!slotA || !slotB) return

      await swapPanePositions(slotA.paneId, slotB.paneId)
    },
    [terminalSlots, swapPanePositions],
  )
}

/**
 * Hook to auto-downgrade layout if current mode is unavailable
 */
export function useLayoutAutoDowngrade(
  availableLayouts: LayoutMode[],
  layoutMode: LayoutMode,
  setLayoutMode: (mode: LayoutMode) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled || availableLayouts.length === 0) return
    if (!availableLayouts.includes(layoutMode)) {
      const highest =
        availableLayouts[availableLayouts.length - 1] || 'split-horizontal'
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: sync layout to viewport constraints
      setLayoutMode(highest)
    }
  }, [availableLayouts, enabled, layoutMode, setLayoutMode])
}

/**
 * Hook to check connection status
 */
export function useConnectionStatus(
  activeSessionId: string | null | undefined,
  terminalStatuses: Map<string, ConnectionStatus>,
) {
  return useMemo(() => {
    const activeStatus = activeSessionId
      ? terminalStatuses.get(activeSessionId)
      : undefined
    const showReconnect = isReconnectableStatus(activeStatus)
    return { activeStatus, showReconnect }
  }, [activeSessionId, terminalStatuses])
}
