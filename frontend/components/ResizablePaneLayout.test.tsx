import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResizablePaneLayout } from './ResizablePaneLayout'
import type { PaneSlot } from '@/lib/utils/slot'

vi.mock('@/lib/hooks/pane-layout', () => ({
  useMinSizeCalculator: () => () => 20,
  usePaneRenderer: () => () => <div data-testid="pane-body" />,
  useLayoutChangeHandler: () => vi.fn(),
}))

vi.mock('./pane-layouts', () => ({
  EmptyPaneState: () => <div data-testid="empty-pane-state" />,
  SinglePaneLayout: () => <div data-testid="single-pane-layout" />,
  TwoPaneLayout: ({
    orientation,
  }: {
    orientation?: 'horizontal' | 'vertical'
  }) => <div data-testid={`two-pane-${orientation ?? 'horizontal'}`} />,
  ThreePaneLayout: ({
    orientation,
  }: {
    orientation?: 'horizontal' | 'vertical'
  }) => <div data-testid={`three-pane-${orientation ?? 'horizontal'}`} />,
  FourPaneLayout: () => <div data-testid="four-pane-layout" />,
  WidePaneLayout: ({
    getStoredGroupLayout,
  }: {
    getStoredGroupLayout: (
      groupId: string,
      panelCount: number,
      defaultSize: number,
    ) => number[]
  }) => (
    <div data-testid="wide-pane-layout">
      {getStoredGroupLayout('wide-pane-root', 2, 50).join(',')}
    </div>
  ),
  ColumnPaneLayout: () => <div data-testid="column-pane-layout" />,
}))

function makeProjectSlot(id: string): PaneSlot {
  return {
    type: 'project',
    paneId: `pane-${id}`,
    projectId: `project-${id}`,
    projectName: `Project ${id}`,
    rootPath: `/tmp/project-${id}`,
    activeMode: 'shell',
    activeSessionId: `session-${id}`,
    sessionBadge: null,
  }
}

describe('ResizablePaneLayout', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('uses the vertical split for stacked two-pane mode', () => {
    render(
      <ResizablePaneLayout
        slots={[makeProjectSlot('1'), makeProjectSlot('2')]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="split-vertical"
      />,
    )

    expect(screen.getByTestId('two-pane-vertical')).toBeInTheDocument()
  })

  it('uses the wide grid when more than four panes are present', () => {
    render(
      <ResizablePaneLayout
        slots={[
          makeProjectSlot('1'),
          makeProjectSlot('2'),
          makeProjectSlot('3'),
          makeProjectSlot('4'),
          makeProjectSlot('5'),
          makeProjectSlot('6'),
        ]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="grid-3x2"
      />,
    )

    expect(screen.getByTestId('wide-pane-layout')).toBeInTheDocument()
  })

  it('uses the column layout for four wide columns', () => {
    render(
      <ResizablePaneLayout
        slots={[
          makeProjectSlot('1'),
          makeProjectSlot('2'),
          makeProjectSlot('3'),
          makeProjectSlot('4'),
        ]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="grid-4x1"
      />,
    )

    expect(screen.getByTestId('column-pane-layout')).toBeInTheDocument()
  })

  it('uses the column layout for the tall six-pane grid', () => {
    render(
      <ResizablePaneLayout
        slots={[
          makeProjectSlot('1'),
          makeProjectSlot('2'),
          makeProjectSlot('3'),
          makeProjectSlot('4'),
          makeProjectSlot('5'),
          makeProjectSlot('6'),
        ]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="grid-2x3"
      />,
    )

    expect(screen.getByTestId('column-pane-layout')).toBeInTheDocument()
  })

  it('uses the vertical split for stacked three-pane mode', () => {
    render(
      <ResizablePaneLayout
        slots={[
          makeProjectSlot('1'),
          makeProjectSlot('2'),
          makeProjectSlot('3'),
        ]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="split-vertical"
      />,
    )

    expect(screen.getByTestId('three-pane-vertical')).toBeInTheDocument()
  })

  it('switches to the correct wide-layout storage bucket when pane count changes', () => {
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

    const { rerender } = render(
      <ResizablePaneLayout
        slots={[
          makeProjectSlot('1'),
          makeProjectSlot('2'),
          makeProjectSlot('3'),
          makeProjectSlot('4'),
          makeProjectSlot('5'),
        ]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="grid-3x2"
      />,
    )

    expect(screen.getByTestId('wide-pane-layout')).toHaveTextContent('70,30')

    rerender(
      <ResizablePaneLayout
        slots={[
          makeProjectSlot('1'),
          makeProjectSlot('2'),
          makeProjectSlot('3'),
          makeProjectSlot('4'),
          makeProjectSlot('5'),
          makeProjectSlot('6'),
        ]}
        fontFamily="monospace"
        fontSize={14}
        layoutMode="grid-3x2"
      />,
    )

    expect(screen.getByTestId('wide-pane-layout')).toHaveTextContent('45,55')
  })
})
