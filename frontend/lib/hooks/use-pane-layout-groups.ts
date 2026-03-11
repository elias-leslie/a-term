'use client'

import { useCallback, useEffect, useState } from 'react'

export type PaneLayoutGroups = Record<string, number[]>
interface PaneLayoutGroupState {
  storageKey: string
  groups: PaneLayoutGroups
}

function sameSizes(left: number[] | undefined, right: number[]): boolean {
  if (!left || left.length !== right.length) return false
  return left.every((size, index) => Math.abs(size - right[index]) < 0.01)
}

function readPaneLayoutGroups(storageKey: string): PaneLayoutGroups {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as PaneLayoutGroups
  } catch {
    return {}
  }
}

export function usePaneLayoutGroups(storageKey: string) {
  const [state, setState] = useState<PaneLayoutGroupState>(() => ({
    storageKey,
    groups: readPaneLayoutGroups(storageKey),
  }))
  const groups =
    state.storageKey === storageKey
      ? state.groups
      : readPaneLayoutGroups(storageKey)

  useEffect(() => {
    setState({
      storageKey,
      groups: readPaneLayoutGroups(storageKey),
    })
  }, [storageKey])

  const updateGroupSizes = useCallback(
    (groupId: string, sizes: number[]) => {
      setState((current) => {
        const currentGroups =
          current.storageKey === storageKey
            ? current.groups
            : readPaneLayoutGroups(storageKey)

        if (sameSizes(currentGroups[groupId], sizes)) {
          return current
        }

        const nextGroups = { ...currentGroups, [groupId]: sizes }
        try {
          localStorage.setItem(storageKey, JSON.stringify(nextGroups))
        } catch {
          // Ignore storage failures and keep the in-memory state.
        }
        return {
          storageKey,
          groups: nextGroups,
        }
      })
    },
    [storageKey],
  )

  const getGroupSizes = useCallback(
    (groupId: string, panelCount: number, defaultSize: number) => {
      const stored = groups[groupId]
      if (
        stored &&
        stored.length === panelCount &&
        stored.every((v) => Number.isFinite(v))
      ) {
        return stored
      }
      return Array.from({ length: panelCount }, () => defaultSize)
    },
    [groups],
  )

  return {
    getGroupSizes,
    updateGroupSizes,
  }
}
