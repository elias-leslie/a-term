'use client'

import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { getSlotName, type TerminalSlot } from '@/lib/utils/slot'
import { PaneSwapDropdown } from '../PaneSwapDropdown'

interface HeaderNameDisplayProps {
  slot: TerminalSlot
  isActive: boolean
  isMobile: boolean
  allSlots?: TerminalSlot[]
  onSwapWith?: (otherSlotId: string) => void
  onSwitchTo?: (slot: TerminalSlot) => void
  onSwitch?: () => void
}

export function HeaderNameDisplay({
  slot,
  isActive,
  isMobile,
  allSlots,
  onSwapWith,
  onSwitchTo,
  onSwitch,
}: HeaderNameDisplayProps) {
  const name = getSlotName(slot)
  const textColor = isActive
    ? 'var(--term-text-primary)'
    : 'var(--term-text-muted)'

  // Swap dropdown in split/grid mode
  if (allSlots && onSwapWith) {
    return (
      <PaneSwapDropdown
        currentSlot={slot}
        allSlots={allSlots}
        onSwapWith={onSwapWith}
        onSwitchTo={onSwitchTo}
        isMobile={isMobile}
      />
    )
  }

  // Switchable button (single pane mode)
  if (onSwitch) {
    return (
      <button
        onClick={onSwitch}
        className={clsx(
          'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs truncate max-w-[140px] transition-all duration-150',
          'hover:bg-[var(--term-bg-elevated)]',
        )}
        style={{ color: textColor }}
        title={name}
      >
        <span className="truncate">{name}</span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>
    )
  }

  // Static display
  return (
    <span
      className="flex items-center px-1.5 py-0.5 text-xs truncate max-w-[140px]"
      style={{ color: textColor }}
      title={name}
    >
      {name}
    </span>
  )
}
