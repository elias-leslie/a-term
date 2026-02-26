'use client'

import { Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import {
  type AgentTool,
  useAgentTools,
} from '@/lib/hooks/use-agent-tools'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface ToolFormData {
  name: string
  slug: string
  command: string
  process_name: string
  description: string
  color: string
}

const EMPTY_FORM: ToolFormData = {
  name: '',
  slug: '',
  command: '',
  process_name: '',
  description: '',
  color: '#00FF9F',
}

function ToolForm({
  initial,
  onSubmit,
  onCancel,
  isEdit,
}: {
  initial: ToolFormData
  onSubmit: (data: ToolFormData) => Promise<void>
  onCancel: () => void
  isEdit: boolean
}) {
  const [form, setForm] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      // Auto-generate slug from name (only on create)
      ...(!isEdit ? { slug: slugify(name) } : {}),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.command || !form.process_name) return

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--term-bg-surface)',
    border: '1px solid var(--term-border)',
    borderRadius: 4,
    color: 'var(--term-text-primary)',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 10,
    color: 'var(--term-text-muted)',
    marginBottom: 2,
    fontFamily: 'var(--font-mono)',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-2 rounded" style={{ backgroundColor: 'var(--term-bg-surface)' }}>
      <div>
        <label style={labelStyle}>Name *</label>
        <input style={inputStyle} value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="OpenCode" />
      </div>
      <div>
        <label style={labelStyle}>Slug {isEdit && '(read-only)'}</label>
        <input style={{ ...inputStyle, opacity: isEdit ? 0.5 : 1 }} value={form.slug} onChange={(e) => !isEdit && setForm((f) => ({ ...f, slug: e.target.value }))} readOnly={isEdit} placeholder="opencode" />
      </div>
      <div>
        <label style={labelStyle}>Command *</label>
        <input style={inputStyle} value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} placeholder="opencode" />
      </div>
      <div>
        <label style={labelStyle}>Process Name *</label>
        <input style={inputStyle} value={form.process_name} onChange={(e) => setForm((f) => ({ ...f, process_name: e.target.value }))} placeholder="opencode" />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <input style={inputStyle} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
      </div>
      <div>
        <label style={labelStyle}>Color</label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} style={{ width: 28, height: 22, border: 'none', cursor: 'pointer', background: 'transparent' }} />
          <input style={{ ...inputStyle, flex: 1 }} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="#00FF9F" />
        </div>
      </div>
      {error && <div className="text-[10px]" style={{ color: '#ff6b6b' }}>{error}</div>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting || !form.name || !form.command || !form.process_name}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{
            backgroundColor: 'var(--term-accent)',
            color: 'var(--term-bg)',
            opacity: submitting ? 0.5 : 1,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Check size={10} />
          {isEdit ? 'Save' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--term-border)',
            color: 'var(--term-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <X size={10} />
          Cancel
        </button>
      </div>
    </form>
  )
}

function ToolRow({
  tool,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  tool: AgentTool
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded group"
      style={{
        backgroundColor: 'var(--term-bg-surface)',
        border: '1px solid var(--term-border)',
      }}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: tool.color || 'var(--term-text-muted)' }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] truncate" style={{ color: 'var(--term-text-primary)', fontFamily: 'var(--font-mono)' }}>
            {tool.name}
          </span>
          {tool.is_default && (
            <Star size={10} style={{ color: 'var(--term-accent)', flexShrink: 0 }} fill="currentColor" />
          )}
          {!tool.enabled && (
            <span className="text-[9px] px-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--term-text-muted)' }}>
              disabled
            </span>
          )}
        </div>
        <div className="text-[9px] truncate" style={{ color: 'var(--term-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {tool.command}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!tool.is_default && (
          <button
            onClick={onSetDefault}
            title="Set as default"
            className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: 'var(--term-text-muted)' }}
          >
            <Star size={10} />
          </button>
        )}
        <button
          onClick={onEdit}
          title="Edit"
          className="p-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: 'var(--term-text-muted)' }}
        >
          <Pencil size={10} />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1 rounded hover:bg-white/5 transition-colors"
          style={{ color: '#ff6b6b' }}
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

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
