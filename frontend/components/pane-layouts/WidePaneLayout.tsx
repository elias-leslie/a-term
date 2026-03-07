'use client'

import { Group, Panel, useGroupRef } from 'react-resizable-panels'
import { getSlotPanelId } from '@/lib/utils/slot'
import { ResizeSeparator } from './ResizeSeparator'
import type { LayoutHelperProps } from './types'

function WidePaneRow({
  slots,
  startIndex,
  renderPane,
  getMinSizePercent,
  handleLayoutChange,
}: {
  slots: LayoutHelperProps['displaySlots']
  startIndex: number
  renderPane: LayoutHelperProps['renderPane']
  getMinSizePercent: LayoutHelperProps['getMinSizePercent']
  handleLayoutChange: LayoutHelperProps['handleLayoutChange']
}) {
  const rowGroupRef = useGroupRef()
  const panelIds = slots.map((slot) => getSlotPanelId(slot))

  return (
    <Group
      orientation="horizontal"
      onLayoutChange={handleLayoutChange}
      groupRef={rowGroupRef}
      className="h-full"
    >
      {slots.flatMap((slot, rowIndex) => {
        const panelId = panelIds[rowIndex]
        const panelNode = (
          <Panel
            key={panelId}
            id={panelId}
            minSize={`${getMinSizePercent('horizontal')}%`}
            defaultSize={`${100 / slots.length}%`}
            className="h-full"
          >
            {renderPane(slot, startIndex + rowIndex)}
          </Panel>
        )

        if (rowIndex === slots.length - 1) return [panelNode]

        return [
          panelNode,
          <ResizeSeparator
            key={`separator-${panelId}`}
            orientation="horizontal"
            groupRef={rowGroupRef}
            adjacentPanelIds={[panelId, panelIds[rowIndex + 1]]}
          />,
        ]
      })}
    </Group>
  )
}

export function WidePaneLayout({
  containerRef,
  displaySlots,
  getMinSizePercent,
  handleLayoutChange,
  renderPane,
}: LayoutHelperProps) {
  const verticalGroupRef = useGroupRef()
  const topRowSlots = displaySlots.slice(0, 3)
  const bottomRowSlots = displaySlots.slice(3)

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ backgroundColor: 'var(--term-bg-deep)' }}
    >
      <Group
        orientation="vertical"
        groupRef={verticalGroupRef}
        className="h-full"
      >
        <Panel
          id="wide-top-row"
          minSize={`${getMinSizePercent('vertical')}%`}
          defaultSize={bottomRowSlots.length > 0 ? '50%' : '100%'}
        >
          <WidePaneRow
            slots={topRowSlots}
            startIndex={0}
            renderPane={renderPane}
            getMinSizePercent={getMinSizePercent}
            handleLayoutChange={handleLayoutChange}
          />
        </Panel>

        {bottomRowSlots.length > 0 && (
          <>
            <ResizeSeparator
              orientation="vertical"
              groupRef={verticalGroupRef}
              adjacentPanelIds={['wide-top-row', 'wide-bottom-row']}
            />

            <Panel
              id="wide-bottom-row"
              minSize={`${getMinSizePercent('vertical')}%`}
              defaultSize="50%"
            >
              <WidePaneRow
                slots={bottomRowSlots}
                startIndex={topRowSlots.length}
                renderPane={renderPane}
                getMinSizePercent={getMinSizePercent}
                handleLayoutChange={handleLayoutChange}
              />
            </Panel>
          </>
        )}
      </Group>
    </div>
  )
}
