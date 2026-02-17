/**
 * Session creation utilities
 */

import type { ProjectTerminal } from '@/lib/hooks/use-project-terminals'

/**
 * Get the active session ID for a project based on its current mode.
 * @param pt - Project terminal with sessions array
 * @returns Session ID for the active mode, or null if not set
 */
export function getProjectSessionId(pt: ProjectTerminal): string | null {
  return pt.activeSessionId
}

