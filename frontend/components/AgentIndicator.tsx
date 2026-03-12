'use client'

type AgentState = 'none' | 'active' | 'idle'

interface AgentIndicatorProps {
  state: AgentState
  className?: string
  /** Custom color from agent tool (defaults to --term-accent) */
  color?: string | null
}

/**
 * Visual indicator for agent tool status.
 *
 * States:
 * - none: Just a dim dot (shell only)
 * - idle: Ring with static glow (agent session exists but user in base shell)
 * - active: Ring with breathing animation (agent session active)
 */
export function AgentIndicator({
  state,
  className = '',
  color,
}: AgentIndicatorProps) {
  const accentColor = color || 'var(--term-accent)'

  return (
    <div className={`flex items-center justify-center w-3 h-3 ${className}`} role="status" aria-label={state === 'none' ? 'Shell mode' : state === 'active' ? 'Agent active' : 'Agent idle'}>
      {state === 'none' ? (
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: 'var(--term-text-muted)',
            opacity: 0.5,
          }}
        />
      ) : (
        <div
          className={`w-2.5 h-2.5 rounded-full ${state === 'active' ? 'agent-indicator-active' : ''}`}
          style={{
            border: `2px solid ${accentColor}`,
            backgroundColor: 'transparent',
            boxShadow:
              state === 'active'
                ? `0 0 6px ${accentColor}`
                : `0 0 4px ${accentColor}`,
            // CSS custom property for animation
            ['--agent-color' as string]: accentColor,
          }}
        />
      )}

      <style jsx>{`
        @keyframes agent-breathe {
          0%, 100% {
            opacity: 0.6;
            box-shadow: 0 0 4px var(--agent-color, var(--term-accent));
          }
          50% {
            opacity: 1;
            box-shadow: 0 0 12px var(--agent-color, var(--term-accent));
          }
        }

        .agent-indicator-active {
          animation: agent-breathe 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
