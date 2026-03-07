'use client'

import { Group, Panel, useGroupRef } from 'react-resizable-panels'
import { getSlotPanelId } from '@/lib/utils/slot'
import { ResizeSeparator } from './ResizeSeparator'
import type { LayoutHelperProps } from './types'

/**
 * Three-pane 2+1 layout with double-click reset.
 */
export function ThreePaneLayout({
  containerRef,
  displaySlots,
  getMinSizePercent,
  handleLayoutChange,
  renderPane,
  orientation = 'horizontal',
}: LayoutHelperProps) {
  const outerGroupRef = useGroupRef()
  const innerGroupRef = useGroupRef()
  const isVertical = orientation === 'vertical'
  const primaryPanelIds: [string, string] = isVertical
    ? [getSlotPanelId(displaySlots[1]), getSlotPanelId(displaySlots[2])]
    : [getSlotPanelId(displaySlots[0]), getSlotPanelId(displaySlots[1])]
  const secondaryPanelId = isVertical
    ? getSlotPanelId(displaySlots[0])
    : getSlotPanelId(displaySlots[2])
  const outerPrimaryId = isVertical ? secondaryPanelId : 'top-row'
  const outerSecondaryId = isVertical ? 'right-column' : secondaryPanelId

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ backgroundColor: 'var(--term-bg-deep)' }}
    >
      <Group
        orientation={isVertical ? 'horizontal' : 'vertical'}
        groupRef={outerGroupRef}
        className="h-full"
      >
        <Panel
          id={outerPrimaryId}
          minSize={`${getMinSizePercent(isVertical ? 'horizontal' : 'vertical')}%`}
          defaultSize="50%"
        >
          <Group
            orientation={isVertical ? 'vertical' : 'horizontal'}
            onLayoutChange={handleLayoutChange}
            groupRef={innerGroupRef}
            className="h-full"
          >
            <Panel
              id={primaryPanelIds[0]}
              minSize={`${getMinSizePercent(isVertical ? 'vertical' : 'horizontal')}%`}
              defaultSize="50%"
              className="h-full"
            >
              {renderPane(displaySlots[isVertical ? 1 : 0], isVertical ? 1 : 0)}
            </Panel>

            <ResizeSeparator
              orientation={isVertical ? 'vertical' : 'horizontal'}
              groupRef={innerGroupRef}
              adjacentPanelIds={primaryPanelIds}
            />

            <Panel
              id={primaryPanelIds[1]}
              minSize={`${getMinSizePercent(isVertical ? 'vertical' : 'horizontal')}%`}
              defaultSize="50%"
              className="h-full"
            >
              {renderPane(displaySlots[isVertical ? 2 : 1], isVertical ? 2 : 1)}
            </Panel>
          </Group>
        </Panel>

        <ResizeSeparator
          orientation={isVertical ? 'horizontal' : 'vertical'}
          groupRef={outerGroupRef}
          adjacentPanelIds={[outerPrimaryId, outerSecondaryId]}
        />

        <Panel
          id={outerSecondaryId}
          minSize={`${getMinSizePercent(isVertical ? 'horizontal' : 'vertical')}%`}
          defaultSize="50%"
        >
          {renderPane(displaySlots[isVertical ? 0 : 2], isVertical ? 0 : 2)}
        </Panel>
      </Group>
    </div>
  )
}
