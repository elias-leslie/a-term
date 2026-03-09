import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PaneSlot } from '@/lib/utils/slot'
import { usePaneRenderer } from './use-pane-renderer'

const terminalProps = vi.hoisted(
  () => [] as Array<{ sessionId: string; isVisible?: boolean }>,
)

vi.mock('@/components/Terminal', () => ({
  TerminalComponent: ({
    sessionId,
    isVisible,
  }: {
    sessionId: string
    isVisible?: boolean
  }) => {
    terminalProps.push({ sessionId, isVisible })
    return <div data-testid={`terminal-${sessionId}`} />
  },
}))

vi.mock('@/components/UnifiedTerminalHeader', () => ({
  UnifiedTerminalHeader: () => <div data-testid="terminal-header" />,
}))

function RenderHarness({ slots }: { slots: PaneSlot[] }) {
  const renderPane = usePaneRenderer({
    props: {
      isMobile: false,
      isModeSwitching: false,
      fontFamily: 'monospace',
      fontSize: 14,
      scrollback: 1000,
      cursorStyle: 'block',
      cursorBlink: true,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#333333',
        black: '#000000',
        red: '#ff0000',
        green: '#00ff00',
        yellow: '#ffff00',
        blue: '#0000ff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffffff',
        brightBlack: '#111111',
        brightRed: '#ff1111',
        brightGreen: '#11ff11',
        brightYellow: '#ffff11',
        brightBlue: '#1111ff',
        brightMagenta: '#ff11ff',
        brightCyan: '#11ffff',
        brightWhite: '#f5f5f5',
      },
    },
    displaySlots: slots,
    paneCount: slots.length,
  })

  return (
    <div>
      {slots.map((slot, index) => (
        <div key={slot.paneId}>{renderPane(slot, index)}</div>
      ))}
    </div>
  )
}

describe('usePaneRenderer', () => {
  it('keeps all rendered desktop terminals visible', () => {
    terminalProps.length = 0

    const slots: PaneSlot[] = [
      {
        type: 'project',
        paneId: 'pane-1',
        projectId: 'project-1',
        projectName: 'Project 1',
        rootPath: '/tmp/project-1',
        activeMode: 'shell',
        activeSessionId: 'session-1',
        sessionBadge: null,
      },
      {
        type: 'project',
        paneId: 'pane-2',
        projectId: 'project-2',
        projectName: 'Project 2',
        rootPath: '/tmp/project-2',
        activeMode: 'shell',
        activeSessionId: 'session-2',
        sessionBadge: null,
      },
    ]

    render(<RenderHarness slots={slots} />)

    expect(screen.getByTestId('terminal-session-1')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-session-2')).toBeInTheDocument()
    expect(terminalProps).toEqual([
      { sessionId: 'session-1', isVisible: undefined },
      { sessionId: 'session-2', isVisible: undefined },
    ])
  })
})
