'use client'

import { Group, Panel, useGroupRef } from 'react-resizable-panels'
import { getSlotPanelId } from '@/lib/utils/slot'
import { ResizeSeparator } from './ResizeSeparator'
import type { LayoutHelperProps } from './types'

/**
 * Two-pane horizontal layout with double-click reset.
 */
export function TwoPaneLayout({
  containerRef,
  displaySlots,
  getMinSizePercent,
  createGroupLayoutChangeHandler,
  getStoredGroupLayout,
  renderPane,
  orientation = 'horizontal',
}: LayoutHelperProps) {
  const groupRef = useGroupRef()
  const panelIds: [string, string] = [
    getSlotPanelId(displaySlots[0]),
    getSlotPanelId(displaySlots[1]),
  ]
  const groupId = `two-pane-${orientation}`
  const panelSizes = getStoredGroupLayout(groupId, 2, 50)

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ backgroundColor: 'var(--term-bg-deep)' }}
    >
      <Group
        orientation={orientation}
        onLayoutChange={createGroupLayoutChangeHandler(groupId, panelIds, true)}
        groupRef={groupRef}
        className="h-full"
      >
        <Panel
          id={panelIds[0]}
          minSize={`${getMinSizePercent(orientation)}%`}
          defaultSize={`${panelSizes[0]}%`}
          className="h-full"
        >
          {renderPane(displaySlots[0], 0)}
        </Panel>

        <ResizeSeparator
          orientation={orientation}
          groupRef={groupRef}
          adjacentPanelIds={panelIds}
        />

        <Panel
          id={panelIds[1]}
          minSize={`${getMinSizePercent(orientation)}%`}
          defaultSize={`${panelSizes[1]}%`}
          className="h-full"
        >
          {renderPane(displaySlots[1], 1)}
        </Panel>
      </Group>
    </div>
  )
}
