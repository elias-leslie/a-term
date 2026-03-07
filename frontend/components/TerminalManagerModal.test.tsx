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
        panes={[]}
      />,
    )

    fireEvent.change(screen.getByLabelText('Search Projects'), {
      target: { value: 'agent' },
    })

    expect(screen.getByText('Agent Hub')).toBeInTheDocument()
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument()
  })

  it('creates an ad-hoc terminal from quick start', () => {
    const onCreateGenericTerminal = vi.fn()

    render(
      <TerminalManagerModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGenericTerminal={onCreateGenericTerminal}
        onCreateProjectTerminal={vi.fn()}
        panes={[]}
      />,
    )

    fireEvent.click(screen.getByText('New Ad-Hoc Terminal'))

    expect(onCreateGenericTerminal).toHaveBeenCalledTimes(1)
  })
})
