'use client'

import { Group, Panel, useGroupRef } from 'react-resizable-panels'
import { getSlotPanelId } from '@/lib/utils/slot'
import { ResizeSeparator } from './ResizeSeparator'
import type { LayoutHelperProps } from './types'

function buildColumns(displaySlots: LayoutHelperProps['displaySlots']) {
  if (displaySlots.length === 4) {
    return displaySlots.map((slot) => [slot])
  }

  const leftColumnSize = Math.ceil(displaySlots.length / 2)
  return [
    displaySlots.slice(0, leftColumnSize),
    displaySlots.slice(leftColumnSize),
  ]
}

function ColumnGroup({
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
  const columnGroupRef = useGroupRef()

  if (slots.length === 1) {
    return renderPane(slots[0], startIndex)
  }

  const panelIds = slots.map((slot) => getSlotPanelId(slot))

  return (
    <Group
      orientation="vertical"
      onLayoutChange={handleLayoutChange}
      groupRef={columnGroupRef}
      className="h-full"
    >
      {slots.flatMap((slot, rowIndex) => {
        const panelId = panelIds[rowIndex]
        const panelNode = (
          <Panel
            key={panelId}
            id={panelId}
            minSize={`${getMinSizePercent('vertical')}%`}
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
            orientation="vertical"
            groupRef={columnGroupRef}
            adjacentPanelIds={[panelId, panelIds[rowIndex + 1]]}
          />,
        ]
      })}
    </Group>
  )
}

export function ColumnPaneLayout({
  containerRef,
  displaySlots,
  getMinSizePercent,
  handleLayoutChange,
  renderPane,
}: LayoutHelperProps) {
  const rowGroupRef = useGroupRef()
  const columns = buildColumns(displaySlots)

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ backgroundColor: 'var(--term-bg-deep)' }}
    >
      <Group
        orientation="horizontal"
        groupRef={rowGroupRef}
        className="h-full"
      >
        {columns.flatMap((columnSlots, columnIndex) => {
          const startIndex = columns
            .slice(0, columnIndex)
            .reduce((total, nextColumn) => total + nextColumn.length, 0)
          const columnKey = columnSlots.map((slot) => getSlotPanelId(slot)).join('-')
          const columnNode = (
            <ColumnGroup
              key={columnKey}
              slots={columnSlots}
              startIndex={startIndex}
              renderPane={renderPane}
              getMinSizePercent={getMinSizePercent}
              handleLayoutChange={handleLayoutChange}
            />
          )

          if (columnIndex === columns.length - 1) return [columnNode]

          const currentPanelId =
            columnSlots.length === 1
              ? getSlotPanelId(columnSlots[0])
              : `column-${columnIndex}`
          const nextColumn = columns[columnIndex + 1]
          const nextPanelId =
            nextColumn.length === 1
              ? getSlotPanelId(nextColumn[0])
              : `column-${columnIndex + 1}`

          return [
            <Panel
              key={currentPanelId}
              id={currentPanelId}
              minSize={`${getMinSizePercent('horizontal')}%`}
              defaultSize={`${100 / columns.length}%`}
              className="h-full"
            >
              {columnNode}
            </Panel>,
            <ResizeSeparator
              key={`separator-${currentPanelId}`}
              orientation="horizontal"
              groupRef={rowGroupRef}
              adjacentPanelIds={[currentPanelId, nextPanelId]}
            />,
          ]
        })}
      </Group>
    </div>
  )
}
