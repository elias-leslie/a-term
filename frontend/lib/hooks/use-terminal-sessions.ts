'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { apiFetch } from '../api-fetch'
import { buildApiUrl } from '../api-config'

export interface TerminalSession {
  id: string
  name: string
  user_id: string | null
  project_id: string | null
  working_dir: string | null
  mode: string
  display_order: number
  is_alive: boolean
  created_at: string | null
  last_accessed_at: string | null
  claude_state?: 'not_started' | 'starting' | 'running' | 'stopped' | 'error'
}

interface SessionListResponse {
  items: TerminalSession[]
  total: number
}

interface UpdateSessionRequest {
  name?: string
  display_order?: number
}

const jsonHeaders = { 'Content-Type': 'application/json' }

const fetchSessions = async (): Promise<TerminalSession[]> =>
  (await apiFetch<SessionListResponse>('/api/terminal/sessions')).items

const updateSession = (sessionId: string, req: UpdateSessionRequest) =>
  apiFetch<TerminalSession>(`/api/terminal/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(req),
  })

const deleteSession = async (sessionId: string): Promise<void> => {
  const res = await fetch(buildApiUrl(`/api/terminal/sessions/${sessionId}`), {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete session')
}

const resetSession = (sessionId: string) =>
  apiFetch<TerminalSession>(`/api/terminal/sessions/${sessionId}/reset`, { method: 'POST' })

const resetAllSessions = () =>
  apiFetch<{ reset_count: number }>('/api/terminal/reset-all', { method: 'POST' })

const invalidatePanesAndSessions = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['terminal-panes'] })
  queryClient.invalidateQueries({ queryKey: ['terminal-sessions'] })
}

/** Hook for managing terminal sessions with backend sync */
export function useTerminalSessions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['terminal-sessions'] })

  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['terminal-sessions'],
    queryFn: fetchSessions,
  })

  const updateMutation = useMutation({
    mutationFn: ({ sessionId, ...request }: UpdateSessionRequest & { sessionId: string }) =>
      updateSession(sessionId, request),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      invalidate()
    },
  })

  const resetMutation = useMutation({
    mutationFn: resetSession,
    onMutate: async (oldSessionId) => {
      await queryClient.cancelQueries({ queryKey: ['terminal-sessions'] })
      return {
        oldSessionId,
        previousSessions: queryClient.getQueryData<TerminalSession[]>(['terminal-sessions']),
      }
    },
    onSuccess: (newSession, oldSessionId) => {
      queryClient.setQueryData<TerminalSession[]>(
        ['terminal-sessions'],
        (old) => (old ? [...old.filter((s) => s.id !== oldSessionId), newSession] : [newSession]),
      )
    },
    onError: (_err, _oldSessionId, ctx) =>
      ctx?.previousSessions &&
      queryClient.setQueryData(['terminal-sessions'], ctx.previousSessions),
    onSettled: invalidate,
  })

  const resetAllMutation = useMutation({
    mutationFn: resetAllSessions,
    onSuccess: () => invalidatePanesAndSessions(queryClient),
  })

  const update = useCallback(
    (sessionId: string, updates: UpdateSessionRequest) =>
      updateMutation.mutateAsync({ sessionId, ...updates }),
    [updateMutation],
  )

  const remove = useCallback(
    (sessionId: string) => deleteMutation.mutateAsync(sessionId),
    [deleteMutation],
  )

  const reset = useCallback(
    (sessionId: string) => resetMutation.mutateAsync(sessionId),
    [resetMutation],
  )

  const resetAll = useCallback(() => resetAllMutation.mutateAsync(), [resetAllMutation])

  return {
    sessions,
    update,
    remove,
    reset,
    resetAll,
    isLoading,
    isError,
    error,
    isDeleting: deleteMutation.isPending,
    isResetting: resetMutation.isPending || resetAllMutation.isPending,
  }
}
