import { useCallback } from 'react'
import {
  DEFAULT_MIN_SIZE_PERCENT,
  MIN_PANE_HEIGHT_PX,
  MIN_PANE_WIDTH_PX,
} from '@/types/pane-layout'

/**
 * Hook to calculate minimum pane size percentages based on container dimensions.
 */
export function useMinSizeCalculator(
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: containerRef is a stable React ref — .current is read at call time, not render time
  const getMinSizePercent = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (!containerRef.current) return DEFAULT_MIN_SIZE_PERCENT

      const rect = containerRef.current.getBoundingClientRect()
      if (direction === 'horizontal') {
        const percent = (MIN_PANE_WIDTH_PX / rect.width) * 100
        return Math.max(percent, 10)
      } else {
        const percent = (MIN_PANE_HEIGHT_PX / rect.height) * 100
        return Math.max(percent, 10)
      }
    },
    [],
  )

  return getMinSizePercent
}
