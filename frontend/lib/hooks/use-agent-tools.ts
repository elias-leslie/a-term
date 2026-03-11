'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { buildApiUrl } from '../api-config'
import type { TerminalPane } from './use-terminal-panes'

// ============================================================================
// Types
// ============================================================================

export interface AgentTool {
  id: string
  name: string
  slug: string
  command: string
  process_name: string
  description: string | null
  color: string | null
  display_order: number
  is_default: boolean
  enabled: boolean
  created_at: string | null
  updated_at: string | null
}

interface CreateAgentToolInput {
  name: string
  slug: string
  command: string
  process_name: string
  description?: string
  color?: string
  display_order?: number
  is_default?: boolean
  enabled?: boolean
}

interface UpdateAgentToolInput {
  name?: string
  command?: string
  process_name?: string
  description?: string
  color?: string
  display_order?: number
  is_default?: boolean
  enabled?: boolean
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchAgentTools(): Promise<AgentTool[]> {
  const res = await fetch(buildApiUrl('/api/terminal/agent-tools'))
  if (!res.ok) throw new Error('Failed to fetch agent tools')
  return res.json()
}

async function createAgentTool(input: CreateAgentToolInput): Promise<AgentTool> {
  const res = await fetch(buildApiUrl('/api/terminal/agent-tools'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to create agent tool' }))
    throw new Error(error.detail || 'Failed to create agent tool')
  }
  return res.json()
}

async function updateAgentTool(
  toolId: string,
  input: UpdateAgentToolInput,
): Promise<AgentTool> {
  const res = await fetch(buildApiUrl(`/api/terminal/agent-tools/${toolId}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to update agent tool' }))
    throw new Error(error.detail || 'Failed to update agent tool')
  }
  return res.json()
}

async function deleteAgentTool(toolId: string): Promise<void> {
  const res = await fetch(buildApiUrl(`/api/terminal/agent-tools/${toolId}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to delete agent tool' }))
    throw new Error(error.detail || 'Failed to delete agent tool')
  }
}

async function switchPaneAgentTool(
  paneId: string,
  agentToolSlug: string,
): Promise<TerminalPane> {
  const res = await fetch(
    buildApiUrl(`/api/terminal/panes/${paneId}/agent-tool`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_tool_slug: agentToolSlug }),
    },
  )
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to switch agent tool' }))
    throw new Error(error.detail || 'Failed to switch agent tool')
  }
  return res.json()
}

// ============================================================================
// Hook
// ============================================================================

export function useAgentTools() {
  const queryClient = useQueryClient()

  const {
    data: agentTools = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['agent-tools'],
    queryFn: fetchAgentTools,
    staleTime: 60000,
  })

  const enabledTools = agentTools.filter((t) => t.enabled)
  const defaultTool = agentTools.find((t) => t.is_default) ?? enabledTools[0]

  const createMutation = useMutation({
    mutationFn: createAgentTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ toolId, ...input }: UpdateAgentToolInput & { toolId: string }) =>
      updateAgentTool(toolId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAgentTool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-tools'] })
    },
  })

  const switchToolMutation = useMutation({
    mutationFn: ({ paneId, slug }: { paneId: string; slug: string }) =>
      switchPaneAgentTool(paneId, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminal-panes'] })
      queryClient.invalidateQueries({ queryKey: ['terminal-sessions'] })
    },
  })

  const create = useCallback(
    async (input: CreateAgentToolInput) => createMutation.mutateAsync(input),
    [createMutation],
  )

  const update = useCallback(
    async (toolId: string, input: UpdateAgentToolInput) =>
      updateMutation.mutateAsync({ toolId, ...input }),
    [updateMutation],
  )

  const remove = useCallback(
    async (toolId: string) => deleteMutation.mutateAsync(toolId),
    [deleteMutation],
  )

  const switchTool = useCallback(
    async (paneId: string, slug: string) =>
      switchToolMutation.mutateAsync({ paneId, slug }),
    [switchToolMutation],
  )

  return {
    agentTools,
    enabledTools,
    defaultTool,
    create,
    update,
    remove,
    switchTool,
    isLoading,
    isError,
    error,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      switchToolMutation.isPending,
  }
}
