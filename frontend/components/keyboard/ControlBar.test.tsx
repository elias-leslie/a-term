import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ModifierProvider } from './ModifierContext'
import { ControlBar } from './ControlBar'

vi.mock('@/lib/utils/agent-hub-models', () => ({
  getClaudeModelOptions: vi.fn().mockResolvedValue([]),
}))

function renderControlBar(overrides: Partial<ComponentProps<typeof ControlBar>> = {}) {
  const onSend = vi.fn()
  const onReconnect = vi.fn()

  render(
    <ModifierProvider>
      <ControlBar
        onSend={onSend}
        connectionStatus="connected"
        onReconnect={onReconnect}
        {...overrides}
      />
    </ModifierProvider>,
  )

  return { onSend, onReconnect }
}

describe('ControlBar', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows live mobile status copy for connected sessions', async () => {
    renderControlBar({ activeMode: 'shell' })

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })
    expect(screen.getByText('Shell terminal is live')).toBeInTheDocument()
  })

  it('surfaces voice activity copy when the mic panel is open', async () => {
    renderControlBar({
      activeMode: 'claude',
      voiceActive: true,
    })

    await waitFor(() => {
      expect(screen.getByText('Voice active')).toBeInTheDocument()
    })
    expect(screen.getByText('Agent input is using the mic')).toBeInTheDocument()
  })

  it('renders reconnect affordance for reconnectable failures', async () => {
    const { onReconnect } = renderControlBar({
      connectionStatus: 'disconnected',
    })

    const reconnectButton = await screen.findByRole('button', { name: 'Reconnect' })
    fireEvent.click(reconnectButton)

    expect(onReconnect).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Reconnect to resume this terminal')).toBeInTheDocument()
  })
})
