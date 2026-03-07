import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  ThreePaneLayout: () => <div data-testid="three-pane-layout" />,
  FourPaneLayout: () => <div data-testid="four-pane-layout" />,
  WidePaneLayout: () => <div data-testid="wide-pane-layout" />,
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
})
