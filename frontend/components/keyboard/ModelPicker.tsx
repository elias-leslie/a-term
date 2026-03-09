'use client'

import { Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ClaudeModelOption } from '@/lib/utils/agent-hub-models'

interface ModelPickerProps {
  modelOptions: ClaudeModelOption[]
  onModelSelect: (command: string) => void
}

const btnStyle = {
  backgroundColor: 'var(--term-bg-elevated)',
  color: 'var(--term-text-muted)',
  border: '1px solid var(--term-border)',
}

export function ModelPicker({ modelOptions, onModelSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleTap = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleTap)
    document.addEventListener('touchstart', handleTap)
    return () => {
      document.removeEventListener('mousedown', handleTap)
      document.removeEventListener('touchstart', handleTap)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 h-11 px-3 rounded-md text-xs font-medium transition-all duration-150 active:scale-95"
        style={
          open
            ? {
                backgroundColor: 'rgba(0, 255, 159, 0.15)',
                color: 'var(--term-accent)',
                border: '1px solid var(--term-accent)',
              }
            : btnStyle
        }
        title="Switch Claude model"
      >
        <Sparkles className="w-4 h-4" />
        MODEL
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 right-0 rounded-lg overflow-hidden"
          style={{
            backgroundColor: 'var(--term-bg-elevated)',
            border: '1px solid var(--term-border-active)',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.4)',
            minWidth: 140,
            zIndex: 50,
          }}
        >
          {modelOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onModelSelect(opt.command)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-3 text-sm font-medium transition-colors duration-100"
              style={{
                color: 'var(--term-text-primary)',
                backgroundColor: 'transparent',
                borderBottom: '1px solid var(--term-border)',
                fontFamily: '"JetBrains Mono", monospace',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 255, 159, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
