'use client'

import { Check, X } from 'lucide-react'
import { useState } from 'react'

export interface ToolFormData {
  name: string
  slug: string
  command: string
  process_name: string
  description: string
  color: string
}

export const EMPTY_FORM: ToolFormData = {
  name: '',
  slug: '',
  command: '',
  process_name: '',
  description: '',
  color: '#00FF9F',
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
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

export function ToolForm({
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
          style={{ backgroundColor: 'var(--term-accent)', color: 'var(--term-bg)', opacity: submitting ? 0.5 : 1, fontFamily: 'var(--font-mono)' }}
        >
          <Check size={10} />
          {isEdit ? 'Save' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors"
          style={{ backgroundColor: 'transparent', border: '1px solid var(--term-border)', color: 'var(--term-text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          <X size={10} />
          Cancel
        </button>
      </div>
    </form>
  )
}
