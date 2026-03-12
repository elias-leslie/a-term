import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TerminalManagerModal } from './TerminalManagerModal'

const mockUseProjectSettings = vi.fn()

vi.mock('@/lib/hooks/use-project-settings', () => ({
  useProjectSettings: () => mockUseProjectSettings(),
}))

describe('TerminalManagerModal', () => {
  beforeEach(() => {
    mockUseProjectSettings.mockReturnValue({
      projects: [
        {
          id: 'proj-1',
          name: 'Agent Hub',
          root_path: '/workspace/agent-hub',
          terminal_enabled: true,
          mode: 'shell',
          display_order: 0,
        },
        {
          id: 'proj-2',
          name: 'Terminal',
          root_path: '/workspace/terminal',
          terminal_enabled: true,
          mode: 'shell',
          display_order: 1,
        },
      ],
    })
  })

  it('filters projects by search query', () => {
    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGenericTerminal={vi.fn()}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[]}
        hiddenExternalSessions={[]}
        onAttachExternalSession={vi.fn()}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText('Search Terminals'), {
      target: { value: 'agent' },
    })

    expect(screen.getByText('Agent Hub')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Terminal$/ })).not.toBeInTheDocument()
  })

  it('filters external sessions by the shared search input', () => {
    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGenericTerminal={vi.fn()}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[
          {
            id: 'claude-terminal',
            name: 'claude-terminal',
            user_id: null,
            project_id: 'terminal',
            working_dir: '/workspace/terminal',
            mode: 'claude',
            display_order: 0,
            is_alive: true,
            created_at: null,
            last_accessed_at: null,
            is_external: true,
            source: 'tmux_external',
          },
        ]}
        hiddenExternalSessions={[]}
        onAttachExternalSession={vi.fn()}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText('Search Terminals'), {
      target: { value: 'claude' },
    })

    expect(
      screen.getByRole('button', { name: /claude-terminal/i }),
    ).toBeInTheDocument()
  })

  it('uses a full-height mobile layout with a shared scroll region', () => {
    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGenericTerminal={vi.fn()}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[
          {
            id: 'claude-terminal',
            name: 'claude-terminal',
            user_id: null,
            project_id: 'terminal',
            working_dir: '/workspace/terminal',
            mode: 'claude',
            display_order: 0,
            is_alive: true,
            created_at: null,
            last_accessed_at: null,
            is_external: true,
            source: 'tmux_external',
          },
        ]}
        hiddenExternalSessions={[
          {
            id: 'codex-agent-hub',
            name: 'codex-agent-hub',
            user_id: null,
            project_id: 'agent-hub',
            working_dir: '/workspace/agent-hub',
            mode: 'codex',
            display_order: 0,
            is_alive: true,
            created_at: null,
            last_accessed_at: null,
            is_external: true,
            source: 'tmux_external',
          },
        ]}
        onAttachExternalSession={vi.fn()}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    expect(screen.getByTestId('terminal-manager-modal').className).toContain('top-3')
    expect(screen.getByTestId('terminal-manager-modal').className).toContain('bottom-3')
    expect(screen.getByTestId('terminal-manager-scroll-region').className).toContain('flex-1')
    expect(screen.getByTestId('terminal-manager-scroll-region').className).toContain('overflow-y-auto')
  })

  it('creates an ad-hoc terminal from quick start', () => {
    const onCreateGenericTerminal = vi.fn()

    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGenericTerminal={onCreateGenericTerminal}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[]}
        hiddenExternalSessions={[]}
        onAttachExternalSession={vi.fn()}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.click(screen.getByText('New Ad-Hoc Terminal'))

    expect(onCreateGenericTerminal).toHaveBeenCalledTimes(1)
  })

  it('attaches a live external session from the modal', () => {
    const onAttachExternalSession = vi.fn()
    const onClose = vi.fn()

    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={onClose}
        onCreateGenericTerminal={vi.fn()}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[
          {
            id: 'claude-terminal',
            name: 'claude-terminal',
            user_id: null,
            project_id: 'terminal',
            working_dir: '/workspace/terminal',
            mode: 'claude',
            display_order: 0,
            is_alive: true,
            created_at: null,
            last_accessed_at: null,
            is_external: true,
            source: 'tmux_external',
          },
        ]}
        hiddenExternalSessions={[]}
        onAttachExternalSession={onAttachExternalSession}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /claude-terminal/i }))

    expect(onAttachExternalSession).toHaveBeenCalledWith('claude-terminal')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores a hidden external session from the modal', () => {
    const onAttachExternalSession = vi.fn()
    const onRestoreExternalSession = vi.fn()
    const onClose = vi.fn()

    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={onClose}
        onCreateGenericTerminal={vi.fn()}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[]}
        hiddenExternalSessions={[
          {
            id: 'codex-agent-hub',
            name: 'codex-agent-hub',
            user_id: null,
            project_id: 'agent-hub',
            working_dir: '/workspace/agent-hub',
            mode: 'codex',
            display_order: 0,
            is_alive: true,
            created_at: null,
            last_accessed_at: null,
            is_external: true,
            source: 'tmux_external',
          },
        ]}
        onAttachExternalSession={onAttachExternalSession}
        onRestoreExternalSession={onRestoreExternalSession}
        panes={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /codex-agent-hub/i }))

    expect(onRestoreExternalSession).toHaveBeenCalledWith('codex-agent-hub')
    expect(onAttachExternalSession).toHaveBeenCalledWith('codex-agent-hub')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows a shared no-match summary when the search has no results', () => {
    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGenericTerminal={vi.fn()}
        onCreateProjectTerminal={vi.fn()}
        externalSessions={[]}
        hiddenExternalSessions={[]}
        onAttachExternalSession={vi.fn()}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText('Search Terminals'), {
      target: { value: 'missing-workspace' },
    })

    expect(
      screen.getByText('No terminals match "missing-workspace".'),
    ).toBeInTheDocument()
  })
})
