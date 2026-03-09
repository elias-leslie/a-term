import type { MobileTerminalBannerState } from '@/lib/utils/mobile-terminal-status'

type BannerTone = MobileTerminalBannerState['tone']

const TONE_STYLES: Record<
  BannerTone,
  {
    borderColor: string
    backgroundColor: string
    dotColor: string
    labelColor: string
  }
> = {
  neutral: {
    borderColor: 'var(--term-border)',
    backgroundColor: 'rgba(125, 133, 144, 0.08)',
    dotColor: 'var(--term-text-muted)',
    labelColor: 'var(--term-text-primary)',
  },
  success: {
    borderColor: 'rgba(63, 185, 80, 0.35)',
    backgroundColor: 'rgba(63, 185, 80, 0.12)',
    dotColor: 'var(--term-success)',
    labelColor: 'var(--term-text-primary)',
  },
  warning: {
    borderColor: 'rgba(210, 153, 34, 0.35)',
    backgroundColor: 'rgba(210, 153, 34, 0.12)',
    dotColor: 'var(--term-warning)',
    labelColor: 'var(--term-text-primary)',
  },
  danger: {
    borderColor: 'rgba(248, 81, 73, 0.35)',
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    dotColor: 'var(--term-error)',
    labelColor: 'var(--term-text-primary)',
  },
}

interface StatusBannerProps {
  bannerState: MobileTerminalBannerState
  onReconnect?: () => void
}

export function StatusBanner({ bannerState, onReconnect }: StatusBannerProps) {
  const toneStyle = TONE_STYLES[bannerState.tone]

  return (
    <div className="flex items-center gap-2 px-1 pt-1">
      <div
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-2"
        style={{
          borderColor: toneStyle.borderColor,
          backgroundColor: toneStyle.backgroundColor,
        }}
      >
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: toneStyle.dotColor }}
        />
        <span
          className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: toneStyle.labelColor }}
        >
          {bannerState.label}
        </span>
        <span
          className="min-w-0 truncate text-[11px]"
          style={{ color: 'var(--term-text-muted)' }}
        >
          {bannerState.detail}
        </span>
      </div>

      {bannerState.actionLabel && onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="shrink-0 rounded-md border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-150 active:scale-95"
          style={{
            borderColor: 'rgba(248, 81, 73, 0.4)',
            backgroundColor: 'rgba(248, 81, 73, 0.12)',
            color: 'var(--term-text-primary)',
          }}
        >
          {bannerState.actionLabel}
        </button>
      )}
    </div>
  )
}
