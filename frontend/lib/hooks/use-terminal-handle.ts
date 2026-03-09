'use client'

import { useImperativeHandle } from 'react'
import type {
  ConnectionStatus,
  TerminalHandle,
} from '../../components/terminal.types'
import {
  getTerminalContent,
  getTerminalLastLine,
} from '../utils/terminal-buffer'

type XtermTerminal = InstanceType<typeof import('@xterm/xterm').Terminal>

interface UseTerminalHandleOptions {
  reconnect: () => void
  sendInput: (data: string) => void
  status: ConnectionStatus
  terminalRef: React.RefObject<XtermTerminal | null>
}

/**
 * Wires the TerminalHandle imperative API exposed to parent components via ref.
 */
export function useTerminalHandle(
  ref: React.Ref<TerminalHandle>,
  { reconnect, sendInput, status, terminalRef }: UseTerminalHandleOptions,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: terminalRef is a stable ref; .current is read at call time, not depended on for re-creation
  useImperativeHandle(
    ref,
    () => ({
      reconnect,
      getContent: () => getTerminalContent(terminalRef.current),
      getLastLine: () => getTerminalLastLine(terminalRef.current),
      sendInput,
      pasteInput: (data: string) => {
        // Bracketed paste sequences let TUI apps (Claude Code, vim, etc.) insert as paste
        sendInput(`\x1b[200~${data}\x1b[201~`)
      },
      status,
    }),
    [status, reconnect, sendInput],
  )
}
