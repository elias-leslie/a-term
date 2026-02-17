'use client'

import { MoreVertical, RefreshCw, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useClickOutside } from '@/lib/hooks/use-click-outside'
import { useDropdownPosition } from '@/lib/hooks/use-dropdown-position'
import { MenuItemButton } from './MenuItemButton'

export type TabType = 'project' | 'adhoc'

interface TabActionMenuProps {
  tabType: TabType
  onReset: () => void
  onClose: () => void
  isMobile?: boolean
}

/**
 * Kebab menu for tab actions (Reset, Close).
 * Behavior differs based on tabType:
 * - project: "Close" disables the project terminal
 * - adhoc: "Close" deletes the session
 */
export function TabActionMenu({
  tabType,
  onReset,
  onClose,
  isMobile = false,
}: TabActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setIsOpen(false), [])
  const clickOutsideRefs = useMemo(() => [buttonRef, menuRef], [])
  useClickOutside(clickOutsideRefs, closeMenu, isOpen)

  const menuStyle = useDropdownPosition(buttonRef, isOpen, {
    estimatedHeight: 88,
    estimatedWidth: 140,
  })

  const handleReset = () => {
    onReset()
    setIsOpen(false)
  }

  const handleClose = () => {
    onClose()
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Touch target sizing
  const touchTargetClass = isMobile ? 'min-h-[44px] min-w-[44px]' : ''

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        data-testid="tab-action-menu"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        onKeyDown={handleKeyDown}
        className={`
          flex items-center justify-center rounded transition-all duration-150
          ${isMobile ? 'p-2' : 'p-1'}
          ${touchTargetClass}
        `}
        style={{
          backgroundColor: isOpen ? 'var(--term-bg-deep)' : 'transparent',
          color: isOpen ? 'var(--term-text-primary)' : 'var(--term-text-muted)',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'var(--term-bg-deep)'
            e.currentTarget.style.color = 'var(--term-text-primary)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--term-text-muted)'
          }
        }}
        title="Tab actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>

      {/* Menu */}
      {isOpen && (
        <>
          {/* Invisible overlay to capture clicks */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(false)
            }}
          />

          <div
            ref={menuRef}
            data-testid="tab-action-menu-items"
            role="menu"
            className="min-w-[120px] rounded-md overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
            style={{
              ...menuStyle,
              backgroundColor: 'rgba(21, 27, 35, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--term-border-active)',
              boxShadow: 'var(--term-shadow-dropdown)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItemButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              label="Reset"
              onClick={handleReset}
              isMobile={isMobile}
            />
            <MenuItemButton
              icon={<X className="w-3.5 h-3.5" />}
              label={tabType === 'project' ? 'Disable' : 'Close'}
              onClick={handleClose}
              isMobile={isMobile}
              variant="danger"
            />
          </div>
        </>
      )}
    </div>
  )
}
