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

    fireEvent.change(screen.getByLabelText('Search Projects'), {
      target: { value: 'agent' },
    })

    expect(screen.getByText('Agent Hub')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Terminal$/ })).not.toBeInTheDocument()
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
        onAttachExternalSession={onAttachExternalSession}
        onRestoreExternalSession={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /claude-terminal/i }))

    expect(onAttachExternalSession).toHaveBeenCalledWith('claude-terminal')
  })

  it('restores a hidden external session from the modal', () => {
    const onAttachExternalSession = vi.fn()
    const onRestoreExternalSession = vi.fn()

    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
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
  })
})
