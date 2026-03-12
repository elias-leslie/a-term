'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Folder, Terminal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useHoverStyle } from '@/lib/hooks/use-hover-style'
import type { TerminalSession } from '@/lib/hooks/use-terminal-sessions'
import {
  type ProjectSetting,
  useProjectSettings,
} from '@/lib/hooks/use-project-settings'
import type { TerminalPane } from '@/lib/hooks/use-terminal-panes'
import {
  filterAndSortSessions,
  iconStyle,
  sectionHeaderStyle,
  SectionHeader,
  SessionSection,
  TerminalButton,
} from './TerminalManagerModal.parts'

interface TerminalManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateGenericTerminal: () => void
  onCreateProjectTerminal: (projectId: string, rootPath: string | null) => void
  externalSessions: TerminalSession[]
  hiddenExternalSessions: TerminalSession[]
  onAttachExternalSession: (sessionId: string) => void
  onRestoreExternalSession: (sessionId: string) => void
  panes: TerminalPane[]
}

/**
 * Terminal Manager Modal - opened via + button in tab bar.
 * Simple project selector - click a project to create a new terminal for it.
 */
export function TerminalManagerModal({
  isOpen,
  onClose,
  onCreateGenericTerminal,
  onCreateProjectTerminal,
  externalSessions,
  hiddenExternalSessions,
  onAttachExternalSession,
  onRestoreExternalSession,
  panes,
}: TerminalManagerModalProps) {
  const { projects } = useProjectSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const searchRef = useRef<HTMLInputElement>(null)

  const closeButtonHover = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-text-primary)',
    defaultColor: 'var(--term-text-muted)',
  })

  // Single pass: count project panes by id and ad-hoc panes under '__adhoc'
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

  const visibleProjects = useMemo(() => {
    const sorted = [...projects].sort((a, b) => {
      const delta = (paneCounts[b.id] || 0) - (paneCounts[a.id] || 0)
      return delta !== 0 ? delta : a.name.localeCompare(b.name)
    })
    if (!normalizedSearch) return sorted
    return sorted.filter((p) =>
      `${p.name} ${p.root_path ?? ''}`.toLowerCase().includes(normalizedSearch)
    )
  }, [projects, paneCounts, normalizedSearch])

  const visibleExternalSessions = useMemo(
    () => filterAndSortSessions(externalSessions, normalizedSearch),
    [externalSessions, normalizedSearch],
  )
  const visibleHiddenExternalSessions = useMemo(
    () => filterAndSortSessions(hiddenExternalSessions, normalizedSearch),
    [hiddenExternalSessions, normalizedSearch],
  )

  const closeAndReset = () => { setSearchQuery(''); onClose() }
  const handleProjectClick = (project: ProjectSetting) => { onCreateProjectTerminal(project.id, project.root_path); closeAndReset() }
  const handleCreateGeneric = () => { onCreateGenericTerminal(); closeAndReset() }
  const handleExternalSessionClick = (session: TerminalSession) => { onAttachExternalSession(session.id); closeAndReset() }
  const handleRestoreExternalSession = (session: TerminalSession) => {
    onRestoreExternalSession(session.id)
    onAttachExternalSession(session.id)
    closeAndReset()
  }

  const noMatches =
    normalizedSearch &&
    visibleProjects.length === 0 &&
    visibleExternalSessions.length === 0 &&
    visibleHiddenExternalSessions.length === 0

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
          className="fixed inset-x-3 top-3 bottom-3 z-[10001] flex flex-col overflow-hidden rounded-lg animate-in fade-in zoom-in-95 duration-150 sm:inset-x-6 sm:top-6 sm:bottom-6 md:left-1/2 md:right-auto md:top-1/2 md:bottom-auto md:w-[min(92vw,560px)] md:max-h-[min(98dvh,1100px)] md:-translate-x-1/2 md:-translate-y-1/2"
          style={{
            backgroundColor: 'var(--term-bg-elevated)',
            border: '1px solid var(--term-border-active)',
            boxShadow: '0 8px 48px rgba(0, 0, 0, 0.6)',
          }}
          onOpenAutoFocus={(event) => { event.preventDefault(); searchRef.current?.focus() }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--term-border)' }}>
            <div className="min-w-0">
              <Dialog.Title className="text-xs font-medium tracking-widest" style={sectionHeaderStyle}>
                TERMINALS
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs" style={{ color: 'var(--term-text-muted)' }}>
                Launch a project terminal, open a fresh ad-hoc shell, or attach an external tmux session.
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

          {/* Search */}
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
              placeholder="Filter by project, external session, or path"
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
                : `Showing ${visibleProjects.length} project${visibleProjects.length === 1 ? '' : 's'}, ${visibleExternalSessions.length} live external, and ${visibleHiddenExternalSessions.length} hidden external session${visibleHiddenExternalSessions.length === 1 ? '' : 's'}.`}
            </p>
          </div>

          {/* Scroll region */}
          <div
            data-testid="terminal-manager-scroll-region"
            className="flex-1 overflow-y-auto overscroll-contain px-4 pb-5"
          >
            <SectionHeader
              title="Quick Start"
              countLabel={`${visibleProjects.length} project${visibleProjects.length === 1 ? '' : 's'}`}
            />
            <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(10, 14, 20, 0.35)', border: '1px solid var(--term-border)' }}>
              <TerminalButton
                icon={<Terminal size={16} style={iconStyle} />}
                label="New Ad-Hoc Terminal"
                paneCount={paneCounts.__adhoc || 0}
                hoverColor="var(--term-accent)"
                defaultColor="var(--term-text-muted)"
                actionLabel="New"
                onClick={handleCreateGeneric}
              />
              <div className="my-2 h-px" style={{ backgroundColor: 'var(--term-border)' }} />
              <div className="space-y-1 pr-1 md:max-h-[320px] md:overflow-y-auto">
                {visibleProjects.map((project) => (
                  <TerminalButton
                    key={project.id}
                    icon={<Folder size={16} style={iconStyle} />}
                    label={project.name}
                    paneCount={paneCounts[project.id] || 0}
                    hoverColor="var(--term-text-primary)"
                    defaultColor="var(--term-text-secondary)"
                    actionLabel="New"
                    onClick={() => handleProjectClick(project)}
                  />
                ))}
              </div>
              {projects.length === 0 && (
                <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--term-text-muted)' }}>
                  No projects found yet. You can still open an ad-hoc shell.
                </p>
              )}
              {projects.length > 0 && visibleProjects.length === 0 && (
                <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--term-text-muted)' }}>
                  No projects match &quot;{trimmedSearch}&quot;.
                </p>
              )}
            </div>

            <SessionSection
              title="External Sessions"
              countLabel={`${visibleExternalSessions.length} live`}
              total={externalSessions.length}
              visible={visibleExternalSessions}
              searchQuery={trimmedSearch}
              emptyLabel="external sessions"
              actionLabel="Attach"
              onAction={handleExternalSessionClick}
            />
            <SessionSection
              title="Hidden External Sessions"
              countLabel={`${visibleHiddenExternalSessions.length} hidden`}
              total={hiddenExternalSessions.length}
              visible={visibleHiddenExternalSessions}
              searchQuery={trimmedSearch}
              emptyLabel="hidden external sessions"
              actionLabel="Restore"
              maxHeight="md:max-h-[280px]"
              onAction={handleRestoreExternalSession}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
