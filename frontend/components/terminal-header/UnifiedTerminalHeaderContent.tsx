'use client'

import { clsx } from 'clsx'
import { GripVertical, Mic, Paperclip, RefreshCw, Settings, Sparkles, X } from 'lucide-react'
import { memo, useCallback, useMemo, useState, type DragEvent } from 'react'
import { useAgentTools } from '@/lib/hooks/use-agent-tools'
import { LayoutModeButtons } from '@/components/LayoutModeButton'
import { getSlotName, getSlotPanelId } from '@/lib/utils/slot'
import {
  getDraggedPaneSlotId,
  setDraggedPaneSlotId,
} from '@/lib/utils/pane-swap-dnd'
import { ModeToggle } from '../ModeToggle'
import { PaneOverflowMenu } from '../PaneOverflowMenu'
import { AddTerminalButton } from './AddTerminalButton'
import { HeaderIconButton } from './HeaderIconButton'
import { HeaderNameDisplay } from './HeaderNameDisplay'
import { PaneStatusBadge } from './PaneStatusBadge'
import type { UnifiedTerminalHeaderProps } from './types'

export const UnifiedTerminalHeaderContent = memo(
  function UnifiedTerminalHeaderContent({
    slot,
    isActive = false,
    showCleanButton = false,
    onSwitch,
    onSettings,
    onReset,
    onClose,
    onUpload,
    onVoice,
    onClean,
    onOpenModal,
    canAddPane = true,
    onModeSwitch,
    isModeSwitching = false,
    isMobile = false,
    allSlots,
    onSwapWith,
    onSwitchTo,
    onResetAll,
    onCloseAll,
    layoutMode,
    availableLayouts,
    onLayoutModeChange,
    connectionStatus,
  }: UnifiedTerminalHeaderProps) {
    const { enabledTools } = useAgentTools()
    const [isDragTarget, setIsDragTarget] = useState(false)
    const isAgentMode = slot.type === 'project' && slot.activeMode !== 'shell'
    const shouldShowClean = showCleanButton && isAgentMode
    const slotId = getSlotPanelId(slot)
    const slotName = getSlotName(slot)
    const canSwapByDrag = useMemo(
      () => !isMobile && !!onSwapWith && (allSlots?.length ?? 0) > 1,
      [allSlots, isMobile, onSwapWith],
    )

    const handleDragStart = useCallback(
      (event: DragEvent<HTMLButtonElement>) => {
        if (!canSwapByDrag) return
        setDraggedPaneSlotId(event, slotId)
      },
      [canSwapByDrag, slotId],
    )

    const handleDragEnd = useCallback(() => {
      setIsDragTarget(false)
    }, [])

    const handleDragOver = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        if (!canSwapByDrag) return
        const draggedSlotId = getDraggedPaneSlotId(event)
        if (!draggedSlotId || draggedSlotId === slotId) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setIsDragTarget(true)
      },
      [canSwapByDrag, slotId],
    )

    const handleDragLeave = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragTarget(false)
        }
      },
      [],
    )

    const handleDrop = useCallback(
      (event: DragEvent<HTMLDivElement>) => {
        if (!canSwapByDrag || !onSwapWith) return
        const draggedSlotId = getDraggedPaneSlotId(event)
        setIsDragTarget(false)
        if (!draggedSlotId || draggedSlotId === slotId) return
        event.preventDefault()
        onSwapWith(draggedSlotId)
      },
      [canSwapByDrag, onSwapWith, slotId],
    )

    return (
      <div
        data-testid={`terminal-header-${slotId}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'flex-shrink-0 flex items-center gap-1 transition-colors duration-150',
          isMobile ? 'h-9 px-1.5' : 'h-8 px-2',
          isDragTarget && 'ring-1 ring-inset ring-[var(--term-accent)]',
        )}
        style={{
          backgroundColor: isActive
            ? 'var(--term-bg-elevated)'
            : 'var(--term-bg-surface)',
          borderBottom: '1px solid var(--term-border)',
        }}
        title={
          canSwapByDrag
            ? `${slotName}: drag this header onto another pane to swap positions`
            : undefined
        }
      >
        {canSwapByDrag && (
          <button
            type="button"
            data-testid={`pane-drag-handle-${slotId}`}
            draggable={true}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={clsx(
              'flex items-center justify-center rounded transition-all duration-150',
              isMobile ? 'w-8 h-8' : 'w-6 h-6',
              'cursor-grab active:cursor-grabbing',
              'text-[var(--term-text-muted)] hover:bg-[var(--term-bg-elevated)] hover:text-[var(--term-accent)]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--term-accent)]',
            )}
            title={`Drag ${slotName} to swap panes`}
            aria-label={`Drag ${slotName} to swap panes`}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Mode toggle (shell <-> claude) - only for project slots */}
        {slot.type === 'project' && onModeSwitch && (
          <ModeToggle
            value={slot.activeMode}
            onChange={onModeSwitch}
            disabled={isModeSwitching}
            isLoading={isModeSwitching}
            isMobile={isMobile}
            agentTools={enabledTools}
          />
        )}

        {/* Terminal name/switcher */}
        <HeaderNameDisplay
          slot={slot}
          isActive={isActive}
          isMobile={isMobile}
          allSlots={allSlots}
          onSwapWith={onSwapWith}
          onSwitchTo={onSwitchTo}
          onSwitch={onSwitch}
        />

        {!isMobile && <PaneStatusBadge status={connectionStatus} />}

        {/* Add terminal button */}
        {onOpenModal && (
          <AddTerminalButton
            onOpenModal={onOpenModal}
            canAddPane={canAddPane}
            isMobile={isMobile}
          />
        )}

        {layoutMode &&
          onLayoutModeChange &&
          availableLayouts &&
          availableLayouts.length > 1 && (
          <LayoutModeButtons
            layoutMode={layoutMode}
            onLayoutChange={onLayoutModeChange}
            availableLayouts={availableLayouts}
          />
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          {shouldShowClean && onClean && (
            <HeaderIconButton
              icon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={onClean}
              tooltip="Clean prompt"
              isMobile={isMobile}
            />
          )}

          {onVoice && (
            <HeaderIconButton
              icon={<Mic className="w-3.5 h-3.5" />}
              onClick={onVoice}
              tooltip="Voice input"
              isMobile={isMobile}
            />
          )}

          {onUpload && (
            <HeaderIconButton
              icon={<Paperclip className="w-3.5 h-3.5" />}
              onClick={onUpload}
              tooltip="Upload file"
              isMobile={isMobile}
            />
          )}

          {onSettings && (
            <HeaderIconButton
              icon={<Settings className="w-3.5 h-3.5" />}
              onClick={onSettings}
              tooltip="Settings"
              isMobile={isMobile}
            />
          )}

          {onReset && (
            <HeaderIconButton
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onReset}
              tooltip="Reset terminal"
              isMobile={isMobile}
            />
          )}

          {onClose && (
            <HeaderIconButton
              icon={<X className="w-3.5 h-3.5" />}
              onClick={onClose}
              tooltip="Close terminal"
              variant="danger"
              isMobile={isMobile}
            />
          )}

          {(onResetAll || onCloseAll) && (
            <PaneOverflowMenu
              onResetAll={onResetAll}
              onCloseAll={onCloseAll}
              isMobile={isMobile}
            />
          )}
        </div>
      </div>
    )
  },
)
