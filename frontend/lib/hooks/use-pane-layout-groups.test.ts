import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { usePaneLayoutGroups } from './use-pane-layout-groups'

describe('usePaneLayoutGroups', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses the new storage bucket immediately when the storage key changes', () => {
    window.localStorage.setItem(
      'terminal-layout-groups:grid-3x2:5',
      JSON.stringify({
        'wide-pane-root': [70, 30],
      }),
    )
    window.localStorage.setItem(
      'terminal-layout-groups:grid-3x2:6',
      JSON.stringify({
        'wide-pane-root': [45, 55],
      }),
    )

    const { result, rerender } = renderHook(
      ({ storageKey }: { storageKey: string }) => usePaneLayoutGroups(storageKey),
      {
        initialProps: { storageKey: 'terminal-layout-groups:grid-3x2:5' },
      },
    )

    expect(result.current.getGroupSizes('wide-pane-root', 2, 50)).toEqual([
      70, 30,
    ])

    rerender({ storageKey: 'terminal-layout-groups:grid-3x2:6' })

    expect(result.current.getGroupSizes('wide-pane-root', 2, 50)).toEqual([
      45, 55,
    ])
  })

  it('writes updates into the active storage bucket after a key change', () => {
    const { result, rerender } = renderHook(
      ({ storageKey }: { storageKey: string }) => usePaneLayoutGroups(storageKey),
      {
        initialProps: { storageKey: 'terminal-layout-groups:grid-3x2:5' },
      },
    )

    rerender({ storageKey: 'terminal-layout-groups:grid-3x2:6' })
    act(() => {
      result.current.updateGroupSizes('wide-pane-root', [40, 60])
    })

    expect(
      window.localStorage.getItem('terminal-layout-groups:grid-3x2:6'),
    ).toBe('{"wide-pane-root":[40,60]}')
    expect(
      window.localStorage.getItem('terminal-layout-groups:grid-3x2:5'),
    ).toBeNull()
  })
})
