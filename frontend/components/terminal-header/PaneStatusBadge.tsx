'use client'

import type { ConnectionStatus } from '@/components/terminal.types'

const STATUS_META: Record<
  ConnectionStatus,
  { label: string; tone: string; glow: string }
> = {
  connected: {
    label: 'Live',
    tone: 'var(--term-success)',
    glow: 'color-mix(in srgb, var(--term-success) 28%, transparent)',
  },
  connecting: {
    label: 'Connecting',
    tone: 'var(--term-warning)',
    glow: 'color-mix(in srgb, var(--term-warning) 24%, transparent)',
  },
  disconnected: {
    label: 'Disconnected',
    tone: 'var(--term-danger)',
    glow: 'color-mix(in srgb, var(--term-danger) 22%, transparent)',
  },
  error: {
    label: 'Error',
    tone: 'var(--term-danger)',
    glow: 'color-mix(in srgb, var(--term-danger) 22%, transparent)',
  },
  session_dead: {
    label: 'Ended',
    tone: 'var(--term-warning)',
    glow: 'color-mix(in srgb, var(--term-warning) 22%, transparent)',
  },
  timeout: {
    label: 'Timed out',
    tone: 'var(--term-danger)',
    glow: 'color-mix(in srgb, var(--term-danger) 22%, transparent)',
  },
}

interface PaneStatusBadgeProps {
  status?: ConnectionStatus
}

export function PaneStatusBadge({ status }: PaneStatusBadgeProps) {
  if (!status) return null

  const meta = STATUS_META[status]
  if (!meta) return null

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em]"
      style={{
        color: meta.tone,
        backgroundColor: meta.glow,
        border: `1px solid ${meta.glow}`,
      }}
      title={`Pane status: ${meta.label}`}
      aria-label={`Pane status: ${meta.label}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.tone }}
      />
      <span>{meta.label}</span>
    </span>
  )
}
