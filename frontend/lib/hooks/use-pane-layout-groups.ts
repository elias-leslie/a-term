'use client'

import { useCallback, useEffect, useState } from 'react'

export type PaneLayoutGroups = Record<string, number[]>

function sameSizes(left: number[] | undefined, right: number[]): boolean {
  if (!left || left.length !== right.length) return false
  return left.every((size, index) => Math.abs(size - right[index]) < 0.01)
}

function readPaneLayoutGroups(storageKey: string): PaneLayoutGroups {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? (JSON.parse(stored) as PaneLayoutGroups) : {}
  } catch {
    return {}
  }
}

export function usePaneLayoutGroups(storageKey: string) {
  const [groups, setGroups] = useState<PaneLayoutGroups>(() =>
    readPaneLayoutGroups(storageKey),
  )

  useEffect(() => {
    setGroups(readPaneLayoutGroups(storageKey))
  }, [storageKey])

  const updateGroupSizes = useCallback(
    (groupId: string, sizes: number[]) => {
      setGroups((current) => {
        if (sameSizes(current[groupId], sizes)) {
          return current
        }

        const next = { ...current, [groupId]: sizes }
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // Ignore storage failures and keep the in-memory state.
        }
        return next
      })
    },
    [storageKey],
  )

  const getGroupSizes = useCallback(
    (groupId: string, panelCount: number, defaultSize: number) => {
      const stored = groups[groupId]
      if (stored && stored.length === panelCount) {
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
