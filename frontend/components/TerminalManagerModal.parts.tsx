/**
 * Sub-components and helpers for TerminalManagerModal.
 */
import { Folder, Terminal } from 'lucide-react'
import { useHoverStyle } from '@/lib/hooks/use-hover-style'
import type { ProjectSetting } from '@/lib/hooks/use-project-settings'
import type { TerminalSession } from '@/lib/hooks/use-terminal-sessions'

export interface ProjectSessionOption {
  id: string
  label: string
  session: TerminalSession
}

export interface ProjectRowData {
  project: ProjectSetting
  paneCount: number
  sessionOptions: ProjectSessionOption[]
}

export const iconStyle = { color: 'var(--term-accent)', flexShrink: 0 } as const
export const sectionHeaderStyle = { color: 'var(--term-text-muted)', fontFamily: 'var(--font-mono)' } as const

function formatProjectDescription(project: ProjectSetting, sessionCount: number): string {
  const path = project.root_path ?? 'no working directory'
  if (sessionCount === 0) {
    return path
  }
  const suffix = sessionCount === 1 ? '1 attachable session' : `${sessionCount} attachable sessions`
  return `${path} • ${suffix}`
}

export function formatSessionDescription(session: TerminalSession): string {
  const location = session.working_dir || 'no working directory'
  return `${session.project_id ?? 'external'} • ${session.mode} • ${location}`
}

export function makeProjectSessionOptions(sessions: TerminalSession[]): ProjectSessionOption[] {
  return [...sessions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((session) => ({
      id: session.id,
      label: `${session.name} (${session.mode})`,
      session,
    }))
}

export function matchesProjectRow(row: ProjectRowData, query: string): boolean {
  if (!query) return true
  const searchable = [
    row.project.name,
    row.project.root_path ?? '',
    ...row.sessionOptions.flatMap((option) => [
      option.session.name,
      option.session.mode,
      option.session.working_dir ?? '',
    ]),
  ]
  return searchable.join(' ').toLowerCase().includes(query)
}

export function filterAndSortSessions(sessions: TerminalSession[], query: string): TerminalSession[] {
  const sorted = [...sessions].sort((a, b) => a.name.localeCompare(b.name))
  if (!query) return sorted
  return sorted.filter((s) =>
    `${s.name} ${s.project_id ?? ''} ${s.working_dir ?? ''} ${s.mode}`.toLowerCase().includes(query)
  )
}

export function SectionHeader({ title, countLabel }: { title: string; countLabel: string }) {
  return (
    <div
      className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em]"
      style={sectionHeaderStyle}
    >
      <span>{title}</span>
      <span>{countLabel}</span>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  muted = false,
}: {
  label: string
  onClick: () => void
  muted?: boolean
}) {
  const hoverStyle = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-text-primary)',
    defaultColor: muted ? 'var(--term-text-muted)' : 'var(--term-accent)',
  })

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border px-2.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors"
      style={{
        ...hoverStyle.style,
        borderColor: 'var(--term-border)',
        fontFamily: 'var(--font-mono)',
      }}
      onMouseEnter={hoverStyle.onMouseEnter}
      onMouseLeave={hoverStyle.onMouseLeave}
    >
      {label}
    </button>
  )
}

interface ProjectSessionRowProps {
  row: ProjectRowData
  selectedSessionId: string | undefined
  onSelectSession: (projectId: string, sessionId: string) => void
  onAttachSession: (sessionId: string) => void
  onCreateProjectTerminal: (projectId: string, rootPath: string | null) => void
}

export function ProjectSessionRow({
  row,
  selectedSessionId,
  onSelectSession,
  onAttachSession,
  onCreateProjectTerminal,
}: ProjectSessionRowProps) {
  const hoverStyle = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor: 'var(--term-text-primary)',
    defaultColor: 'var(--term-text-secondary)',
  })
  const selectedOption = row.sessionOptions.find((option) => option.id === selectedSessionId)
  const attachTarget = selectedOption ?? row.sessionOptions[0] ?? null

  return (
    <div
      className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors"
      style={{ ...hoverStyle.style, fontFamily: 'var(--font-mono)' }}
      onMouseEnter={hoverStyle.onMouseEnter}
      onMouseLeave={hoverStyle.onMouseLeave}
    >
      <Folder size={16} style={iconStyle} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate">{row.project.name}</span>
        <span className="block text-[11px] truncate" style={{ color: 'var(--term-text-muted)' }}>
          {formatProjectDescription(row.project, row.sessionOptions.length)}
        </span>
      </span>
      {row.paneCount > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--term-bg-surface)', color: 'var(--term-text-muted)' }}
        >
          {row.paneCount} open
        </span>
      )}
      {row.sessionOptions.length > 1 && (
        <label className="sr-only" htmlFor={`project-session-select-${row.project.id}`}>
          Select existing session for {row.project.name}
        </label>
      )}
      {row.sessionOptions.length > 1 && (
        <select
          id={`project-session-select-${row.project.id}`}
          value={attachTarget?.id ?? ''}
          onChange={(event) => onSelectSession(row.project.id, event.target.value)}
          className="max-w-[220px] rounded-md px-2.5 py-1.5 text-xs outline-none"
          style={{
            backgroundColor: 'var(--term-bg-surface)',
            border: '1px solid var(--term-border)',
            color: 'var(--term-text-primary)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {row.sessionOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      {attachTarget && (
        <ActionButton
          label="Attach"
          onClick={() => onAttachSession(attachTarget.id)}
        />
      )}
      <ActionButton
        label="New"
        muted={Boolean(attachTarget)}
        onClick={() => onCreateProjectTerminal(row.project.id, row.project.root_path)}
      />
    </div>
  )
}

interface SessionSectionProps {
  title: string
  countLabel: string
  total: number
  visible: TerminalSession[]
  searchQuery: string
  emptyLabel: string
  actionLabel: string
  onAction: (session: TerminalSession) => void
}

export function SessionSection({
  title,
  countLabel,
  total,
  visible,
  searchQuery,
  emptyLabel,
  actionLabel,
  onAction,
}: SessionSectionProps) {
  if (total === 0) return null
  return (
    <div className="pt-4">
      <SectionHeader title={title} countLabel={countLabel} />
      <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(10, 14, 20, 0.35)', border: '1px solid var(--term-border)' }}>
        <div className="space-y-1 pr-1 md:max-h-[220px] md:overflow-y-auto">
          {visible.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onAction(session)}
              className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-md transition-colors text-left"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <Terminal size={16} style={iconStyle} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">{session.name}</span>
                <span className="block text-[11px] truncate" style={{ color: 'var(--term-text-muted)' }}>
                  {formatSessionDescription(session)}
                </span>
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--term-text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                {actionLabel}
              </span>
            </button>
          ))}
        </div>
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--term-text-muted)' }}>
            No {emptyLabel} match &quot;{searchQuery}&quot;.
          </p>
        )}
      </div>
    </div>
  )
}
