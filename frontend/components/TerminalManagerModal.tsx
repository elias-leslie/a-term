'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Terminal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useHoverStyle } from '@/lib/hooks/use-hover-style'
import type { TerminalSession } from '@/lib/hooks/use-terminal-sessions'
import {
  useProjectSettings,
} from '@/lib/hooks/use-project-settings'
import type { TerminalPane } from '@/lib/hooks/use-terminal-panes'
import {
  filterAndSortSessions,
  iconStyle,
  makeProjectSessionOptions,
  matchesProjectRow,
  type ProjectRowData,
  ProjectSessionRow,
  SectionHeader,
  sectionHeaderStyle,
  SessionSection,
} from './TerminalManagerModal.parts'

interface TerminalManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateGenericTerminal: () => void
  onCreateProjectTerminal: (projectId: string, rootPath: string | null) => void
  externalSessions: TerminalSession[]
  onAttachExternalSession: (sessionId: string) => void
  panes: TerminalPane[]
}

export function TerminalManagerModal({
  isOpen,
  onClose,
  onCreateGenericTerminal,
  onCreateProjectTerminal,
  externalSessions,
  onAttachExternalSession,
  panes,
}: TerminalManagerModalProps) {
  const { projects } = useProjectSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSessionsByProject, setSelectedSessionsByProject] = useState<Record<string, string>>({})
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const searchRef = useRef<HTMLInputElement>(null)

  const closeButtonHover = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-text-primary)',
    defaultColor: 'var(--term-text-muted)',
  })

  const paneCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const pane of panes) {
      if (pane.pane_type === 'project' && pane.project_id) {
        counts[pane.project_id] = (counts[pane.project_id] || 0) + 1
      } else if (pane.pane_type === 'adhoc') {
        counts.__adhoc = (counts.__adhoc || 0) + 1
      }
    }
    return counts
  }, [panes])

  const normalizedSearch = deferredSearchQuery.trim().toLowerCase()

  const projectRows = useMemo<ProjectRowData[]>(() => {
    const sessionMap = new Map<string, TerminalSession[]>()
    for (const session of externalSessions) {
      if (!session.project_id) continue
      const existing = sessionMap.get(session.project_id) ?? []
      existing.push(session)
      sessionMap.set(session.project_id, existing)
    }

    return projects.map((project) => ({
      project,
      paneCount: paneCounts[project.id] || 0,
      sessionOptions: makeProjectSessionOptions(sessionMap.get(project.id) ?? []),
    }))
  }, [projects, externalSessions, paneCounts])

  const visibleProjectRows = useMemo(
    () => projectRows.filter((row) => matchesProjectRow(row, normalizedSearch)),
    [projectRows, normalizedSearch],
  )

  const knownProjectIds = useMemo(
    () => new Set(projects.map((project) => project.id)),
    [projects],
  )

  const unmatchedExternalSessions = useMemo(
    () =>
      externalSessions.filter((session) => !session.project_id || !knownProjectIds.has(session.project_id)),
    [externalSessions, knownProjectIds],
  )

  const visibleOtherSessions = useMemo(
    () => filterAndSortSessions(unmatchedExternalSessions, normalizedSearch),
    [unmatchedExternalSessions, normalizedSearch],
  )

  const resetModalState = () => {
    setSearchQuery('')
    setSelectedSessionsByProject({})
  }
  const closeAndReset = () => {
    resetModalState()
    onClose()
  }
  const handleCreateGeneric = () => {
    onCreateGenericTerminal()
    closeAndReset()
  }
  const handleCreateProjectTerminal = (projectId: string, rootPath: string | null) => {
    onCreateProjectTerminal(projectId, rootPath)
    closeAndReset()
  }
  const handleAttachExternalSession = (sessionId: string) => {
    resetModalState()
    onAttachExternalSession(sessionId)
  }
  const handleProjectSessionSelect = (projectId: string, sessionId: string) => {
    setSelectedSessionsByProject((current) => ({ ...current, [projectId]: sessionId }))
  }

  const noMatches =
    normalizedSearch &&
    visibleProjectRows.length === 0 &&
    visibleOtherSessions.length === 0

  const trimmedSearch = deferredSearchQuery.trim()

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) closeAndReset() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[10000]"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)' }}
        />
        <Dialog.Content
          data-testid="terminal-manager-modal"
          className="fixed inset-x-3 top-3 bottom-3 z-[10001] flex flex-col overflow-hidden rounded-lg animate-in fade-in zoom-in-95 duration-150 sm:inset-x-6 sm:top-6 sm:bottom-6 md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:w-[min(92vw,720px)] md:max-h-[min(98dvh,1100px)] md:-translate-x-1/2 md:-translate-y-1/2"
          style={{
            backgroundColor: 'var(--term-bg-elevated)',
            border: '1px solid var(--term-border-active)',
            boxShadow: '0 8px 48px rgba(0, 0, 0, 0.6)',
          }}
          onOpenAutoFocus={(event) => { event.preventDefault(); searchRef.current?.focus() }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--term-border)' }}>
            <div className="min-w-0">
              <Dialog.Title className="text-xs font-medium tracking-widest" style={sectionHeaderStyle}>
                TERMINALS
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs" style={{ color: 'var(--term-text-muted)' }}>
                One row per project. Attach to an existing tmux session when one is available, or start a new terminal.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                data-testid="terminal-manager-modal-close"
                className="flex items-center justify-center w-11 h-11 rounded transition-colors"
                onMouseEnter={closeButtonHover.onMouseEnter}
                onMouseLeave={closeButtonHover.onMouseLeave}
                style={closeButtonHover.style}
                aria-label="Close terminal manager"
              >
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4">
            <label htmlFor="terminal-manager-search" className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em]" style={sectionHeaderStyle}>
              Search Terminals
            </label>
            <input
              ref={searchRef}
              id="terminal-manager-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter by project, session name, tool, or path"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
              style={{ backgroundColor: 'var(--term-bg-surface)', border: '1px solid var(--term-border)', color: 'var(--term-text-primary)', fontFamily: 'var(--font-mono)' }}
            />
            <p
              className="mt-2 text-[11px]"
              style={{ color: 'var(--term-text-muted)', fontFamily: 'var(--font-mono)' }}
              aria-live="polite"
            >
              {noMatches
                ? `No terminals match "${trimmedSearch}".`
                : `Showing ${visibleProjectRows.length} project${visibleProjectRows.length === 1 ? '' : 's'} and ${visibleOtherSessions.length} other session${visibleOtherSessions.length === 1 ? '' : 's'}.`}
            </p>
          </div>

          <div
            data-testid="terminal-manager-scroll-region"
            className="flex-1 overflow-y-auto overscroll-contain px-4 pb-5"
          >
            <SectionHeader
              title="Quick Start"
              countLabel={`${paneCounts.__adhoc || 0} open`}
            />
            <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(10, 14, 20, 0.35)', border: '1px solid var(--term-border)' }}>
              <button
                type="button"
                onClick={handleCreateGeneric}
                className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-md transition-colors text-left"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <Terminal size={16} style={iconStyle} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">New Ad-Hoc Terminal</span>
                  <span className="block text-[11px] truncate" style={{ color: 'var(--term-text-muted)' }}>
                    Scratch shell outside any project
                  </span>
                </span>
                <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--term-text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                  New
                </span>
              </button>
            </div>

            <div className="pt-4">
              <SectionHeader
                title="Projects"
                countLabel={`${visibleProjectRows.length} project${visibleProjectRows.length === 1 ? '' : 's'}`}
              />
              <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(10, 14, 20, 0.35)', border: '1px solid var(--term-border)' }}>
                <div className="space-y-1 pr-1 md:max-h-[420px] md:overflow-y-auto">
                  {visibleProjectRows.map((row) => (
                    <ProjectSessionRow
                      key={row.project.id}
                      row={row}
                      selectedSessionId={selectedSessionsByProject[row.project.id]}
                      onSelectSession={handleProjectSessionSelect}
                      onAttachSession={handleAttachExternalSession}
                      onCreateProjectTerminal={handleCreateProjectTerminal}
                    />
                  ))}
                </div>
                {projects.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--term-text-muted)' }}>
                    No projects found yet. You can still open an ad-hoc shell.
                  </p>
                )}
                {projects.length > 0 && visibleProjectRows.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--term-text-muted)' }}>
                    No projects match &quot;{trimmedSearch}&quot;.
                  </p>
                )}
              </div>
            </div>

            <SessionSection
              title="Other Sessions"
              countLabel={`${visibleOtherSessions.length} session${visibleOtherSessions.length === 1 ? '' : 's'}`}
              total={unmatchedExternalSessions.length}
              visible={visibleOtherSessions}
              searchQuery={trimmedSearch}
              emptyLabel="other sessions"
              actionLabel="Attach"
              onAction={(session) => handleAttachExternalSession(session.id)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
