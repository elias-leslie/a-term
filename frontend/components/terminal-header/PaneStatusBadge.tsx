'use client'

import type { ConnectionStatus } from '@/components/terminal.types'

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; tone: string; glow: string }
> = {
  connected: {
    label: 'Live',
    tone: 'var(--term-success)',
    glow: 'rgba(34, 197, 94, 0.28)',
  },
  connecting: {
    label: 'Connecting',
    tone: 'var(--term-warning)',
    glow: 'rgba(245, 158, 11, 0.24)',
  },
  disconnected: {
    label: 'Disconnected',
    tone: 'var(--term-danger)',
    glow: 'rgba(239, 68, 68, 0.22)',
  },
  error: {
    label: 'Error',
    tone: 'var(--term-danger)',
    glow: 'rgba(239, 68, 68, 0.22)',
  },
  session_dead: {
    label: 'Ended',
    tone: 'var(--term-warning)',
    glow: 'rgba(245, 158, 11, 0.22)',
  },
  timeout: {
    label: 'Timed out',
    tone: 'var(--term-danger)',
    glow: 'rgba(239, 68, 68, 0.22)',
  },
}

interface PaneStatusBadgeProps {
  status?: ConnectionStatus
}

export function PaneStatusBadge({ status }: PaneStatusBadgeProps) {
  if (!status) return null

  const meta = STATUS_META[status]

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em]"
      style={{
        color: meta.tone,
        backgroundColor: meta.glow,
        border: `1px solid ${meta.glow}`,
      }}
      title={`Pane status: ${meta.label}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.tone }}
      />
      <span>{meta.label}</span>
    </span>
  )
}
