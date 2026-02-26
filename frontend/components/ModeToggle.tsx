'use client'

import { Loader2, Sparkles, Terminal } from 'lucide-react'
import { memo, useCallback, useRef, useState } from 'react'
import type { AgentTool } from '@/lib/hooks/use-agent-tools'

export type TerminalMode = 'shell' | string

interface ModeToggleProps {
  value: TerminalMode
  onChange: (mode: TerminalMode) => void | Promise<void>
  disabled?: boolean
  isMobile?: boolean
  /** External loading state - when true, toggle is disabled and shows spinner */
  isLoading?: boolean
  /** Available agent tools. When >1, shows a popover instead of binary toggle. */
  agentTools?: AgentTool[]
}

/**
 * Single-click toggle for switching between Shell and agent modes.
 * When only 1 agent tool: binary toggle (shell ↔ agent).
 * When multiple tools: opens popover with all options.
 */
export const ModeToggle = memo(function ModeToggle({
  value,
  onChange,
  disabled = false,
  isMobile = false,
  isLoading = false,
  agentTools = [],
}: ModeToggleProps) {
  const [internalLoading, setInternalLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const isCurrentlyLoading = isLoading || internalLoading
  const isDisabled = disabled || isCurrentlyLoading
  const isAgentMode = value !== 'shell'

  // Find the active tool for color theming
  const activeTool = agentTools.find((t) => t.slug === value)
  const accentColor = activeTool?.color || 'var(--term-accent)'
  const hasMultipleTools = agentTools.length > 1

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isDisabled) return

      if (hasMultipleTools) {
        setShowPopover((prev) => !prev)
        return
      }

      // Binary toggle: shell ↔ default agent tool
      const defaultTool = agentTools.find((t) => t.is_default) ?? agentTools[0]
      const oppositeMode: TerminalMode = isAgentMode
        ? 'shell'
        : defaultTool?.slug ?? 'shell'

      setInternalLoading(true)
      try {
        await onChange(oppositeMode)
      } catch (error) {
        console.error('Failed to switch mode:', error)
      } finally {
        setInternalLoading(false)
      }
    },
    [isAgentMode, onChange, isDisabled, hasMultipleTools, agentTools],
  )

  const handleSelectMode = useCallback(
    async (mode: TerminalMode) => {
      setShowPopover(false)
      if (mode === value) return

      setInternalLoading(true)
      try {
        await onChange(mode)
      } catch (error) {
        console.error('Failed to switch mode:', error)
      } finally {
        setInternalLoading(false)
      }
    },
    [onChange, value],
  )

  const tooltipText = isCurrentlyLoading
    ? 'Switching mode...'
    : isAgentMode
      ? `${activeTool?.name ?? 'Agent'} mode — click for ${hasMultipleTools ? 'options' : 'Shell'}`
      : `Shell mode — click for ${hasMultipleTools ? 'options' : agentTools[0]?.name ?? 'Agent'}`

  const size = isMobile ? 32 : 26
  const iconSize = isMobile ? 16 : 14

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={buttonRef}
          data-testid="mode-toggle"
          onClick={handleClick}
          disabled={isDisabled}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="mode-toggle-btn"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: size,
            height: size,
            borderRadius: 6,
            border: '1px solid',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundColor: isAgentMode
              ? `color-mix(in srgb, ${accentColor} 8%, transparent)`
              : isHovered && !isDisabled
                ? 'var(--term-bg-elevated)'
                : 'var(--term-bg-surface)',
            borderColor: isAgentMode
              ? 'var(--term-accent-muted)'
              : isHovered && !isDisabled
                ? 'var(--term-border-active)'
                : 'var(--term-border)',
            boxShadow: isAgentMode
              ? `0 0 8px color-mix(in srgb, ${accentColor} 20%, transparent), inset 0 0 12px color-mix(in srgb, ${accentColor} 10%, transparent)`
              : 'none',
            opacity: isDisabled ? 0.5 : 1,
          }}
          title={tooltipText}
          aria-label={tooltipText}
          aria-busy={isCurrentlyLoading}
        >
          {/* Glow ring for agent mode */}
          {isAgentMode && !isCurrentlyLoading && (
            <span
              className="mode-toggle-glow"
              style={{
                position: 'absolute',
                inset: -2,
                borderRadius: 8,
                border: `1px solid ${accentColor}`,
                opacity: 0.3,
                animation: 'mode-toggle-pulse 2s ease-in-out infinite',
              }}
            />
          )}

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease, color 0.2s ease',
              transform:
                isHovered && !isDisabled && !isCurrentlyLoading
                  ? 'scale(1.1)'
                  : 'scale(1)',
            }}
          >
            {isCurrentlyLoading ? (
              <Loader2
                width={iconSize}
                height={iconSize}
                style={{
                  color: accentColor,
                  animation: 'mode-toggle-spin 0.8s linear infinite',
                }}
              />
            ) : isAgentMode ? (
              <Sparkles
                width={iconSize}
                height={iconSize}
                style={{
                  color: accentColor,
                  filter: `drop-shadow(0 0 3px color-mix(in srgb, ${accentColor} 40%, transparent))`,
                }}
              />
            ) : (
              <Terminal
                width={iconSize}
                height={iconSize}
                style={{
                  color:
                    isHovered && !isDisabled
                      ? 'var(--term-text-primary)'
                      : 'var(--term-text-muted)',
                }}
              />
            )}
          </span>

          <span
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: isAgentMode ? accentColor : 'var(--term-text-muted)',
              opacity: isAgentMode ? 1 : 0.4,
              transition: 'all 0.2s ease',
              boxShadow: isAgentMode ? `0 0 4px ${accentColor}` : 'none',
            }}
          />
        </button>

        {/* Multi-tool popover — fixed positioning to escape overflow clipping */}
        {showPopover && hasMultipleTools && (
          <>
            <div
              className="fixed inset-0 z-[9999]"
              onClick={() => setShowPopover(false)}
            />
            <div
              className="fixed z-[10000] rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
              style={{
                ...(() => {
                  const rect = buttonRef.current?.getBoundingClientRect()
                  if (!rect) return { top: 0, left: 0 }
                  return {
                    top: rect.bottom + 4,
                    left: rect.left,
                  }
                })(),
                backgroundColor: 'rgba(21, 27, 35, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--term-border-active)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                minWidth: 160,
              }}
            >
              <button
                onClick={() => handleSelectMode('shell')}
                className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                style={{
                  color: value === 'shell' ? 'var(--term-accent)' : 'var(--term-text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <Terminal size={12} />
                <span>Shell</span>
                {value === 'shell' && <span className="ml-auto text-[10px]">●</span>}
              </button>
              {agentTools.map((tool) => (
                <button
                  key={tool.slug}
                  onClick={() => handleSelectMode(tool.slug)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                  style={{
                    color:
                      value === tool.slug
                        ? tool.color || 'var(--term-accent)'
                        : 'var(--term-text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <Sparkles size={12} />
                  <span>{tool.name}</span>
                  {value === tool.slug && <span className="ml-auto text-[10px]">●</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes mode-toggle-pulse {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.02);
          }
        }

        @keyframes mode-toggle-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .mode-toggle-btn:focus-visible {
          outline: 2px solid var(--term-accent);
          outline-offset: 2px;
        }

        .mode-toggle-btn:active:not(:disabled) {
          transform: scale(0.95);
        }
      `}</style>
    </>
  )
})
