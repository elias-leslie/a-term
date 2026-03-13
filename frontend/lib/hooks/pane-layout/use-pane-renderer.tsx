import { useCallback, useState, type DragEvent } from 'react'
import { clsx } from 'clsx'
import type { PaneSlot, TerminalSlot } from '@/lib/utils/slot'
import {
  getSlotSessionId,
  getSlotWorkingDir,
  getSlotPanelId,
} from '@/lib/utils/slot'
import {
  clearDraggedPaneSlotId,
  getDraggedPaneSlotId,
  isPaneSwapDragEvent,
} from '@/lib/utils/pane-swap-dnd'
import { TerminalComponent } from '@/components/Terminal'
import { UnifiedTerminalHeader } from '@/components/UnifiedTerminalHeader'
import type { ResizablePaneLayoutProps } from '@/types/pane-layout'

interface UsePaneRendererOptions {
  props: Pick<
    ResizablePaneLayoutProps,
    | 'onSwitch'
    | 'onSettings'
    | 'onReset'
    | 'onClose'
    | 'onUpload'
    | 'onClean'
    | 'onOpenModal'
    | 'canAddPane'
    | 'onModeSwitch'
    | 'isModeSwitching'
    | 'isMobile'
    | 'onSwapPanes'
    | 'onTerminalRef'
    | 'fontFamily'
    | 'fontSize'
    | 'scrollback'
    | 'cursorStyle'
    | 'cursorBlink'
    | 'theme'
    | 'onStatusChange'
    | 'onVoice'
    | 'layoutMode'
    | 'availableLayouts'
    | 'onLayoutModeChange'
    | 'terminalStatuses'
  >
  displaySlots: (TerminalSlot | PaneSlot)[]
  paneCount: number
}

/**
 * Hook to create the renderPane function for individual pane rendering.
 */
export function usePaneRenderer({
  props,
  displaySlots,
  paneCount,
}: UsePaneRendererOptions) {
  const {
    onSwitch,
    onSettings,
    onReset,
    onClose,
    onUpload,
    onClean,
    onOpenModal,
    canAddPane,
    onModeSwitch,
    isModeSwitching,
    isMobile,
    onSwapPanes,
    onTerminalRef,
    fontFamily,
    fontSize,
    scrollback,
    cursorStyle,
    cursorBlink,
    theme,
    onStatusChange,
    onVoice,
    layoutMode,
    availableLayouts,
    onLayoutModeChange,
    terminalStatuses,
  } = props
  const [dragTargetPanelId, setDragTargetPanelId] = useState<string | null>(null)

  const renderPane = useCallback(
    (slot: TerminalSlot | PaneSlot, _index: number) => {
      const sessionId = getSlotSessionId(slot)
      const workingDir = getSlotWorkingDir(slot)
      const panelId = getSlotPanelId(slot)
      const isExternalSlot = slot.type === 'adhoc' && slot.isExternal
      const canResetSlot = !isExternalSlot
      const canCleanSlot =
        (slot.type === 'project' && slot.activeMode !== 'shell') || isExternalSlot
      const canSwapByDrop = !!onSwapPanes && paneCount > 1
      const isDragTarget = dragTargetPanelId === panelId

      const handlePaneDragOver = (event: DragEvent<HTMLDivElement>) => {
        if (!canSwapByDrop) return
        if (!isPaneSwapDragEvent(event)) return
        const draggedSlotId = getDraggedPaneSlotId(event)
        if (!draggedSlotId || draggedSlotId === panelId) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDragTargetPanelId(panelId)
      }

      const handlePaneDragLeave = (event: DragEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragTargetPanelId((currentId) =>
            currentId === panelId ? null : currentId,
          )
        }
      }

      const handlePaneDrop = (event: DragEvent<HTMLDivElement>) => {
        if (!canSwapByDrop || !onSwapPanes) return
        const draggedSlotId = getDraggedPaneSlotId(event)
        clearDraggedPaneSlotId()
        setDragTargetPanelId(null)
        if (!draggedSlotId || draggedSlotId === panelId) return
        event.preventDefault()
        onSwapPanes(panelId, draggedSlotId)
      }

      return (
        <div
          data-testid={`pane-drop-target-${panelId}`}
          onDragOver={handlePaneDragOver}
          onDragLeave={handlePaneDragLeave}
          onDrop={handlePaneDrop}
          className={clsx(
            'flex flex-col h-full min-h-0 overflow-hidden rounded-md transition-colors duration-150',
            isDragTarget && 'ring-1 ring-[var(--term-accent)]',
          )}
          style={{
            backgroundColor: 'var(--term-bg-surface)',
            border: '1px solid var(--term-border)',
          }}
        >
          <UnifiedTerminalHeader
            slot={slot}
            showCleanButton={canCleanSlot}
            onSwitch={onSwitch ? () => onSwitch(slot) : undefined}
            onSettings={onSettings}
            onReset={onReset && canResetSlot ? () => onReset(slot) : undefined}
            onClose={onClose ? () => onClose(slot) : undefined}
            closeTooltip={isExternalSlot ? 'Detach terminal' : 'Close terminal'}
            onUpload={onUpload ? () => onUpload(sessionId ?? undefined) : undefined}
            onClean={onClean ? () => onClean(slot) : undefined}
            onOpenModal={onOpenModal}
            canAddPane={canAddPane}
            onModeSwitch={
              onModeSwitch ? (mode) => onModeSwitch(slot, mode) : undefined
            }
            isModeSwitching={isModeSwitching}
            onVoice={onVoice ? () => onVoice(sessionId ?? undefined) : undefined}
            isMobile={isMobile}
            allSlots={paneCount > 1 ? displaySlots : undefined}
            onSwapWith={
              onSwapPanes && paneCount > 1
                ? (otherSlotId) => onSwapPanes(panelId, otherSlotId)
                : undefined
            }
            onSwitchTo={
              isMobile && onSwitch && paneCount > 1
                ? (targetSlot) => onSwitch(targetSlot)
                : undefined
            }
            layoutMode={layoutMode}
            availableLayouts={availableLayouts}
            onLayoutModeChange={onLayoutModeChange}
            connectionStatus={sessionId ? terminalStatuses?.get(sessionId) : undefined}
          />

          <div
            className="flex-1 min-h-0 overflow-hidden relative"
            style={{ backgroundColor: 'var(--term-bg-deep)' }}
          >
            {sessionId ? (
              <TerminalComponent
                key={sessionId}
                ref={(handle) => onTerminalRef?.(sessionId, handle)}
                sessionId={sessionId}
                workingDir={workingDir || undefined}
                className="h-full"
                fontFamily={fontFamily}
                fontSize={fontSize}
                scrollback={scrollback}
                cursorStyle={cursorStyle}
                cursorBlink={cursorBlink}
                theme={theme}
                onStatusChange={(status) => onStatusChange?.(sessionId, status)}
              />
            ) : (
              <div
                className="flex items-center justify-center h-full text-xs"
                style={{ color: 'var(--term-text-muted)' }}
              >
                Click tab to start session
              </div>
            )}
          </div>
        </div>
      )
    },
    [
      onSwitch,
      onSettings,
      onReset,
      onClose,
      onUpload,
      onClean,
      onOpenModal,
      canAddPane,
      onModeSwitch,
      isModeSwitching,
      isMobile,
      displaySlots,
      paneCount,
      onSwapPanes,
      onTerminalRef,
      fontFamily,
      fontSize,
      scrollback,
      cursorStyle,
      cursorBlink,
      theme,
      onStatusChange,
      onVoice,
      layoutMode,
      availableLayouts,
      onLayoutModeChange,
      terminalStatuses,
      dragTargetPanelId,
    ],
  )

  return renderPane
}
