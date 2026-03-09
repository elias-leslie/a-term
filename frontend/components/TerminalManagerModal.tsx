'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Folder, Plus, Terminal, X } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useHoverStyle } from '@/lib/hooks/use-hover-style'
import {
  type ProjectSetting,
  useProjectSettings,
} from '@/lib/hooks/use-project-settings'
import type { TerminalPane } from '@/lib/hooks/use-terminal-panes'

interface TerminalManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateGenericTerminal: () => void
  onCreateProjectTerminal: (projectId: string, rootPath: string | null) => void
  panes: TerminalPane[]
}

interface ProjectButtonProps {
  project: ProjectSetting
  paneCount: number
  onClick: () => void
}

function ProjectButton({ project, paneCount, onClick }: ProjectButtonProps) {
  const hoverStyle = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-text-primary)',
    defaultColor: 'var(--term-text-secondary)',
  })

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-md transition-colors text-left"
      style={{
        ...hoverStyle.style,
        fontFamily: 'var(--font-mono)',
      }}
      onMouseEnter={hoverStyle.onMouseEnter}
      onMouseLeave={hoverStyle.onMouseLeave}
    >
      <Folder
        size={16}
        style={{ color: 'var(--term-accent)', flexShrink: 0 }}
      />
      <span className="flex-1 text-sm truncate">{project.name}</span>
      {paneCount > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--term-bg-surface)',
            color: 'var(--term-text-muted)',
          }}
        >
          {paneCount} open
        </span>
      )}
      <Plus
        size={14}
        style={{ color: 'var(--term-text-muted)', flexShrink: 0 }}
      />
    </button>
  )
}

interface GenericTerminalButtonProps {
  paneCount: number
  onClick: () => void
}

function GenericTerminalButton({
  paneCount,
  onClick,
}: GenericTerminalButtonProps) {
  const hoverStyle = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-accent)',
    defaultColor: 'var(--term-text-muted)',
  })

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-md transition-colors"
      style={{
        ...hoverStyle.style,
        fontFamily: 'var(--font-mono)',
      }}
      onMouseEnter={hoverStyle.onMouseEnter}
      onMouseLeave={hoverStyle.onMouseLeave}
    >
      <Terminal
        size={16}
        style={{ color: 'var(--term-accent)', flexShrink: 0 }}
      />
      <span className="flex-1 text-sm text-left">New Ad-Hoc Terminal</span>
      {paneCount > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--term-bg-surface)',
            color: 'var(--term-text-muted)',
          }}
        >
          {paneCount} open
        </span>
      )}
      <Plus
        size={14}
        style={{ color: 'var(--term-text-muted)', flexShrink: 0 }}
      />
    </button>
  )
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
  panes,
}: TerminalManagerModalProps) {
  const { projects } = useProjectSettings()
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const searchRef = useRef<HTMLInputElement>(null)

  // Count panes per project (only project panes, not ad-hoc)
  const paneCountByProject = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const pane of panes) {
      if (pane.pane_type === 'project' && pane.project_id) {
        counts[pane.project_id] = (counts[pane.project_id] || 0) + 1
      }
    }
    return counts
  }, [panes])

  // Count ad-hoc panes (for "New Terminal" button)
  const adHocPaneCount = useMemo(() => {
    return panes.filter((p) => p.pane_type === 'adhoc').length
  }, [panes])

  const normalizedSearch = deferredSearchQuery.trim().toLowerCase()
  const visibleProjects = useMemo(() => {
    const sortedProjects = [...projects].sort((a, b) => {
      const paneDelta =
        (paneCountByProject[b.id] || 0) - (paneCountByProject[a.id] || 0)
      if (paneDelta !== 0) return paneDelta
      return a.name.localeCompare(b.name)
    })

    if (!normalizedSearch) {
      return sortedProjects
    }

    return sortedProjects.filter((project) => {
      const haystack =
        `${project.name} ${project.root_path ?? ''}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [projects, paneCountByProject, normalizedSearch])

  // Hover styles for close button
  const closeButtonHover = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-text-primary)',
    defaultColor: 'var(--term-text-muted)',
  })

  // Handle clicking a project - create new terminal for it
  const handleProjectClick = (project: ProjectSetting) => {
    onCreateProjectTerminal(project.id, project.root_path)
    setSearchQuery('')
    onClose()
  }

  // Handle creating generic terminal
  const handleCreateGeneric = () => {
    onCreateGenericTerminal()
    setSearchQuery('')
    onClose()
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSearchQuery('')
      onClose()
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[10000]"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        />
        <Dialog.Content
          data-testid="terminal-manager-modal"
          className="fixed z-[10001] left-1/2 top-1/2 w-[min(92vw,560px)] max-h-[min(80vh,720px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: 'var(--term-bg-elevated)',
            border: '1px solid var(--term-border-active)',
            boxShadow: '0 8px 48px rgba(0, 0, 0, 0.6)',
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchRef.current?.focus()
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid var(--term-border)' }}
          >
            <div className="min-w-0">
              <Dialog.Title
                className="text-xs font-medium tracking-widest"
                style={{
                  color: 'var(--term-text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                TERMINALS
              </Dialog.Title>
              <Dialog.Description
                className="mt-1 text-xs"
                style={{ color: 'var(--term-text-muted)' }}
              >
                Launch a project terminal or open a fresh ad-hoc shell.
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
            <label
              htmlFor="terminal-manager-search"
              className="mb-2 block text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{
                color: 'var(--term-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Search Projects
            </label>
            <input
              ref={searchRef}
              id="terminal-manager-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter by project name or path"
              className="w-full rounded-md px-3 py-2.5 text-sm outline-none transition-colors"
              style={{
                backgroundColor: 'var(--term-bg-surface)',
                border: '1px solid var(--term-border)',
                color: 'var(--term-text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div className="px-4 pb-4">
            <div
              className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{
                color: 'var(--term-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>Quick Start</span>
              <span>
                {visibleProjects.length} project
                {visibleProjects.length === 1 ? '' : 's'}
              </span>
            </div>

            <div
              className="rounded-lg p-2"
              style={{
                backgroundColor: 'rgba(10, 14, 20, 0.35)',
                border: '1px solid var(--term-border)',
              }}
            >
              <GenericTerminalButton
                paneCount={adHocPaneCount}
                onClick={handleCreateGeneric}
              />

              <div
                className="my-2 h-px"
                style={{ backgroundColor: 'var(--term-border)' }}
              />

              <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
                {visibleProjects.map((project) => (
                  <ProjectButton
                    key={project.id}
                    project={project}
                    paneCount={paneCountByProject[project.id] || 0}
                    onClick={() => handleProjectClick(project)}
                  />
                ))}
              </div>

              {projects.length === 0 && (
                <p
                  className="px-3 py-6 text-center text-sm"
                  style={{ color: 'var(--term-text-muted)' }}
                >
                  No projects found yet. You can still open an ad-hoc shell.
                </p>
              )}

              {projects.length > 0 && visibleProjects.length === 0 && (
                <p
                  className="px-3 py-6 text-center text-sm"
                  style={{ color: 'var(--term-text-muted)' }}
                >
                  No projects match "{deferredSearchQuery.trim()}".
                </p>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
