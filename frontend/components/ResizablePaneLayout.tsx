'use client'

import { useMemo, useRef } from 'react'
import { MAX_PANES } from '@/lib/constants/terminal'
import {
  useLayoutChangeHandler,
  useMinSizeCalculator,
  usePaneRenderer,
} from '@/lib/hooks/pane-layout'
import { usePaneLayoutGroups } from '@/lib/hooks/use-pane-layout-groups'
import { getSlotPanelId } from '@/lib/utils/slot'
import type { ResizablePaneLayoutProps } from '@/types/pane-layout'
import {
  ColumnPaneLayout,
  EmptyPaneState,
  FourPaneLayout,
  SinglePaneLayout,
  ThreePaneLayout,
  TwoPaneLayout,
  WidePaneLayout,
} from './pane-layouts'

/**
 * Resizable pane layout using react-resizable-panels.
 * Dynamically adapts grid based on pane count:
 * - 1 pane: full size
 * - 2 panes: side-by-side or stacked split
 * - 3 panes: top/bottom or left/right stack
 * - 4 panes: 2x2 grid or 4 columns
 * - 5-6 panes: 3x2 wide grid or 2x3 columns
 *
 * On mobile: always renders a single full-size pane (the active one).
 */
export function ResizablePaneLayout(props: ResizablePaneLayoutProps) {
  const {
    slots,
    isMobile,
    activeSessionId,
    onLayoutChange,
    onOpenModal,
    layoutMode = 'split-horizontal',
  } = props

  const displaySlots = useMemo(() => slots.slice(0, MAX_PANES), [slots])
  const paneCount = displaySlots.length
  const containerRef = useRef<HTMLDivElement>(null)
  const layoutStorageKey = `terminal-layout-groups:${layoutMode}:${paneCount}`

  const getMinSizePercent = useMinSizeCalculator(containerRef)
  const handleLayoutChange = useLayoutChangeHandler(
    displaySlots,
    paneCount,
    onLayoutChange,
  )
  const { getGroupSizes, updateGroupSizes } =
    usePaneLayoutGroups(layoutStorageKey)
  const renderPane = usePaneRenderer({ props, displaySlots, paneCount })
  const displaySlotPanelIds = useMemo(
    () => new Set(displaySlots.map((slot) => getSlotPanelId(slot))),
    [displaySlots],
  )
  const getStoredGroupLayout = useMemo(
    () => (groupId: string, panelCountForGroup: number, defaultSize: number) =>
      getGroupSizes(groupId, panelCountForGroup, defaultSize),
    [getGroupSizes],
  )
  const createGroupLayoutChangeHandler = useMemo(
    () =>
      (groupId: string, panelIds: string[], persistPaneLayouts = false) =>
      (layout: Record<string, number>) => {
        const sizes = panelIds.map(
          (panelId) => layout[panelId] ?? 100 / panelIds.length,
        )
        updateGroupSizes(groupId, sizes)

        if (
          persistPaneLayouts &&
          panelIds.every((panelId) => displaySlotPanelIds.has(panelId))
        ) {
          handleLayoutChange(layout)
        }
      },
    [displaySlotPanelIds, handleLayoutChange, updateGroupSizes],
  )
  const layoutHelpers = {
    getStoredGroupLayout,
    createGroupLayoutChangeHandler,
  }

  if (paneCount === 0) {
    return (
      <EmptyPaneState containerRef={containerRef} onOpenModal={onOpenModal} />
    )
  }

  // Mobile: always show single full-size pane (the active one)
  if (isMobile) {
    const activeSlot = activeSessionId
      ? displaySlots.find(
          (s) =>
            (s.type === 'project' && s.activeSessionId === activeSessionId) ||
            (s.type === 'adhoc' && s.sessionId === activeSessionId),
        )
      : undefined

    return (
      <SinglePaneLayout
        containerRef={containerRef}
        slot={activeSlot ?? displaySlots[0]}
        renderPane={renderPane}
      />
    )
  }

  if (paneCount === 1) {
    return (
      <SinglePaneLayout
        containerRef={containerRef}
        slot={displaySlots[0]}
        renderPane={renderPane}
      />
    )
  }

  if (paneCount === 2) {
    return (
      <TwoPaneLayout
        containerRef={containerRef}
        displaySlots={displaySlots}
        getMinSizePercent={getMinSizePercent}
        handleLayoutChange={handleLayoutChange}
        {...layoutHelpers}
        renderPane={renderPane}
        orientation={
          layoutMode === 'split-vertical' ? 'vertical' : 'horizontal'
        }
      />
    )
  }

  if (paneCount === 3) {
    return (
      <ThreePaneLayout
        containerRef={containerRef}
        displaySlots={displaySlots}
        getMinSizePercent={getMinSizePercent}
        handleLayoutChange={handleLayoutChange}
        {...layoutHelpers}
        renderPane={renderPane}
        orientation={
          layoutMode === 'split-vertical' ? 'vertical' : 'horizontal'
        }
      />
    )
  }

  if (paneCount <= 4) {
    if (layoutMode === 'grid-4x1') {
      return (
        <ColumnPaneLayout
          containerRef={containerRef}
          displaySlots={displaySlots}
          getMinSizePercent={getMinSizePercent}
          handleLayoutChange={handleLayoutChange}
          {...layoutHelpers}
          renderPane={renderPane}
        />
      )
    }

    return (
      <FourPaneLayout
        containerRef={containerRef}
        displaySlots={displaySlots}
        getMinSizePercent={getMinSizePercent}
        handleLayoutChange={handleLayoutChange}
        {...layoutHelpers}
        renderPane={renderPane}
      />
    )
  }

  return layoutMode === 'grid-2x3' ? (
    <ColumnPaneLayout
      containerRef={containerRef}
      displaySlots={displaySlots}
      getMinSizePercent={getMinSizePercent}
      handleLayoutChange={handleLayoutChange}
      {...layoutHelpers}
      renderPane={renderPane}
    />
  ) : (
    <WidePaneLayout
      containerRef={containerRef}
      displaySlots={displaySlots}
      getMinSizePercent={getMinSizePercent}
      handleLayoutChange={handleLayoutChange}
      {...layoutHelpers}
      renderPane={renderPane}
    />
  )
}

export type { PaneLayout, ResizablePaneLayoutProps } from '@/types/pane-layout'
