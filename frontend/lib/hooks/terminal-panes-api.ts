import { apiFetch } from '../api-fetch'
import type {
  BulkLayoutUpdateRequest,
  CreatePaneRequest,
  PaneCountResponse,
  PaneListResponse,
  SwapPanesRequest,
  TerminalPane,
  UpdatePaneRequest,
} from './terminal-panes-types'

export async function fetchPanes(): Promise<PaneListResponse> {
  return apiFetch('/api/terminal/panes')
}

export async function fetchPaneCount(): Promise<PaneCountResponse> {
  return apiFetch('/api/terminal/panes/count')
}

export async function createPane(
  request: CreatePaneRequest,
): Promise<TerminalPane> {
  return apiFetch('/api/terminal/panes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export async function updatePane(
  paneId: string,
  request: UpdatePaneRequest,
): Promise<TerminalPane> {
  return apiFetch(`/api/terminal/panes/${paneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export async function deletePane(paneId: string): Promise<void> {
  await apiFetch(
    `/api/terminal/panes/${paneId}`,
    { method: 'DELETE' },
    'Failed to delete pane',
  )
}

export async function swapPanes(request: SwapPanesRequest): Promise<void> {
  await apiFetch(
    '/api/terminal/panes/swap',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    'Failed to swap panes',
  )
}

export async function updateAllLayouts(
  request: BulkLayoutUpdateRequest,
): Promise<TerminalPane[]> {
  return apiFetch('/api/terminal/layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}
