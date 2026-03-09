import type { TerminalPane } from '@/lib/hooks/terminal-panes-types'
import type { TerminalSession } from '@/lib/hooks/use-terminal-sessions'
import { getSlotPanelId, type PaneSlot, panesToSlots } from '@/lib/utils/slot'

/**
 * Get active session's project_id for per-project settings
 */
export function getActiveSessionProjectId(
  activeSessionId: string | null | undefined,
  sessions: TerminalSession[],
): string | undefined {
  if (!activeSessionId) return undefined
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  return activeSession?.project_id ?? undefined
}

/**
 * Convert panes to terminal slots
 */
export function getPanesToSlots(panes: TerminalPane[]): PaneSlot[] {
  return panesToSlots(panes)
}

/**
 * Get ordered slot IDs from terminal slots
 */
export function getOrderedIds(terminalSlots: PaneSlot[]): string[] {
  return terminalSlots.map((slot) => getSlotPanelId(slot))
}

/**
 * Check if layout mode is a grid mode
 */
export function isGridLayoutMode(layoutMode: string): boolean {
  return layoutMode.startsWith('grid-')
}
