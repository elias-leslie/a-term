import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModeToggle } from './ModeToggle'

// Mock styled-jsx to avoid errors in test environment
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return actual
})

describe('ModeToggle', () => {
  it('renders in shell mode with correct aria-label', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="shell" onChange={onChange} />)

    const button = screen.getByTestId('mode-toggle')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Shell mode — click for Claude')
  })

  it('renders in claude mode with correct aria-label', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="claude" onChange={onChange} />)

    const button = screen.getByTestId('mode-toggle')
    expect(button).toHaveAttribute('aria-label', 'Claude mode — click for Shell')
  })

  it('calls onChange with opposite mode when clicked in shell mode', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ModeToggle value="shell" onChange={onChange} />)

    const button = screen.getByTestId('mode-toggle')
    fireEvent.click(button)

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('claude')
    })
  })

  it('calls onChange with opposite mode when clicked in claude mode', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined)
    render(<ModeToggle value="claude" onChange={onChange} />)

    const button = screen.getByTestId('mode-toggle')
    fireEvent.click(button)

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('shell')
    })
  })

  it('shows loading state via aria-busy when isLoading is true', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="shell" onChange={onChange} isLoading />)

    const button = screen.getByTestId('mode-toggle')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-label', 'Switching mode...')
  })

  it('disables the button when disabled prop is true', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="shell" onChange={onChange} disabled />)

    const button = screen.getByTestId('mode-toggle')
    expect(button).toBeDisabled()
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="shell" onChange={onChange} disabled />)

    const button = screen.getByTestId('mode-toggle')
    fireEvent.click(button)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not call onChange when isLoading', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="shell" onChange={onChange} isLoading />)

    const button = screen.getByTestId('mode-toggle')
    fireEvent.click(button)

    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies reduced opacity when disabled', () => {
    const onChange = vi.fn()
    render(<ModeToggle value="shell" onChange={onChange} disabled />)

    const button = screen.getByTestId('mode-toggle')
    expect(button.style.opacity).toBe('0.5')
  })
})
