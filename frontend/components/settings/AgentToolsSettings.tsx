'use client'

import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  type AgentTool,
  useAgentTools,
} from '@/lib/hooks/use-agent-tools'
import { EMPTY_FORM, ToolForm, type ToolFormData } from './ToolForm'
import { ToolRow } from './ToolRow'

export function AgentToolsSettings() {
  const { agentTools, create, update, remove } = useAgentTools()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null)

  const handleCreate = useCallback(
    async (data: ToolFormData) => {
      await create({
        name: data.name,
        slug: data.slug,
        command: data.command,
        process_name: data.process_name,
        description: data.description || undefined,
        color: data.color || undefined,
      })
      setShowAddForm(false)
    },
    [create],
  )

  const handleUpdate = useCallback(
    async (data: ToolFormData) => {
      if (!editingTool) return
      await update(editingTool.id, {
        name: data.name,
        command: data.command,
        process_name: data.process_name,
        description: data.description || undefined,
        color: data.color || undefined,
      })
      setEditingTool(null)
    },
    [editingTool, update],
  )

  const handleDelete = useCallback(
    async (tool: AgentTool) => {
      if (!confirm(`Delete "${tool.name}"?`)) return
      try {
        await remove(tool.id)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [remove],
  )

  const handleSetDefault = useCallback(
    async (tool: AgentTool) => {
      await update(tool.id, { is_default: true })
    },
    [update],
  )

  return (
    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--term-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-medium tracking-wider"
          style={{ color: 'var(--term-text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          AGENT TOOLS
        </span>
        {!showAddForm && !editingTool && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] hover:bg-white/5 transition-colors"
            style={{ color: 'var(--term-accent)', fontFamily: 'var(--font-mono)' }}
          >
            <Plus size={10} />
            Add
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {agentTools.map((tool) =>
          editingTool?.id === tool.id ? (
            <ToolForm
              key={tool.id}
              initial={{
                name: tool.name,
                slug: tool.slug,
                command: tool.command,
                process_name: tool.process_name,
                description: tool.description || '',
                color: tool.color || '#00FF9F',
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditingTool(null)}
              isEdit
            />
          ) : (
            <ToolRow
              key={tool.id}
              tool={tool}
              onEdit={() => setEditingTool(tool)}
              onDelete={() => handleDelete(tool)}
              onSetDefault={() => handleSetDefault(tool)}
            />
          ),
        )}

        {showAddForm && (
          <ToolForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            onCancel={() => setShowAddForm(false)}
            isEdit={false}
          />
        )}

        {agentTools.length === 0 && !showAddForm && (
          <div className="text-[10px] text-center py-2" style={{ color: 'var(--term-text-muted)' }}>
            No agent tools configured
          </div>
        )}
      </div>
    </div>
  )
}
