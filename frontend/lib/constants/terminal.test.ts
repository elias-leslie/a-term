import { describe, expect, it } from 'vitest'
import {
  getAvailableLayoutModes,
  getDefaultLayoutMode,
  getPaneCapacityForViewport,
} from './terminal'

describe('getPaneCapacityForViewport', () => {
  it('caps standard desktop widths at four panes', () => {
    expect(getPaneCapacityForViewport(1600)).toBe(4)
  })

  it('allows six panes on ultrawide widths', () => {
    expect(getPaneCapacityForViewport(1920)).toBe(6)
    expect(getPaneCapacityForViewport(2560)).toBe(6)
  })
})

describe('getAvailableLayoutModes', () => {
  it('offers both split orientations for two panes', () => {
    expect(getAvailableLayoutModes(2, 1440)).toEqual([
      'split-horizontal',
      'split-vertical',
    ])
  })

  it('uses the standard grid for three and four panes', () => {
    expect(getAvailableLayoutModes(3, 1440)).toEqual(['grid-2x2'])
    expect(getAvailableLayoutModes(4, 1440)).toEqual(['grid-2x2'])
  })

  it('uses the wide grid for five and six panes on ultrawide viewports', () => {
    expect(getAvailableLayoutModes(5, 1920)).toEqual(['grid-3x2'])
    expect(getAvailableLayoutModes(6, 2560)).toEqual(['grid-3x2'])
  })
})

describe('getDefaultLayoutMode', () => {
  it('defaults two panes to a side-by-side split', () => {
    expect(getDefaultLayoutMode(2, 1440)).toBe('split-horizontal')
  })

  it('defaults larger desktop layouts to the grid that fits them', () => {
    expect(getDefaultLayoutMode(4, 1440)).toBe('grid-2x2')
    expect(getDefaultLayoutMode(6, 2560)).toBe('grid-3x2')
  })
})
