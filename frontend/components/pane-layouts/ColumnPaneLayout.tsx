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
  createGroupLayoutChangeHandler,
  getStoredGroupLayout,
  groupId,
}: {
  slots: LayoutHelperProps['displaySlots']
  startIndex: number
  renderPane: LayoutHelperProps['renderPane']
  getMinSizePercent: LayoutHelperProps['getMinSizePercent']
  createGroupLayoutChangeHandler: LayoutHelperProps['createGroupLayoutChangeHandler']
  getStoredGroupLayout: LayoutHelperProps['getStoredGroupLayout']
  groupId: string
}) {
  const columnGroupRef = useGroupRef()

  if (slots.length === 1) {
    return renderPane(slots[0], startIndex)
  }

  const panelIds = slots.map((slot) => getSlotPanelId(slot))
  const panelSizes = getStoredGroupLayout(groupId, slots.length, 100 / slots.length)

  return (
    <Group
      orientation="vertical"
      onLayoutChange={createGroupLayoutChangeHandler(groupId, panelIds, true)}
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
            defaultSize={`${panelSizes[rowIndex] ?? 100 / slots.length}%`}
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
  createGroupLayoutChangeHandler,
  getStoredGroupLayout,
  renderPane,
}: LayoutHelperProps) {
  const rowGroupRef = useGroupRef()
  const columns = buildColumns(displaySlots)
  const rootGroupId = `column-pane-root-${displaySlots.length}`
  const columnSizes = getStoredGroupLayout(
    rootGroupId,
    columns.length,
    100 / columns.length,
  )
  const columnPanelIds = columns.map((columnSlots, columnIndex) =>
    columnSlots.length === 1
      ? getSlotPanelId(columnSlots[0])
      : `column-${displaySlots.length}-${columnIndex}`,
  )

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ backgroundColor: 'var(--term-bg-deep)' }}
    >
      <Group
        orientation="horizontal"
        onLayoutChange={createGroupLayoutChangeHandler(
          rootGroupId,
          columnPanelIds,
        )}
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
              createGroupLayoutChangeHandler={createGroupLayoutChangeHandler}
              getStoredGroupLayout={getStoredGroupLayout}
              groupId={`column-pane-${displaySlots.length}-${columnIndex}`}
            />
          )
          const currentPanelId = columnPanelIds[columnIndex]
          const panelNode = (
            <Panel
              key={currentPanelId}
              id={currentPanelId}
              minSize={`${getMinSizePercent('horizontal')}%`}
              defaultSize={`${columnSizes[columnIndex] ?? 100 / columns.length}%`}
              className="h-full"
            >
              {columnNode}
            </Panel>
          )

          if (columnIndex === columns.length - 1) return [panelNode]

          const nextPanelId = columnPanelIds[columnIndex + 1]

          return [
            panelNode,
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
