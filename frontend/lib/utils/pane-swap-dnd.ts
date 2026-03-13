import type { DragEvent } from 'react'

export const PANE_SWAP_DRAG_MIME_TYPE = 'application/x-terminal-pane-slot'

export function setDraggedPaneSlotId(
  event: DragEvent<HTMLElement>,
  slotId: string,
): void {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(PANE_SWAP_DRAG_MIME_TYPE, slotId)
}

export function getDraggedPaneSlotId(
  event: DragEvent<HTMLElement>,
): string {
  return event.dataTransfer?.getData(PANE_SWAP_DRAG_MIME_TYPE) ?? ''
}
