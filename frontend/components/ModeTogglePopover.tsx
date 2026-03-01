'use client'

import { Sparkles, Terminal } from 'lucide-react'
import type { AgentTool } from '@/lib/hooks/use-agent-tools'
import type { TerminalMode } from './ModeToggle'

interface ModeTogglePopoverProps {
  buttonRef: React.RefObject<HTMLButtonElement | null>
  value: TerminalMode
  agentTools: AgentTool[]
  onClose: () => void
  onSelectMode: (mode: TerminalMode) => void
}

export function ModeTogglePopover({
  buttonRef,
  value,
  agentTools,
  onClose,
  onSelectMode,
}: ModeTogglePopoverProps) {
  const rect = buttonRef.current?.getBoundingClientRect()
  const position = rect ? { top: rect.bottom + 4, left: rect.left } : { top: 0, left: 0 }

  return (
    <>
      <div className="fixed inset-0 z-[9999]" onClick={onClose} />
      <div
        className="fixed z-[10000] rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100"
        style={{
          ...position,
          backgroundColor: 'rgba(21, 27, 35, 0.95)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--term-border-active)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          minWidth: 160,
        }}
      >
        <button
          onClick={() => onSelectMode('shell')}
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
            onClick={() => onSelectMode(tool.slug)}
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
  )
}
