'use client'

export interface SettingCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SettingCheckbox({
  label,
  checked,
  onChange,
}: SettingCheckboxProps) {
  return (
    <div className="mb-4">
      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] px-2 -mx-2 rounded-md hover:bg-[var(--term-bg-deep)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded"
          style={{
            accentColor: 'var(--term-accent)',
          }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--term-text-muted)' }}
        >
          {label}
        </span>
      </label>
    </div>
  )
}
