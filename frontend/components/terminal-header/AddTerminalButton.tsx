'use client'

import { clsx } from 'clsx'
import { Plus } from 'lucide-react'

interface AddTerminalButtonProps {
  onOpenModal: () => void
  canAddPane: boolean
  isMobile: boolean
}

export function AddTerminalButton({
  onOpenModal,
  canAddPane,
  isMobile,
}: AddTerminalButtonProps) {
  const title = canAddPane
    ? 'Open terminal'
    : 'Maximum 4 terminals. Close one to add more.'

  return (
    <button
      onClick={onOpenModal}
      disabled={!canAddPane}
      className={clsx(
        'flex items-center justify-center rounded ml-1 transition-all duration-150',
        isMobile ? 'w-7 h-7' : 'w-5 h-5',
        !canAddPane && 'opacity-50 cursor-not-allowed',
      )}
      style={{
        backgroundColor: 'var(--term-bg-surface)',
        border: '1px solid var(--term-border)',
        color: 'var(--term-text-muted)',
      }}
      onMouseEnter={(e) => {
        if (canAddPane) {
          e.currentTarget.style.backgroundColor = 'var(--term-bg-elevated)'
          e.currentTarget.style.borderColor = 'var(--term-accent)'
          e.currentTarget.style.color = 'var(--term-accent)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--term-bg-surface)'
        e.currentTarget.style.borderColor = 'var(--term-border)'
        e.currentTarget.style.color = 'var(--term-text-muted)'
      }}
      title={title}
      aria-label={title}
      data-testid="add-terminal-btn"
    >
      <Plus className={isMobile ? 'w-4 h-4' : 'w-3 h-3'} />
    </button>
  )
}
