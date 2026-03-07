'use client'

import { useMemo, useRef } from 'react'
import { MAX_PANES } from '@/lib/constants/terminal'
import type { ResizablePaneLayoutProps } from '@/types/pane-layout'
import {
  useMinSizeCalculator,
  usePaneRenderer,
  useLayoutChangeHandler,
} from '@/lib/hooks/pane-layout'
import {
  EmptyPaneState,
  SinglePaneLayout,
  TwoPaneLayout,
  ThreePaneLayout,
  FourPaneLayout,
  WidePaneLayout,
  ColumnPaneLayout,
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

  const getMinSizePercent = useMinSizeCalculator(containerRef)
  const handleLayoutChange = useLayoutChangeHandler(
    displaySlots,
    paneCount,
    onLayoutChange,
  )
  const renderPane = usePaneRenderer({ props, displaySlots, paneCount })

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
        renderPane={renderPane}
      />
    )
  }

  return (
    layoutMode === 'grid-2x3' ? (
      <ColumnPaneLayout
        containerRef={containerRef}
        displaySlots={displaySlots}
        getMinSizePercent={getMinSizePercent}
        handleLayoutChange={handleLayoutChange}
        renderPane={renderPane}
      />
    ) : (
      <WidePaneLayout
        containerRef={containerRef}
        displaySlots={displaySlots}
        getMinSizePercent={getMinSizePercent}
        handleLayoutChange={handleLayoutChange}
        renderPane={renderPane}
      />
    )
  )
}

export type { ResizablePaneLayoutProps, PaneLayout } from '@/types/pane-layout'
