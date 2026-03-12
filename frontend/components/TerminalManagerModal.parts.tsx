/**
 * Sub-components and helpers for TerminalManagerModal.
 * Extracted to keep the main modal file under 200 lines.
 */
import { Terminal } from 'lucide-react'
import { useHoverStyle } from '@/lib/hooks/use-hover-style'
import type { TerminalSession } from '@/lib/hooks/use-terminal-sessions'

export function formatSessionDescription(session: TerminalSession): string {
  const location = session.working_dir || 'no working directory'
  return `${session.project_id ?? 'external'} • ${session.mode} • ${location}`
}

export function filterAndSortSessions(sessions: TerminalSession[], query: string): TerminalSession[] {
  const sorted = [...sessions].sort((a, b) => a.name.localeCompare(b.name))
  if (!query) return sorted
  return sorted.filter((s) =>
    `${s.name} ${s.project_id ?? ''} ${s.working_dir ?? ''} ${s.mode}`.toLowerCase().includes(query)
  )
}

export const iconStyle = { color: 'var(--term-accent)', flexShrink: 0 } as const
export const sectionHeaderStyle = { color: 'var(--term-text-muted)', fontFamily: 'var(--font-mono)' } as const

export interface TerminalButtonProps {
  icon: React.ReactNode
  label: string
  description?: string
  paneCount: number
  hoverColor: string
  defaultColor: string
  actionLabel?: string
  onClick: () => void
}

export function TerminalButton({
  icon,
  label,
  description,
  paneCount,
  hoverColor,
  defaultColor,
  actionLabel = 'Open',
  onClick,
}: TerminalButtonProps) {
  const hoverStyle = useHoverStyle({
    hoverBg: 'var(--term-bg-surface)',
    defaultBg: 'transparent',
    hoverColor,
    defaultColor,
  })
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-3 min-h-[44px] rounded-md transition-colors text-left"
      style={{ ...hoverStyle.style, fontFamily: 'var(--font-mono)' }}
      onMouseEnter={hoverStyle.onMouseEnter}
      onMouseLeave={hoverStyle.onMouseLeave}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm truncate">{label}</span>
        {description ? (
          <span className="block text-[11px] truncate" style={{ color: 'var(--term-text-muted)' }}>
            {description}
          </span>
        ) : null}
      </span>
      {paneCount > 0 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--term-bg-surface)', color: 'var(--term-text-muted)' }}
        >
          {paneCount} open
        </span>
      )}
      <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--term-text-muted)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
        {actionLabel}
      </span>
    </button>
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

interface SessionSectionProps {
  title: string
  countLabel: string
  total: number
  visible: TerminalSession[]
  searchQuery: string
  emptyLabel: string
  actionLabel: string
  maxHeight?: string
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
  maxHeight = 'md:max-h-[320px]',
  onAction,
}: SessionSectionProps) {
  if (total === 0) return null
  return (
    <div className="pt-4">
      <SectionHeader title={title} countLabel={countLabel} />
      <div className="rounded-lg p-2" style={{ backgroundColor: 'rgba(10, 14, 20, 0.35)', border: '1px solid var(--term-border)' }}>
        <div className={`space-y-1 pr-1 ${maxHeight} md:overflow-y-auto`}>
          {visible.map((session) => (
            <TerminalButton
              key={session.id}
              icon={<Terminal size={16} style={iconStyle} />}
              label={session.name}
              description={formatSessionDescription(session)}
              paneCount={0}
              hoverColor="var(--term-accent)"
              defaultColor="var(--term-text-secondary)"
              actionLabel={actionLabel}
              onClick={() => onAction(session)}
            />
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
