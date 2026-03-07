'use client'

import {
  ChevronDown,
  Grid2x2,
  LayoutPanelLeft,
  LayoutPanelTop,
  PanelsTopLeft,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { type LayoutMode, GRID_MIN_WIDTHS } from '@/lib/constants/terminal'
import { useClickOutside } from '@/lib/hooks/use-click-outside'
import { useDropdownPosition } from '@/lib/hooks/use-dropdown-position'

interface LayoutOption {
  mode: LayoutMode
  icon: LucideIcon
  title: string
  minWidth?: number
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    mode: 'split-horizontal',
    icon: LayoutPanelLeft,
    title: 'Side by Side',
  },
  {
    mode: 'split-vertical',
    icon: LayoutPanelTop,
    title: 'Stacked',
  },
  {
    mode: 'grid-2x2',
    icon: Grid2x2,
    title: '2×2 Grid',
    minWidth: GRID_MIN_WIDTHS['grid-2x2'],
  },
  {
    mode: 'grid-3x2',
    icon: PanelsTopLeft,
    title: '3×2 Grid',
    minWidth: GRID_MIN_WIDTHS['grid-3x2'],
  },
]

interface LayoutModeButtonsProps {
  layoutMode: LayoutMode
  onLayoutChange: (mode: LayoutMode) => void
  availableLayouts?: LayoutMode[]
}

export function LayoutModeButtons({
  layoutMode,
  onLayoutChange,
  availableLayouts,
}: LayoutModeButtonsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const closeDropdown = useCallback(() => setIsOpen(false), [])
  const clickOutsideRefs = useMemo(() => [buttonRef, dropdownRef], [])
  useClickOutside(clickOutsideRefs, closeDropdown, isOpen)

  const dropdownStyle = useDropdownPosition(buttonRef, isOpen, {
    estimatedHeight: 120,
  })

  // Filter options by availableLayouts if provided
  const filteredOptions = useMemo(() => {
    if (!availableLayouts) return LAYOUT_OPTIONS
    return LAYOUT_OPTIONS.filter((opt) => availableLayouts.includes(opt.mode))
  }, [availableLayouts])

  const handleSelect = (mode: LayoutMode) => {
    onLayoutChange(mode)
    setIsOpen(false)
  }

  // Get current layout info
  const currentLayout =
    LAYOUT_OPTIONS.find((opt) => opt.mode === layoutMode) || LAYOUT_OPTIONS[0]
  const CurrentIcon = currentLayout.icon

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        data-testid="layout-dropdown"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 p-1.5 rounded-md transition-all duration-150"
        style={{
          backgroundColor: isOpen ? 'var(--term-bg-elevated)' : 'transparent',
          color: isOpen ? 'var(--term-accent)' : 'var(--term-text-muted)',
          boxShadow: isOpen ? '0 0 8px var(--term-accent-glow)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'var(--term-bg-elevated)'
            e.currentTarget.style.color = 'var(--term-text-primary)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--term-text-muted)'
          }
        }}
        title={currentLayout.title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="w-4 h-4" />
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Invisible overlay to capture clicks */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={dropdownRef}
            data-testid="layout-dropdown-menu"
            role="listbox"
            className="min-w-[140px] rounded-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
            style={{
              ...dropdownStyle,
              backgroundColor: 'rgba(21, 27, 35, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--term-border-active)',
              boxShadow: 'var(--term-shadow-dropdown)',
            }}
          >
            {filteredOptions.map(({ mode, icon: Icon, title }) => {
              const isSelected = mode === layoutMode
              return (
                <button
                  key={mode}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(mode)}
                  className="flex items-center gap-2 w-full text-left px-2.5 py-2 text-xs transition-colors"
                  style={{
                    color: isSelected
                      ? 'var(--term-accent)'
                      : 'var(--term-text-primary)',
                    backgroundColor: 'transparent',
                    fontFamily: 'var(--font-mono)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      'var(--term-bg-surface)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Icon
                    className="w-3.5 h-3.5"
                    style={{
                      color: isSelected
                        ? 'var(--term-accent)'
                        : 'var(--term-text-muted)',
                    }}
                  />
                  <span>{title}</span>
                  {isSelected && (
                    <span
                      className="ml-auto"
                      style={{ color: 'var(--term-accent)' }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
